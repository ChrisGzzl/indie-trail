# Endless Rails v0.4 荒原远征 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a mobile-friendly expedition update with relative drone control, coherent ground-and-rail motion, bounded escort firepower, route variation, and replayable run summaries.

**Architecture:** Keep the dependency-free Canvas runtime. Add pure modules for control mapping, route events, and run records; extend combat-effects.js with explicit weapon profiles and an escort budget. game.js remains the runtime coordinator and renderer, consuming these modules through browser globals with fallbacks.

**Tech Stack:** Dependency-free browser JavaScript, Canvas 2D, HTML/CSS, Node built-in assert, browser localStorage.

**Spec:** docs/superpowers/specs/2026-09-06-endless-rails-v04-expedition-design.md

## Global Constraints

- The default control is relative command: a tap anywhere in the arena sets a target relative to the train center.
- Direct pointing may remain only as a compatibility setting; tutorial and acceptance use relative command.
- The train remains screen-centered; rails, ground and near-field landmarks share world direction and scroll phase.
- Escort bullets are independent: 40% base main-shot damage, 1.35x main base interval, single-shot, and no inherited scatter, piercing, chain or missile behavior.
- Total escort DPS is capped at 60% of current main-weapon DPS and is redistributed among escorts as count changes.
- Weapon upgrades declare main-only, escort-only, train-only, or team-utility ownership.
- Pause freezes combat simulation, route distance, drop lifetime and world scroll; overlays cannot pass pointer input to the arena.
- Preserve optional-script fallbacks, v0.3 dual progression and unrelated working-tree changes.

## File Structure

- Create control.js and control.test.js for relative/direct target mapping and command-ring lifetime.
- Modify motion.js and motion.test.js for common scroll offsets and deterministic landmark projection.
- Modify combat-effects.js, combat-effects.test.js, balance.js and balance.test.js for explicit weapon profiles and escort limits.
- Create route-events.js and route-events.test.js for seeded route events, contracts and modifiers.
- Create run-record.js and run-record.test.js for summaries and resilient local persistence.
- Modify index.html, styles.css, game.js and startup.test.js for UI and integration.
- Modify README.md for v0.4 controls and URL.

### Task 1: Relative Control and World Motion

**Interfaces:** relativeCommand(point, train, bounds, radius), directCommand(point, bounds, padding), createCommandRing(target, life), advanceCommandRing(ring, dt), scrollOffset(time, speed, multiplier), projectLandmark(seed, index, width, height, offset, layer).

- [ ] Step 1: Add failing tests to control.test.js.

~~~~js
const target = control.relativeCommand({ x: 390, y: 680 }, { x: 195, y: 340 }, { left: 46, right: 344, top: 120, bottom: 570 }, 132);
assert.equal(target.x, 288);
assert.equal(target.y, 454);
assert.ok(target.strength <= 1);
assert.deepEqual(control.directCommand({ x: -10, y: 999 }, { left: 46, right: 344, top: 120, bottom: 570 }, 0), { x: 46, y: 570 });
~~~~

- [ ] Step 2: Run node endless-rails/control.test.js and confirm it fails because control.js is absent.
- [ ] Step 3: Implement normalized relative vector mapping, bounds clamping, direct mapping and expiring command rings. Export CommonJS and window.EndlessRailsControl.
- [ ] Step 4: Add motion tests asserting scrollOffset(2, 88, 1) equals 176, near and far projections differ, and repeated calls with the same seed are equal.
- [ ] Step 5: Implement scrollOffset and deterministic hash-based projectLandmark. Use layer multipliers near 1.0, mid 0.48 and far 0.16; wrap coordinates without Math.random.
- [ ] Step 6: Run node endless-rails/control.test.js; node endless-rails/motion.test.js and confirm both pass.
- [ ] Step 7: Commit control.js, control.test.js, motion.js and motion.test.js with message feat: add relative control and world scroll rules.

### Task 2: Bounded Main and Escort Firepower

**Interfaces:** weaponOwnership(id), mainWeaponProfile(input), escortWeaponProfile(input), trainWeaponProfile(input), emptyEscortProfile().

- [ ] Step 1: Add failing tests asserting escort projectileCount is 1, pierce is 0, chain is false, and three escorts stay below main.dps times 0.6.

~~~~js
const main = effects.mainWeaponProfile({ baseDamage: 1.55, baseInterval: 0.4, modules: { rapid: 2, scatter: 1, piercing: 1, chain: 1 }, cores: { scatter: 1 } });
const escort = effects.escortWeaponProfile({ main, escortCount: 3, escortLevel: 0 });
assert.equal(escort.projectileCount, 1);
assert.equal(escort.pierce, 0);
assert.equal(escort.chain, false);
assert.ok(escort.totalDps <= main.dps * 0.6 + 0.0001);
assert.equal(effects.weaponOwnership("wingman"), "escort-only");
~~~~

- [ ] Step 2: Run node endless-rails/combat-effects.test.js and confirm it fails before the new functions exist.
- [ ] Step 3: Add balance constants ESCORT_BASE_DAMAGE_RATIO 0.4, ESCORT_INTERVAL_MULTIPLIER 1.35 and ESCORT_DPS_CAP_RATIO 0.6. Main profile applies main-only modules and allowed cores. Escort profile uses one projectile, no inherited piercing or chain, a 1.35 interval and a total-DPS cap.
- [ ] Step 4: Add tests for railgun train-only, magnet team-utility, zero escort count and positive base main DPS.
- [ ] Step 5: Run balance and combat-effects tests and confirm all profiles stay within limits.
- [ ] Step 6: Commit the four firepower files with message feat: bound escort firepower.

### Task 3: Seeded Route Choices and Run Records

**Interfaces:** createSeed(value), pickRouteEvents(seed, station), pickContracts(seed), applyRouteModifiers(base, event, contract), buildRunSummary(state), mergeRecord(previous, summary), loadRecord(storage), saveRecord(storage, record).

- [ ] Step 1: Add failing tests asserting three unique deterministic route choices, positive modified distance, summary copies modules and cores, and storage failure returns false.
- [ ] Step 2: Run the two new test files and confirm they fail because modules are absent.
- [ ] Step 3: Implement dust, sprint and freight events with route distance, enemy speed, elite chance, core chance and weather modifiers. Add three contracts with explicit reward, enemy HP and scrap multipliers. Use a local seeded generator and avoid mutating inputs.
- [ ] Step 4: Implement a versioned localStorage record. Invalid JSON, missing storage and setItem errors return an empty record or false; mergeRecord increments runs and updates larger best values only.
- [ ] Step 5: Run route-events.test.js and run-record.test.js and confirm both pass.
- [ ] Step 6: Commit the four replay-system files with message feat: add expedition events and run records.

### Task 4: Integrate Runtime Behavior

**Files:** game.js, index.html, startup.test.js.

**State additions:** paused, controlMode, commandRing, runSeed, activeEvent, activeContract, routeModifiers, escortClock, record.

- [ ] Step 1: Extend startup.test.js with DOM IDs pauseButton, commandRing, eventScreen, eventList, contractScreen, contractList, rerollButton, resultBuild and resultRecord, plus script-order assertions for control.js, route-events.js and run-record.js. Run it and confirm failure.
- [ ] Step 2: Add the scripts and mobile-safe DOM: pause button, inert command-ring element, contract and event overlays with three cards, station reroll button and result build/record fields. Keep overlays hidden by default.
- [ ] Step 3: Replace absolute pointer mapping with a setCommand handler that uses directCommand only in compatibility mode and relativeCommand by default. Ignore input while paused or under an overlay; create and draw a fading command ring.
- [ ] Step 4: Replace decorative background shapes with drawGroundLayers, drawWorldLandmarks and drawRails. Use common scrollOffset and projectLandmark calls, active event weather and a stable horizon.
- [ ] Step 5: Use separate main and escort clocks. Build main and escort profiles, fire escort bullets independently, and ensure fireProfile copies only the selected profile projectile count, pierce and chain values. Apply route modifiers to spawn, enemy speed, core chance and scrap rewards.
- [ ] Step 6: Open contract selection at run start and route-event selection at station transitions. Add one paid station reroll and keep selected upgrade/action controls above the safe-area inset.
- [ ] Step 7: Toggle paused state without advancing enemies, shots, timers, route distance, drops, particles or world scroll. Finish builds and saves a run summary; storage failures never block gameplay.
- [ ] Step 8: Run startup.test.js and node --check endless-rails/game.js; confirm start enters combat and optional fallbacks remain valid.
- [ ] Step 9: Commit game.js, index.html and startup.test.js with message feat: integrate expedition combat loop.

### Task 5: Visual Polish and Acceptance

**Files:** styles.css, index.html, game.js, startup.test.js and README.md.

- [ ] Step 1: Add failing static assertions for a reduced-motion media rule, pause-button, command-ring, event-card and upgrade scope selectors.
- [ ] Step 2: Style stable pause and command controls, event/contract cards, scope labels, route weather classes and short-screen layouts. Keep buttons and primary actions above safe-area padding.
- [ ] Step 3: Add station palettes, ground dust, near-train warning marks, boss phase feedback and reduced-motion suppression of continuous dust and large shakes.
- [ ] Step 4: Update README with relative command instructions and the /endless-rails/ URL.
- [ ] Step 5: Run all unit tests, all node --check commands and git diff --check. Every test must print its pass message and every check must exit 0.
- [ ] Step 6: Start python -m http.server 4173. Request the Endless Rails HTML and every script; each must return 200 and script order must be balance, motion, progression, combat-effects, control, route-events, run-record, game.
- [ ] Step 7: Browser-test at 390x844 and 320x568: start, choose contract/event, tap away from the drone, verify relative movement, verify ground and rails scroll together, pause and verify freezing, choose a level-up, collect a core, reach a station and reroll once, inspect result summary. Repeat two events and three builds, capturing screenshots.
- [ ] Step 8: Commit UI, README and acceptance updates with message feat: polish Endless Rails expedition.

## Plan Self-Review

- Spec coverage: Tasks 1-2 cover control, shared ground motion and bounded firepower; Task 3 covers events, contracts, seeds and records; Task 4 integrates pause, reroll, input, rendering and combat; Task 5 covers UI, reduced motion, docs, HTTP and browser acceptance.
- Placeholder scan: no TBD, TODO or unspecified test action remains.
- Type consistency: each interface used in Tasks 2-4 is declared in the preceding task or existing runtime API.

