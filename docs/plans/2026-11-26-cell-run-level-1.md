# Cell Run Level 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Level 1, "Out of Sync": a side-on 2.5D swim-and-puzzle game through the right heart, driven by an accurate pressure-based cardiac-cycle model.

**Architecture:** All the gameplay logic is pure ES modules with no Phaser imports (heart model, collision, player physics, level data and state machine), so it can be unit-tested in Node. A thin Phaser 3 scene reads those modules to draw, play sound and take input. Text-heavy screens (start, codex, pause, AV dial, completion) are DOM overlays so the text stays crisp.

**Tech Stack:** Phaser 3.90.0 (vendored `phaser.min.js`, global `Phaser`), plain ES modules with no build step, the Node built-in test runner (`node --test`), Web Audio for synthesised heart sounds, GitHub Pages.

**Spec:** `docs/specs/2026-11-26-cell-run-level-1-design.md`

## Global Constraints

- Root folder is `C:\Users\USER\Desktop\body-game\`. All paths below are relative to it.
- No CDN and no runtime network requests. Phaser is loaded from `vendor/phaser.min.js`.
- Pure modules (`src/heart-model.js`, `src/geometry.js`, `src/player-physics.js`, `src/level1.js`, `src/content/landmarks.js`) must not reference `Phaser`, `window` or `document`.
- Use NZ/British spelling in all player-facing text (haemoglobin, oxygenated, centre).
- Use the spec's numbers: RA 0–8 mmHg, RV ≈ 25/4, PA ≈ 25/10. Real cycle 0.8 s (75 bpm). Time scale 1/6, so one game beat ≈ 4.8 s. Normal AV delay ≈ 0.1 s real; the broken delay is 0.
- Phase order: passive filling → atrial systole → isovolumetric contraction → ejection → isovolumetric relaxation.
- No death or game over. Mistakes push the player back.
- Controls exactly as in spec §3.1. Gamepad uses the standard mapping: A=0, X=2, View=8, Start=9, left stick = axes 0/1.
- `<meta name="robots" content="noindex">` goes on every HTML page.
- Commits: format is `Area: what changed, in plain words`, ending with the `Co-Authored-By` line. This repo has no git identity, so at the first commit step ask Jeremy once for the name and email to set **repo-local** (never `--global`). If he declines, skip the commit steps.
- Dev server: `npx -y http-server -p 8123 -c-1` run from `body-game`. It's registered as `cell-run` in `C:\Users\USER\Desktop\.claude\launch.json`, and browser checks use `preview_start {name:"cell-run"}`.

## Review Focus

1. **Tab hidden or minimised, then refocused → one huge `dt`.** Expected: no tunnelling through walls or valves and no skipped valve events. Pinned by the Task 2 large-tick test and the Task 3 dt-clamp test.
2. **Tab pressed to toggle the pressure strip.** Expected: the browser doesn't move focus out of the game. Pinned in Task 6 (preventDefault on Tab, Space and arrows; checked in the browser).
3. **Soft-lock:** the player gets pinned by a current against a closed valve or into a corner and can never progress. Expected: the level stays finishable. Pinned by the Task 5 scripted-bot completion test.
4. **Controller plugged in after load, or unplugged mid-play.** Expected: no crash, keyboard keeps working, the pad works once connected. Pinned in Task 6 (`gamepad.connected` listener plus null-safe polling; checked with simulated connect and disconnect).
5. **AV dial moved back out of range after the puzzle is solved.** Expected: solving is permanent and the dial locks. Pinned by the Task 5 state-machine test.

---

### Task 1: Scaffold and running shell

**Files:**
- Move: `index.html` → `prototype-quiz/index.html`
- Create: `package.json`, `vendor/phaser.min.js`, `index.html`, `src/main.js`, `.gitignore`
- Modify: `C:\Users\USER\Desktop\.claude\launch.json` (add `cell-run`; create the file if missing)

**Interfaces:**
- Produces: `index.html` loads `vendor/phaser.min.js` (classic script) and then `src/main.js` (module). `main.js` creates `new Phaser.Game({ type: Phaser.WEBGL, width: 1280, height: 720, backgroundColor: '#12060a', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { gamepad: true }, scene: [...] })` inside `#game`. It also includes `<div id="overlay"></div>` for the DOM screens.

- [ ] **Step 1:** Move the quiz with `git mv`, or a plain move if there's no commit yet. Create `package.json` as `{"name":"cell-run","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. `.gitignore` contains `node_modules/`.
- [ ] **Step 2:** Vendor Phaser: run `npm pack phaser@3.90.0` in the scratchpad, extract it, and copy `package/dist/phaser.min.js` to `vendor/`. Check: `head -c 200 vendor/phaser.min.js` shows a Phaser header with `3.90.0`.
- [ ] **Step 3:** Write `index.html` (noindex, viewport meta, `#game` and `#overlay`) and a `main.js` with a placeholder scene that shows the text "Cell Run".
- [ ] **Step 4:** Add the `cell-run` entry to `launch.json`, run `preview_start {name:"cell-run"}`, and check: the page shows "Cell Run" and `read_console_messages {onlyErrors:true}` is empty.
- [ ] **Step 5:** Commit: `Setup: Phaser shell for Cell Run, quiz moved to prototype-quiz`.

### Task 2: Heart model (pure)

**Files:**
- Create: `src/heart-model.js`
- Test: `tests/heart-model.test.mjs`

**Interfaces:**
- Produces:
  - `export const CYCLE_SEC = 0.8, TIME_SCALE = 1/6, NORMAL_AV_DELAY = 0.10, BROKEN_AV_DELAY = 0, AV_SOLVED_MIN = 0.06, AV_SOLVED_MAX = 0.16, AV_DIAL_MAX = 0.24`
  - `export function isAvDelaySolved(sec: number): boolean`. True when `AV_SOLVED_MIN <= sec <= AV_SOLVED_MAX`.
  - `export function createHeartModel({ avDelay = NORMAL_AV_DELAY } = {}): HeartModel`
  - `HeartModel.tick(dtGameSec: number): HeartEvent[]`
  - `HeartModel.setAvDelay(sec: number): void` (clamped to `[0, AV_DIAL_MAX]`)
  - `HeartModel.state`, which is `{ tReal, phase, pressures:{ra,rv,pa}, valves:{tricuspid:boolean, pulmonary:boolean}, atrialActive:number /*0..1*/, ventricularActive:number /*0..1*/, avDelay }`
  - `phase` is one of `'passive-filling'|'atrial-systole'|'isovolumetric-contraction'|'ejection'|'isovolumetric-relaxation'`
  - `HeartEvent` is `{type:'sa-fire'} | {type:'valve', valve:'tricuspid'|'pulmonary', open:boolean} | {type:'phase', phase}`. S1 = tricuspid close, S2 = pulmonary close.

Algorithm (the tests don't fully decide this, so it's fixed here). Real time within the cycle is `c = tReal mod 0.8`:
- **Atrium:** `atrialActive = sin(π·c/0.10)` for `c < 0.10`, otherwise 0.
- **Ventricle:** onset `vOn = 0.06 + avDelay`. `ventricularActive = sin(π·(c−vOn)/0.30)` for `0 ≤ c−vOn < 0.30`, otherwise 0.
- **RA:** `3 + 4·atrialActive`. If the tricuspid was closed on the previous tick, use `3 + 9·atrialActive` instead (cannon a wave).
- **RV:** `max(RA − 1, 2 + 23·ventricularActive)`.
- **PA:** while the pulmonary valve is open, `PA = RV − 0.5`. Otherwise it decays: `PA += (10 − PA)·(1 − e^(−dtReal/0.25))`. Start at 10.
- **Valves:** recomputed every sub-step as tricuspid = RA > RV, pulmonary = RV > PA.
- **Phase:** pulmonary open → ejection. Ventricle active with both valves shut → isovolumetric contraction (while rising) or relaxation (after ejection). Atrium active with tricuspid open → atrial systole. Otherwise passive filling.
- **Sub-stepping:** `tick` splits `dtReal` into sub-steps of at most 0.002 s real, so a large `dt` can't skip events.

- [ ] **Step 1: Write the failing tests** (simulate at `dt = 1/60` game s for 3 beats unless stated):
  - `normal cycle valve order`: the sequence of valve events, starting at the first tricuspid close, deep-equals `['T-close','P-open','P-close','T-open']` repeated.
  - `valves never open against gradient`: on every tick, `tricuspid ⇒ ra > rv` and `pulmonary ⇒ rv > pa`, for both normal and broken models.
  - `broken rhythm squeezes a shut tricuspid`: with `avDelay: 0`, some tick has `atrialActive > 0.2 && !valves.tricuspid`. With normal delay, no tick does.
  - `pressure ranges`: in the normal model after the first beat, `ra ∈ [0, 8.5]`, `max rv ∈ [23, 27]`, `min rv ≤ 6`, `min pa ∈ [8, 12]`, `max pa ≤ 27`.
  - `beat rate`: `sa-fire` count over 48 game s is 10 (±1).
  - `large tick equals many small ticks`: one `tick(4.8)` produces the same valve-event sequence as 288 ticks of `1/60`.
  - `isAvDelaySolved`: `0 → false`, `0.10 → true`, `0.20 → false`.
  - `setAvDelay clamps`: `setAvDelay(1)` gives `avDelay === 0.24`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/heart-model.js` to the interface and algorithm above.
- [ ] **Step 4:** Run `npm test`. Expected: all pass. If the range test fails, tune only the constants in the algorithm bullets, and keep them within the spec's ranges.
- [ ] **Step 5:** Commit: `Heart model: pressure-driven cardiac cycle with AV delay, tested`.

### Task 3: Collision and swim physics (pure)

**Files:**
- Create: `src/geometry.js`, `src/player-physics.js`
- Test: `tests/physics.test.mjs`

**Interfaces:**
- Produces:
  - `geometry.js`: `export function resolveCircle(x, y, r, segments: {x1,y1,x2,y2}[]): {x, y, hitNormal:{x,y}|null}`. Pushes the circle out of every segment it overlaps.
  - `player-physics.js`:
    - `export const MAX_DT = 1/30, ACCEL = 900, MAX_SWIM = 220, DRAG = 2.5, BURST_SPEED = 420, BURST_RECHARGE = 2.0, CELL_RADIUS = 18`
    - `export function createPlayer(x, y): Player`, where `Player = {x,y,vx,vy,burstCharge /*0..1*/}`
    - `export function stepPlayer(p: Player, input:{x,y,burst:boolean}, current:{x,y} /*px/s*/, segments, dt): Player`. Returns a new object.
  - `stepPlayer` clamps `dt` to `MAX_DT` and sub-steps the movement so no single move exceeds `CELL_RADIUS/2`. Movement per step is `pos += (v + current)·dt`, then `resolveCircle`, then the velocity component into `hitNormal` is removed.

- [ ] **Step 1: Write the failing tests:**
  - `resolveCircle pushes out`: a circle at `(0,5)` with r=10 against segment `(-50,0)-(50,0)` ends with `y ≥ 10`.
  - `no tunnelling at huge dt`: a player at `y=-30` moving down at 5000 px/s toward that segment, after `stepPlayer(..., dt=1)`, has `y ≤ -CELL_RADIUS + 0.01`.
  - `swim caps at MAX_SWIM`: holding input `x=1` for 3 s with zero current gives `vx ≤ 220`.
  - `burst needs charge`: two bursts 0.5 s apart; the second doesn't raise speed above `MAX_SWIM`.
  - `current carries a still player`: current `(0,300)` over 1 s with no walls moves the player down by about 300 (±10%).
- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement both modules to the interface.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `Physics: swim movement and wall collision, tested`.

### Task 4: Landmark text, checked against Jeremy's chapter

**Files:**
- Create: `src/content/landmarks.js`, `docs/accuracy-check.md`

**Interfaces:**
- Produces: `export const LANDMARKS: {id, name, scan /*one line*/, codex /*1–3 lines*/}[]`. The ids are `sa-node`, `fossa-ovalis`, `pectinate`, `coronary-sinus`, `av-node`, `svc`, `ivc`, `tricuspid`, `chordae`, `papillary`, `moderator-band`, `infundibulum`, `pulmonary-valve`. Also `export const SOLVE_NOTES = { avFixed, cannonWave, s1, s2, lungsArrival }`, each one line.

- [ ] **Step 1:** Write the entries, starting from the spec §2 table and §2.3–2.5 wording.
- [ ] **Step 2:** Read `C:\Users\USER\Desktop\inkling-worker\out\heart-anatomy-ch-4\giga-map.json`. For each entry, record in `docs/accuracy-check.md` one of `matches chapter` (with the concept it matched), `not in chapter – standard A&P`, or `conflicts – <what>`.
- [ ] **Step 3:** Fix any conflicts. List the `not in chapter` items for Jeremy in the hand-over. Don't guess.
- [ ] **Step 4:** Commit: `Content: landmark text with accuracy check against heart chapter`.

### Task 5: Level 1 layout, currents and part state machine (pure)

**Files:**
- Create: `src/level1.js`
- Test: `tests/level1.test.mjs`

**Interfaces:**
- Consumes: `createHeartModel`, `isAvDelaySolved` (Task 2), `stepPlayer`, `createPlayer` (Task 3), landmark ids (Task 4).
- Produces:
  - `export const WORLD = { width: 1800, height: 2600 }` and `export const SPAWN = {x, y}`, where SPAWN is the SVC mouth at the top left.
  - `export const WALLS: {x1,y1,x2,y2}[]`. A static chamber outline: patient's right on screen left, the RA occupying y 0–1000, the tricuspid annulus near y 1050, the RV at y 1100–2400, and the infundibulum rising up the right side to the pulmonary valve near (1500, 900).
  - `export const VALVES: { tricuspid: seg[], pulmonary: seg[] }`. Solid only when the model says closed.
  - `export const LANDMARK_SPOTS: {id, x, y, r}[]`. Every id from Task 4, placed in its real anatomical position (SA node at the SVC–RA junction, AV node in the RA floor near the coronary sinus opening, the moderator band crossing the RV from septum to anterior wall).
  - `export const CURRENT_UNIT = 300` (px/s).
  - `export function currentAt(x, y, heart: HeartModel['state']): {x, y}`. Units: in the RA, downward toward the tricuspid at 1.0 during the first 0.15 s real after the tricuspid opens (early rapid filling), 0.3 otherwise while open, and 0.7 during atrial systole with the valve open. Whenever `atrialActive > 0.2 && !tricuspid`, there's an upward backwash of 1.5 over the whole RA (the gameplay exaggeration of the cannon wave, named in `SOLVE_NOTES.cannonWave`). In the RV: 1.6 toward the pulmonary valve inside the infundibulum during ejection, and 0.4 toward it elsewhere in the RV. 0.2 downward while the tricuspid is open.
  - `export function segmentsFor(heart): seg[]`, which is WALLS plus the closed valves.
  - `export function createLevelState(): LevelState`, where `LevelState = { part: 'arrival'|'broken-door'|'timing-door'|'rv-climb'|'complete', avFixed: boolean, scanned: Set<string> }`.
  - `export function updateLevel(ls, player, heart, actions:{use:boolean, dial:number /* -1|0|1 step */, setDial?:number /* absolute, from the DOM slider */}): {ls, events: string[]}`. Parts move on: arrival → broken-door after the first `use` near any landmark or after 20 s. Broken-door → timing-door when the player confirms at the AV node with `isAvDelaySolved`, which sets `avFixed` and locks the dial. Timing-door → rv-climb when the player's y is below the tricuspid. Rv-climb → complete when the player is past the pulmonary valve. Events include `'scan:<id>'`, `'av-fixed'` and `'part:<name>'`.
  - The model starts at `BROKEN_AV_DELAY`. A dial step (±0.01) or `setDial` changes avDelay only while within 80 px of `av-node` and not yet `avFixed`.

- [ ] **Step 1: Write the failing tests:**
  - `broken heart blocks the atrium`: with avDelay 0, some sampled RA point has an upward current during atrial systole. With 0.10, no RA sample ever has an upward current.
  - `landmarks inside world and not inside walls`: for each spot, `resolveCircle` with r=5 doesn't move it.
  - `dial locks after solve`: dial to 0.10 and confirm, so `avFixed`. Then dial -1 ten times and avDelay is still 0.10.
  - `scripted bot completes the level` (soft-lock guard): a bot steers toward a waypoint list (SPAWN → AV node → tricuspid → RV floor → infundibulum → past the pulmonary valve) at `dt=1/60`. It presses `use` at the AV node with a dial set to 0.10 and only crosses each valve when it's open. It reaches `complete` within 180 game s.
  - `bot can't pass while broken`: the same bot without fixing the AV delay hasn't got below the tricuspid after 60 game s.
- [ ] **Step 2:** Run `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement `level1.js`. Tune the geometry and current strengths only until both bot tests pass, then record the final numbers in a comment at the top of the file.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `Level 1: right-heart layout, currents and puzzle states, bot-tested`.

### Task 6: Playable greybox scene, with input and camera

**Files:**
- Create: `src/input.js`, `src/scenes/game-scene.js`
- Modify: `src/main.js` (register `GameScene`)

**Interfaces:**
- Consumes: Tasks 2, 3 and 5.
- Produces:
  - `input.js`: `export function createInput(scene): { poll(): {x, y, burst, use, dialLeft, dialRight, toggleStrip, pause} }`. Edge-triggered for burst, use, toggle and pause. Keyboard and gamepad are merged, with a stick deadzone of 0.2. Dial = left/right while the dial is open. It calls `preventDefault` for Tab, Space and the arrows. It's null-safe when there's no pad and listens for `gamepad.connected`.
  - `GameScene` (key `'game'`) owns `heart`, `player`, `levelState`. Its update order each frame is `dt = min(delta/1000, MAX_DT)` → `heart.tick(dt)` → `currentAt` → `stepPlayer` → `updateLevel`. It emits Phaser events `'heart'`, `'level-event'` and `'valve'` for the render, UI and audio modules.
  - The camera follows the player with lerp 0.08 and is bounded to `WORLD`.
  - Greybox drawing: walls as lines, valves red when closed and green when open, a circle for the player, dots for landmarks.

- [ ] **Step 1:** Implement both files.
- [ ] **Step 2:** Browser check at 1366×768. Play from SVC to the AV node, fix the delay (a temporary keyboard dial is fine until Task 8 adds the DOM dial), get through the tricuspid, climb and exit. Expected: you reach `complete` and the console has no errors.
- [ ] **Step 3:** Simulate a gamepad via `javascript_tool` by overriding `navigator.getGamepads` to return a standard-mapping pad with axis 0 = 1, then dispatching `gamepadconnected`. Expected: the player moves right. Return `[]` afterwards. Expected: no exception, and the keyboard still works.
- [ ] **Step 4:** Press Tab in the browser. Expected: `document.activeElement` is still the game canvas or body.
- [ ] **Step 5:** Commit: `Game: playable greybox of level 1 with keyboard and controller`.

### Task 7: The look (2.5D)

**Files:**
- Create: `src/render/background.js`, `src/render/walls.js`, `src/render/particles.js`, `src/render/cell.js`
- Modify: `src/scenes/game-scene.js` (swap the greybox for these modules)

**Interfaces:**
- Consumes: the `'heart'` event / `heart.state`, `WALLS`, `VALVES`, `WORLD`.
- Produces: each module exports `create<Name>(scene)` and returns `{ update(heartState, player) }`. Read-only with respect to the model.
  - `background`: 3 parallax layers (scroll factors 0.2, 0.45 and 0.75) built from textures generated with `Graphics.generateTexture` (soft blobs and strands, dark red to plum), plus a deep red radial glow. Brightness pulses with `ventricularActive`.
  - `walls`: filled organic polygons along `WALLS`, with a gradient fill and an inner rim highlight (wet sheen). They scale ±2% around the chamber centre with `atrialActive` (RA) and `ventricularActive` (RV). Valve leaflets are drawn as curved flaps that swing open or shut.
  - `particles`: plasma motes driven by `currentAt` (visible flow) and foreground blurred strands at scroll factor 1.3.
  - `cell`: a biconcave disc (rim lighter than the centre) in plum `#6b2a55`, with `setColour(hex)` for the final bright red `#e0242f`. A soft bloom via `postFX.addGlow` when WebGL is available.
  - The SA node flashes for 150 ms real-time-scaled on `sa-fire`.

- [ ] **Step 1:** Implement the four modules and wire them in.
- [ ] **Step 2:** Browser check at 1920×1080 and 1366×768. Take screenshots in the RA, the RV and during ejection. Measure fps with `javascript_tool` (`game.loop.actualFps` sampled over 5 s). Expected: ≥ 55 fps.
- [ ] **Step 3:** Commit: `Look: parallax layers, wet organic walls, flow particles, pulsing heart`.

### Task 8: Interface: scans, AV dial, pressure strip, codex, start and end screens

**Files:**
- Create: `src/ui/labels.js`, `src/ui/pressure-strip.js`, `src/ui/overlay.js`, `src/ui/overlay.css`
- Modify: `index.html` (link the CSS), `src/scenes/game-scene.js`

**Interfaces:**
- Consumes: `LANDMARKS`, `SOLVE_NOTES`, `'level-event'`, `heart.state`.
- Produces:
  - `labels`: on `scan:<id>`, the landmark name and its one-line scan text fade in near the spot for 4 s. A small "E / X to scan" prompt appears within 80 px of an unscanned spot.
  - `pressure-strip`: a camera-fixed strip, 1280×110, at the top. It shows the last 2 cycles of RA (blue), RV (purple) and, from rv-climb on, PA (orange), with the y-axis running 0–30 mmHg. Valve icons flip at the crossings. Toggled by Tab or View.
  - `overlay.js`, which is DOM:
    - `showStart()`: title, a one-paragraph "What is this?", the controls table and a Start button (it also responds to Enter or A).
    - `showAvDial(value, onChange, onConfirm)`: a slider labelled "AV node delay", 0–0.24 s, with the readout scaled to real seconds. Out-of-range messages: `<0.06` "Atria and ventricles still overlapping", `>0.16` "Too slow: like first-degree heart block".
    - `showPause(codexEntries)`
    - `showComplete(scannedCount, total)`
- Solve flow: on `av-fixed`, show `SOLVE_NOTES.avFixed` and `SOLVE_NOTES.cannonWave`. On the first tricuspid close after timing-door begins, show `SOLVE_NOTES.s1`. On the pulmonary close at the exit, show `SOLVE_NOTES.s2`, then turn the cell red and show `SOLVE_NOTES.lungsArrival`.

- [ ] **Step 1:** Implement the modules.
- [ ] **Step 2:** Browser check: play the full level using only the DOM dial. Toggle the strip and confirm the lines cross exactly when the valve icons flip. Open pause and see the codex list. Complete the level. Expected: no console errors and every overlay is readable at 1366×768.
- [ ] **Step 3:** Commit: `Interface: scans, AV dial, pressure strip, codex and start/end screens`.

### Task 9: Heartbeat sound, with 3 versions for Jeremy

**Files:**
- Create: `src/audio.js`, `sound-test.html`
- Modify: `src/scenes/game-scene.js`

**Interfaces:**
- Produces: `export function createAudio(variant: 'a'|'b'|'c'): { s1(), s2(), setFlow(level0to1), resume() }`, all Web Audio synthesis with no files.
  - **a:** sine thump. S1 at 55 Hz, 180 ms. S2 at 75 Hz, 110 ms.
  - **b:** low-pass filtered noise thud with the same durations.
  - **c:** a layered mix of a and b.
  - Ambient flow is filtered brown noise whose gain follows the current strength.
- The variant is chosen by `?sound=a|b|c` or `localStorage['cellrun-sound']`, defaulting to `a`. `resume()` is called on the first user gesture.
- `sound-test.html` has three buttons that each play "lub-dub ×3 at game speed", with a note: "Pick the one that sounds most like a heart."

- [ ] **Step 1:** Implement, wiring tricuspid close to `s1()` and pulmonary close to `s2()`.
- [ ] **Step 2:** Browser check: `sound-test.html` loads with no errors, and the game logs no AudioContext warnings after a click.
- [ ] **Step 3:** Ask Jeremy to open `sound-test.html` and pick a, b or c. Set the default to his pick.
- [ ] **Step 4:** Commit: `Sound: lub-dub heartbeat, Jeremy's pick as default`.

### Task 10: Tuning pass, tablet touch and publishing

**Files:**
- Create: `src/ui/touch.js`, `README.md`
- Modify: `src/input.js` (merge the touch input), constants in `src/level1.js` / `src/player-physics.js` only if the playthrough needs it

**Interfaces:**
- Produces: `touch.js` exports `createTouchControls(overlayEl): { state(): {x, y, burst, use} }`. Only shown when `matchMedia('(pointer: coarse)').matches`. It's a left-thumb virtual stick plus Burst and Scan buttons.

- [ ] **Step 1:** Do a full timed playthrough in the browser. Expected: 10–15 min with scanning, or about 5 min rushing. If it's outside that, adjust the RA/RV size or current strengths, then re-run `npm test` (the bot tests must still pass).
- [ ] **Step 2:** Implement touch and check at a tablet viewport (`resize_window` 1200×1920 and 1920×1200). Expected: the stick moves the cell and nothing is clipped. Reset with preset desktop.
- [ ] **Step 3:** Write `README.md`: what it is, the controls, how to run it locally, and the test command.
- [ ] **Step 4:** Publish under Jeremy's standing OK: `gh repo create jeremyspm/cell-run --public --source . --push`, then enable Pages from `main` / root. Check: fetch `https://jeremyspm.github.io/cell-run/` in the browser pane. Expected: the start screen loads and the console has no errors. If gh auth or Pages fails, stop and report the exact error.
- [ ] **Step 5:** Hand over to Jeremy:
  - the link
  - what was verified
  - what wasn't: a real controller, fun, and on-device tablet feel
  - the `not in chapter` content items from Task 4
