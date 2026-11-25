# Cell Run — Level 1 "Out of Sync" — Design Spec

Date: 26 November 2026 · Status: awaiting Jeremy's review · Path: architectural (new project)

## 1. Purpose

A real-time, side-on 2.5D exploration-and-puzzle game. You play a red blood cell inside the heart. It's an original game, not a copy of any existing one.

- **Goal (agreed answer C):** it has to be fun enough to play for its own sake, and every core mechanic has to be accurate first-year nursing physiology.
- **The principle:** the environment *is* the anatomy (you learn where things are by being there), and the puzzles *are* the physiology (you can't solve one without understanding the mechanism).
- **Not for:** long name lists (those stay in flashcards), combat, or the whole body.
- **This spec covers one level only**, as a proof of concept. More levels get built only if playing this one actually helps Jeremy learn.

### What Jeremy said vs what was assumed
- **Said:** a real video game, not a quizzer. PC first, with keyboard and controller. The tablet (Lenovo Legion Y700) is a bonus. Use whatever looks best. Keep the spec small. Answer C. No combat; calm, detailed exploration and puzzles. Side-on 2.5D was agreed as the compromise between 2D and 3D. Modding an existing game was considered and rejected.
- **Assumed:** published on GitHub Pages under `jeremyspm` with `noindex`. No accounts, nothing saved to a server. NZ spelling throughout.

## 2. Level design: "Out of Sync" (right heart, 10–15 min)

**Premise:** you arrive as a dark, deoxygenated red blood cell. The heart's rhythm is broken: the atria and ventricles contract at the same moment. You can't leave the right atrium until you fix it.

### 2.1 Core rules
- **Swimming, not platforming.** Blood is moved by pressure, not gravity. Currents push the cell, and the player adds limited thrust plus a recharging **burst**.
- **The live heartbeat is the level's clock.** It's slowed about 6× from real time (one beat ≈ 5 s at a real 75 bpm). Walls squeeze, currents surge and valves open or shut on that clock.
- **There is no death or game over.** Mistakes push you back a short way.

### 2.2 Part 1 — Arrival (anatomy by exploring)
You enter from the **superior vena cava** into the right atrium. The **inferior vena cava** opening is visible too. There are scannable landmarks, and each scan gives one line plus a codex entry:

| Landmark | One-line scan text (draft, gets checked in §5) |
|---|---|
| SA node | The heart's pacemaker. Sits in the right atrial wall where the superior vena cava joins, and fires to start each beat. |
| Fossa ovalis | A shallow dent in the interatrial septum. It's what's left of the foramen ovale, which let blood bypass the lungs before birth. |
| Pectinate muscles | Comb-like muscle ridges lining the right auricle. |
| Coronary sinus opening | Where blood that has supplied the heart muscle itself drains back into the right atrium. |
| AV node | Sits in the floor of the right atrium near the coronary sinus opening. It delays the signal so the atria finish emptying before the ventricles contract. |

### 2.3 Part 2 — The broken door (main puzzle)
- **What's wrong:** the atria and ventricles contract together. When the atrium squeezes, the tricuspid is already shut, so the push goes nowhere and backwash surges up the venae cavae. (This is real: with atrioventricular dissociation the atrium contracts against a closed tricuspid and causes "cannon a waves" in the JVP. A one-line note explains this when the puzzle is solved.)
- **The fix:** the player finds the AV node and adjusts its **delay**. In-game this is a dial operated with the scan/use button.
- **What counts as solved:** the delay sits in a range where the atrium finishes contracting before the ventricle starts. The rhythm locks into **squeeze → pause → slam**.

### 2.4 Part 3 — The timing door (using the fix)
To get through the tricuspid, the player reads the cycle:
- **Ventricle relaxed (passive filling):** the valve is open and a gentle current pulls you down. Most ventricular filling happens in this phase.
- **Atrial systole (the "atrial kick"):** a strong boost through the valve. It's the final top-up.
- **Isovolumetric contraction:** ventricular pressure rises above atrial pressure, so the tricuspid slams shut. The player hears S1 ("lub") and bounces off the closed valve.

### 2.5 Part 4 — Right ventricle (the climb out)
- You swim through the **chordae tendineae** (cords) and **papillary muscles** (pillars). They tighten when the ventricle contracts and stop the tricuspid cusps flipping back into the atrium.
- You pass the **moderator band** (septomarginal trabecula), which carries part of the right bundle branch.
- **The puzzle:** reach the **outflow tract (infundibulum / conus arteriosus)** before the next contraction. During **ejection** the pulmonary valve opens because RV pressure is above pulmonary artery pressure, and the current blasts you through. Miss it and you wait for the next beat.
- **The ending:** the pulmonary valve shuts behind you with S2 ("dub") and the lungs come into view. Level complete screen showing codex progress.

### 2.6 Learning layer
- **Pressure strip** (toggle): live RA and RV pressure lines, plus the PA line in Part 4. A valve icon flips wherever two lines cross. It's a simplified Wiggers diagram.
- **Codex:** every scanned landmark, reviewable from the pause menu.

## 3. Feel, look and sound

### 3.1 Controls
| Action | Keyboard | Controller (standard mapping) |
|---|---|---|
| Swim | WASD / arrows | Left stick |
| Burst (recharges) | Space | A |
| Scan / use | E | X |
| Pressure strip | Tab | View/Select |
| Pause and codex | Esc | Start |

- Movement is weighted, with eased acceleration and drag, and currents add to it.
- On the tablet, simple on-screen touch controls appear when touch is detected. Nothing is designed around touch.

### 3.2 Look
- Smooth, glowing, organic art generated in code. No pixel art, no outside art packs, because no good free packs of the inside of a heart exist.
- Dark bioluminescent "deep-sea" mood: wet sheen on the walls, soft glow, floating particles.
- **2.5D depth:** 3–4 parallax layers, from blurred foreground strands to the play wall, the far wall and a deep red glow.
- Walls bulge and squeeze in time with the cycle. The SA node flashes just before each beat.
- The player is a biconcave disc, dark plum, that turns bright red at the lungs in the final shot.
- Scan labels fade in cleanly and never cover the play area for long.

### 3.3 Sound
- Heartbeat: S1 when the tricuspid closes, S2 when the pulmonary valve closes. Plus a low ambient flow sound.
- **2–3 heartbeat versions** get rendered for Jeremy to pick by ear before the PoC is called done.

## 4. Architecture

- Phaser 3, with a local vendored copy (no CDN). Plain ES modules, no build step. It runs from a local static server or GitHub Pages; ES modules don't load from a double-clicked `file://`.
- Folder: `Desktop\body-game\`. The earlier quiz prototype (`index.html`) moves to `prototype-quiz\index.html`.

| Unit | Does | Depends on |
|---|---|---|
| `src/heart-model.js` | The cardiac cycle: phase timing, RA/RV/PA pressure curves, valve states from pressure comparisons alone, the AV delay setting. No graphics. | nothing |
| `src/level1.js` | Room layout, wall shapes, landmark positions, current zones, triggers, part sequencing. | heart-model |
| `src/player.js` | Swimming physics, burst, keyboard + Gamepad input. | level1 (currents) |
| `src/render/*.js` | Parallax layers, walls, glow, particles, pulsing. Only reads the model. | heart-model, level1 |
| `src/ui.js` | Pressure strip, scan labels, codex, pause, completion screen. | heart-model |
| `src/audio.js` | S1/S2 and ambience, triggered by valve events. | heart-model events |
| `src/content/landmarks.js` | All scan and codex text in one place. | nothing |

**Data flow (one way):** heart-model ticks → emits phase and valve events → level applies currents → player moves → render, UI and audio react.

**Model numbers (simplified, ordered correctly):**
- RA about 0–8 mmHg
- RV about 25/4 mmHg
- PA about 25/10 mmHg
- Phase order: passive filling → atrial systole → isovolumetric contraction → ejection → isovolumetric relaxation
- The normal AV delay is scaled from a real value of about 0.1 s
- The broken state has the delay at about 0, so atrial and ventricular systole overlap

## 5. Accuracy checks
- Every landmark line and puzzle explanation gets checked against Jeremy's heart chapter (`Desktop\inkling-worker\out\heart-anatomy-ch-4\giga-map.json`) and standard first-year A&P. Anything the chapter doesn't cover gets flagged to Jeremy rather than guessed.
- Nothing about patients is included.

## 6. Testing
- **Automated tests for heart-model (run in Node):**
  - Over a normal cycle, valve events come in the order tricuspid open → close (S1) → pulmonary open → close (S2) → tricuspid open.
  - A valve is never open while downstream pressure is higher than upstream pressure.
  - In the broken state, atrial systole overlaps a closed tricuspid.
- **Played through by Claude in the browser** at 1920×1080 and 1366×768:
  - the level can be finished
  - no soft-locks
  - a steady frame rate
  - controller input tested with simulated Gamepad signals
- **Not covered by Claude:** a real physical controller, and whether it's fun. Jeremy checks both.

## 7. Done means
1. Level 1 plays start to finish in 10–15 min with all four parts.
2. It looks as described in §3.2.
3. The model tests pass and every piece of text has been checked against the chapter.
4. Jeremy has picked the heartbeat sound.
5. It's published to a `jeremyspm` GitHub Pages repo with `noindex`, plus a short "what is this?" note on the start screen.

## 8. Out of scope
Combat. The left heart, the lungs and other organs. Disease bosses. Save files. Voice-over. Real 3D. A content pipeline for other chapters. Explainer videos.
