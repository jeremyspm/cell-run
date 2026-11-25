# Cell Run: Level 1 "Out of Sync"

A side-on swim-and-puzzle game where you play a red blood cell going through the right side of the heart. The level *is* the anatomy: you scan landmarks as you swim past them. The puzzles *are* the physiology: valves open only when the pressure behind them is higher, and you fix a broken rhythm by setting the AV node's delay.

Made as a study tool for first-year nursing A&P. It takes about 10 minutes. It works offline once loaded, and nothing is saved or sent anywhere.

## Controls

| Action | Keyboard | Controller |
|---|---|---|
| Swim | WASD / arrows | Left stick |
| Burst | Space | A |
| Scan / use | E | X |
| Pressure strip | Tab | View |
| Pause and codex | Esc | Start |

On a touch screen, an on-screen stick and buttons appear.

## Sound

`sound-test.html` plays six heartbeat styles: three synthesised (A–C) and three real recordings (D–F). The one you pick is remembered on that device. You can also force one with `?sound=a` to `?sound=f`.

The recordings come from Wikimedia Commons and are credited in [audio/CREDITS.md](audio/CREDITS.md):
- D: Emily Hope, CC BY-SA 4.0
- E: Wilfredor, CC0
- F: Benboncan via Freesound, CC BY 3.0

## Run it locally

```
node tools/serve.mjs 8123
```

Then open http://localhost:8123. It needs a local server because ES modules don't load from a double-clicked file.

## Tests

```
npm test
```

The tests cover the heart model (valve order, pressures, no chatter), swim physics, and a scripted bot that has to finish the level, and must *not* get past the tricuspid while the rhythm is still broken.

## Files

- `src/heart-model.js`: the cardiac cycle. Valves open purely from pressure comparisons.
- `src/level1.js`: layout, currents and puzzle states.
- `src/content/landmarks.js`: every scan and codex line. They're checked against the course's heart chapter in `docs/accuracy-check.md`.
- `src/render/`, `src/ui/`, `src/audio.js`: the visuals, interface and sound. They only *read* the model.
- `docs/specs`, `docs/plans`: the design spec and build plan.
- `prototype-quiz/`: the earlier quiz-style prototype.
