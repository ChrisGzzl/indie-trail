# Endless Rails v0.3 Dual Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a v0.3 dual-progression loop where combat experience pauses for 3-choice upgrades, rare weapon cores are collected in real time, and route/experience progress are visible together.

**Architecture:** Keep the existing dependency-free Canvas runtime and split deterministic progression rules into `progression.js`. `game.js` owns rendering, DOM overlays, and integration with the existing enemy, weapon, station, and motion systems. The existing `balance.js` and `motion.js` remain optional browser assets with in-file fallbacks.

**Tech Stack:** Dependency-free browser JavaScript, HTML, CSS, Node built-in `assert` tests, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-09-02-endless-rails-dual-progression-design.md`

## Global Constraints

- Target version is v0.3; manually submitted v0.2 remains the baseline and is not rewritten as a release.
- Experience upgrades pause combat and present exactly three unique choices.
- Weapon cores are real-time drops collected by drone movement and capped at three total stacks.
- Station upgrades remain train-focused and must not duplicate the experience weapon pool.
- Route and experience progress rows must remain readable at 390x680 and 320x568.
- Missing optional `balance.js`, `motion.js`, or `progression.js` assets must not prevent startup.
- Use ASCII for new source comments and preserve unrelated working-tree changes.

### Task 1: Add Deterministic Progression Rules

**Files:**
- Create: `endless-rails/progression.js`
- Create: `endless-rails/progression.test.js`
- Modify: `endless-rails/index.html:50-52`

**Interfaces:**
- `createProgression(config?) -> progressionState`
- `awardExperience(state, amount) -> { state, levelsGained }`
- `advanceRoute(state, dt) -> state`
- `rollCoreDrop({ elite, combo, random }) -> string | null`
- `collectCore(state, coreType) -> { state, collected, scrap }
- `expireDrops(drops, dt) -> drops`

- [ ] **Step 1: Write the failing tests**

```js
const progression = require("./progression.js");
const state = progression.createProgression({ routeDistanceTotal: 20, experienceToNext: 10 });
const result = progression.awardExperience(state, 23);
assert.equal(result.levelsGained, 2);
assert.equal(result.state.level, 2);
assert.equal(result.state.experience, 3);
assert.equal(progression.advanceRoute(result.state, 2).routeDistance, 18);
assert.equal(progression.rollCoreDrop({ elite: true, combo: 0, random: () => 0.1 }), "overdrive");
assert.equal(progression.collectCore({ ...result.state, coreStacks: {} }, "overdrive").collected, true);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node endless-rails/progression.test.js`

Expected: FAIL because `progression.js` does not exist.

- [ ] **Step 3: Implement the minimal progression module**

Implement `createProgression` with `level: 1`, `experience: 0`, `experienceToNext: 10`, `pendingLevelUps: 0`, `routeDistanceTotal`, `routeDistance`, empty `drops`, and empty `coreStacks`. `awardExperience` must loop while experience reaches the current threshold, retain overflow, and increment `pendingLevelUps`. `advanceRoute` must clamp distance at zero. `rollCoreDrop` must return `overdrive` for elite rolls under `.28`, `scatter` or `arc` for later pool entries, and return a core on every fifth combo under `.10`; otherwise return null. `collectCore` must cap total stacks at three and return a 10 scrap conversion when full. `expireDrops` subtracts `dt` and removes entries at zero.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node endless-rails/progression.test.js`

Expected: PASS with `progression tests passed`.

- [ ] **Step 5: Commit the isolated module**

```text
git add endless-rails/progression.js endless-rails/progression.test.js endless-rails/index.html
git commit -m "feat: add v0.3 progression rules"
```

### Task 2: Integrate Experience Levels and Weapon Cores

**Files:**
- Modify: `endless-rails/game.js:1-43`
- Modify: `endless-rails/index.html:20-43`
- Modify: `endless-rails/styles.css:1-10`
- Modify: `endless-rails/startup.test.js:1-65`

**Interfaces:**
- `game.js` consumes `window.EndlessRailsProgression` and exposes no new global API.
- `killEnemy` calls `progression.awardExperience` and `progression.rollCoreDrop`.
- `update` pauses all combat simulation while `state.mode === "levelup"`.
- `renderLevelUpChoices` creates three unique buttons and `chooseLevelUp` applies a selected experience module.

- [ ] **Step 1: Add failing integration assertions**

Add a progression script load to `startup.test.js`, then assert that loading `balance.js`, `motion.js`, `progression.js`, and `game.js` in order registers the start handler and that `window.EndlessRailsProgression` exists. Add a test fixture assertion that the HTML contains `routeProgress` and `experienceProgress`.

- [ ] **Step 2: Run startup tests to verify the new assertions fail**

Run: `node endless-rails/startup.test.js`

Expected: FAIL because the progress DOM nodes and integration are absent.

- [ ] **Step 3: Add state and integration**

Load `progression.js` before `game.js`. Extend state with `mode: "combat" | "levelup"`, `experience`, `experienceToNext`, `level`, `pendingLevelUps`, `routeDistance`, `routeDistanceTotal`, `drops`, and `coreStacks`. Reset these values in `resetRun` and initialize route distance at 20 km. In `killEnemy`, award 1 experience for regular and 4 for elite, roll elite/combo drops, and add a drop at the enemy position with `life: 8`. Use experience modules for rapid fire, scatter, piercing, chain arc, missile, and wingman. Remove duplicate drone-fire cards from station choices.

- [ ] **Step 4: Add the level-up pause overlay**

Add a hidden `levelUpScreen` with `levelUpList`. `maybeOpenLevelUp` changes mode to `levelup` when pending choices exist, generates three unique experience cards, and hides only the touch hint. `chooseLevelUp` applies the module, decrements pending choices, opens another choice if needed, and returns to combat only when the queue is empty. While levelup is active, leave `draw()` running but return before route, enemy, firing, and drop updates.

- [ ] **Step 5: Add core update and pickup behavior**

Update drop lifetime and drone pickup during combat. Use a base pickup radius of 24 plus `magnet` station levels. On pickup, call `collectCore`, increment the selected core effect, remove the drop, and show a toast. Full core capacity converts to scrap.

- [ ] **Step 6: Run startup and existing tests**

Run: `node endless-rails/startup.test.js; node endless-rails/motion.test.js; node endless-rails/balance.test.js; node --check endless-rails/game.js`

Expected: all tests pass and the script syntax check exits successfully.

- [ ] **Step 7: Commit the integration**

```text
git add endless-rails/game.js endless-rails/index.html endless-rails/styles.css endless-rails/startup.test.js
git commit -m "feat: add combat level ups and weapon cores"
```

### Task 3: Add Dual Progress HUD and Visual Feedback

**Files:**
- Modify: `endless-rails/index.html:12-31`
- Modify: `endless-rails/styles.css:2-10`
- Modify: `endless-rails/game.js:28-43`

**Interfaces:**
- `updateHud` writes route and experience labels/fill widths.
- `drawDrops` renders active cores without changing canvas dimensions.
- Existing health, boss, combo, toast, and touch hint elements remain functional.

- [ ] **Step 1: Add failing static layout checks**

Add a Node assertion that the HTML contains `routeProgress`, `routeProgressFill`, `experienceProgress`, `experienceProgressFill`, and `levelUpScreen`; assert the CSS contains a mobile-safe progress-row rule.

- [ ] **Step 2: Run the static check to verify it fails**

Run: `node endless-rails/startup.test.js`

Expected: FAIL because the new IDs and CSS rule are absent.

- [ ] **Step 3: Implement the HUD and overlay markup**

Place two compact rows beneath the header stats. Use labels `距下一站 20.0 km` and `Lv.1 · 0 / 10`. Add the level-up overlay as a full-width, mobile-safe panel with three cards and a concise pause label.

- [ ] **Step 4: Implement visual feedback**

Draw route and experience fill widths from state. Render cores as pulsing cyan/orange diamonds with a small lifetime ring. Draw stronger hit streaks and a visible pickup burst while preserving the train anchor and playfield.

- [ ] **Step 5: Run static, syntax, and progression tests**

Run: `node endless-rails/progression.test.js; node endless-rails/startup.test.js; node --check endless-rails/game.js; git diff --check`

Expected: all tests pass and diff check reports no whitespace errors.

- [ ] **Step 6: Commit the HUD work**

```text
git add endless-rails/index.html endless-rails/styles.css endless-rails/game.js endless-rails/startup.test.js
git commit -m "feat: show route and experience progress"
```

### Task 4: Verify v0.3 Runtime and Mobile Acceptance

**Files:**
- Modify: `README.md:1-20`
- Test: `endless-rails/progression.test.js`, `endless-rails/startup.test.js`, `endless-rails/motion.test.js`, `endless-rails/balance.test.js`

- [ ] **Step 1: Add v0.3 run instructions**

Update the Endless Rails entry to state that v0.2 is the manually submitted baseline and v0.3 adds dual progression.

- [ ] **Step 2: Run the complete verification set**

Run: `node endless-rails/progression.test.js; node endless-rails/startup.test.js; node endless-rails/motion.test.js; node endless-rails/balance.test.js; node --check endless-rails/progression.js; node --check endless-rails/game.js; git diff --check`

Expected: all four test scripts print their pass messages, syntax checks exit successfully, and diff check has no errors.

- [ ] **Step 3: Verify local HTTP assets**

Request `/endless-rails/`, `balance.js`, `motion.js`, `progression.js`, and `game.js` from `http://127.0.0.1:4173`. Confirm status 200 and confirm HTML script order is balance, motion, progression, game.

- [ ] **Step 4: Perform the browser playtest**

Open the route at 390x680 and 320x568. Click start, confirm enemies move while the train stays centered, kill until the level-up overlay appears, confirm simulation pauses, select a card, collect a visible core with the drone, and confirm both progress rows remain readable.

- [ ] **Step 5: Commit the v0.3 documentation update**

```text
git add README.md
git commit -m "docs: describe Endless Rails v0.3 progression"
```
