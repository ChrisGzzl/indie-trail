# Endless Rails v0.3 Dual Progression Design

**Status:** Proposed
**Date:** 2026-09-02
**Target version:** v0.3

This design starts from the manually submitted v0.2 baseline. The dual-progression systems described here are v0.3 scope and are not part of v0.2.

## Goal

Make the combat loop feel like a train-survival horde shooter without weakening the route decision. The player should gain reliable combat power during each route, make active risk/reward decisions by collecting dropped weapon cores, and make slower train-focused decisions at stations.

## Player-Facing Model

The run has three distinct growth lines:

1. **Experience upgrades** are earned from kills. When a level is reached, combat pauses and the player chooses one of three drone weapon upgrades.
2. **Weapon cores** are rare, real-time drops. The drone must fly over a core to collect it; collection does not pause combat. A collected core becomes a permanent modifier for the current run, with a maximum of three core stacks.
3. **Station upgrades** are selected between routes. They focus on train survivability, train equipment, route pacing, or recovery and do not duplicate the experience weapon pool.

## State Model

The combat state adds:

- `routeDistance` and `routeDistanceTotal`, measured in kilometers for display.
- `experience`, `experienceToNext`, and `level`.
- `pendingLevelUps`, used when a kill grants enough experience for multiple levels.
- `levelUpChoices`, the current three-choice set.
- `drops`, containing active weapon cores with position, type, and remaining lifetime.
- `coreStacks`, keyed by core type and capped at three total stacks.

The existing station timer is replaced for player-facing progress by route distance. A route advances continuously while combat is active. Distance reaches zero before the station screen opens. Existing station and combat state remain resettable at the beginning of a run.

## Experience Flow

1. A defeated regular enemy grants one experience unit. An elite grants four units. Boss rewards are handled as a large one-time grant after the boss is defeated.
2. Experience is added before the next frame's combat update. Overflow remains in `experience` when a level threshold is crossed.
3. Each threshold increments `pendingLevelUps` and increases `experienceToNext` using a steadily increasing threshold: `10 + level * 4`.
4. When `pendingLevelUps` is positive, the game changes to `levelup` mode. Enemy movement, firing, route distance, drops, and timers stop while particles already on screen remain drawn.
5. The level-up overlay shows three unique choices from the experience pool. Selecting a choice applies it immediately, decrements `pendingLevelUps`, and either opens the next choice or resumes combat.

## Experience Upgrade Pool

The first pool contains weapon-focused drone upgrades:

- **Pulse Machine Gun:** shorter automatic-fire interval.
- **Shard Rounds:** adds two angled projectiles per shot.
- **Piercing Rounds:** a projectile can damage one additional enemy.
- **Chain Arc:** a hit jumps to a nearby enemy with reduced damage.
- **Tracking Missile:** fires a periodic high-damage missile.
- **Wingman:** adds an auxiliary drone firing at the nearest active target.

These upgrades are only offered by experience level-ups. Station cards that duplicate these effects are removed from the station pool.

## Weapon Core Drops

Regular enemies do not drop cores. An elite has a 28% chance to drop one, and every fifth consecutive kill has a 10% chance to drop one. A drop is selected from a separate core pool and remains visible for eight seconds.

The first core pool contains three permanent run modifiers:

- **Overdrive Core:** automatic-fire interval reduced by 18%.
- **Scatter Core:** adds one additional projectile to each shot.
- **Arc Core:** every fourth hit emits a short-range chain arc.

Core pickup uses the drone position and a base radius of 24 pixels. The existing magnet upgrade increases this radius. A core is collected once, removed from `drops`, and its stack count is applied immediately. The total number of collected core stacks cannot exceed three; additional drops convert to a small scrap reward instead of silently disappearing.

## Station Upgrade Pool

Station cards remain the slower train decision and contain only:

- armor and maximum train integrity;
- repair and shield recovery;
- railgun and other train-mounted equipment;
- cargo, train length, and scrap economy;
- magnet radius as a train utility that also improves core pickup.

Station selection remains one card per stop. The existing station overlay is reused; the experience overlay is a separate combat-only overlay so the two decisions have different timing and visual language.

## HUD and Progress

The top HUD gains two compact progress rows below the station/scrap readout:

- **Route row:** `距下一站 X.X km`, with filled width equal to `routeDistance / routeDistanceTotal`.
- **Experience row:** `Lv.N · X / Y`, with filled width equal to `experience / experienceToNext`.

The rows use distinct colors and labels. They remain visible during combat and are hidden behind the station or result overlays. The existing health and boss bars keep their positions but move down when the boss is active so the rows never overlap.

The level-up overlay is a full-width mobile-safe panel with three large, tappable cards. It must not alter the canvas size or move the train anchor.

## Combat and Timing Rules

- `mode === "combat"` advances route distance, enemy movement, weapon firing, particles, and drop lifetimes.
- `mode === "levelup"` advances none of those systems; rendering continues for visual continuity.
- `mode === "station"` and `mode === "result"` continue to use the existing overlays.
- A route completes when `routeDistance <= 0`, which opens the station overlay after all pending level-up choices have been resolved.
- A level-up choice always takes priority over station transition if both conditions become true in the same update.

## Error Handling and Compatibility

- If a drop pool is exhausted or all three core stacks are full, the drop converts to scrap and displays a short toast.
- Missing optional `balance.js` or `motion.js` assets continue to use the existing in-file fallbacks.
- A reset clears experience, level, pending choices, drops, core stacks, and route distance while preserving the current startup and script-loading safeguards.
- Existing train collision, shield, boss, and station behavior remains unchanged unless explicitly covered above.

## Verification

Pure progression tests must cover:

- experience grants and threshold overflow;
- multiple pending level-ups;
- route distance decrement and station completion;
- elite and combo drop chances with deterministic random input;
- core lifetime, pickup radius, stack cap, and scrap conversion.

Startup tests must cover both optional script loading orders and the level-up overlay click path. Static checks must confirm both progress rows load before `game.js`, and mobile layout checks must confirm the rows and health/boss bars do not overlap at 390x680 and 320x568.

Acceptance requires a playable opening route where combat power can increase before the first station, the player can see both route and experience progress, level-up pauses are unambiguous, cores are reachable by drone movement, and station upgrades remain a separate strategic decision.
