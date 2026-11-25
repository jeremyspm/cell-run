import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeartModel, BROKEN_AV_DELAY, NORMAL_AV_DELAY } from '../src/heart-model.js';
import { resolveCircle } from '../src/geometry.js';
import { createPlayer, stepPlayer } from '../src/player-physics.js';
import { LANDMARKS } from '../src/content/landmarks.js';
import {
  WORLD, SPAWN, WALLS, LANDMARK_SPOTS, TRICUSPID_Y, currentAt, segmentsFor, inRA,
  createLevelState, updateLevel,
} from '../src/level1.js';

const DT = 1 / 60;

test('broken heart blocks the atrium', () => {
  const samples = [];
  for (let x = 260; x <= 940; x += 120) for (let y = 220; y <= 960; y += 120) samples.push({ x, y });
  const upward = avDelay => {
    const h = createHeartModel({ avDelay }); let up = false;
    for (let t = 0; t < 4.8 * 3; t += DT) { h.tick(DT); for (const p of samples) if (currentAt(p.x, p.y, h.state).y < -1) up = true; }
    return up;
  };
  assert.equal(upward(BROKEN_AV_DELAY), true);
  assert.equal(upward(NORMAL_AV_DELAY), false);
});

test('landmarks: every id placed, inside world, not inside walls', () => {
  for (const l of LANDMARKS) assert.ok(LANDMARK_SPOTS.find(s => s.id === l.id), `missing spot ${l.id}`);
  for (const s of LANDMARK_SPOTS) {
    assert.ok(s.x > 0 && s.x < WORLD.width && s.y > 0 && s.y < WORLD.height, s.id);
    const r = resolveCircle(s.x, s.y, 5, WALLS);
    assert.ok(Math.abs(r.x - s.x) < 1e-6 && Math.abs(r.y - s.y) < 1e-6, `${s.id} inside a wall`);
  }
});

test('dial locks after solve', () => {
  const heart = createHeartModel({ avDelay: BROKEN_AV_DELAY });
  const av = LANDMARK_SPOTS.find(s => s.id === 'av-node');
  const player = createPlayer(av.x, av.y);
  let ls = createLevelState();
  ls = updateLevel(ls, player, heart, { use: true, dial: 0, dt: DT }).ls;           // scan the AV node
  ls = updateLevel(ls, player, heart, { use: false, dial: 0, setDial: 0.10, dt: DT }).ls;
  const r = updateLevel(ls, player, heart, { use: true, dial: 0, dt: DT });          // confirm
  ls = r.ls;
  assert.ok(ls.avFixed); assert.ok(r.events.includes('av-fixed'));
  for (let i = 0; i < 10; i++) ls = updateLevel(ls, player, heart, { use: false, dial: -1, dt: DT }).ls;
  ls = updateLevel(ls, player, heart, { use: false, dial: 0, setDial: 0, dt: DT }).ls;
  assert.equal(heart.state.avDelay, 0.10);
});

// A simple bot: steer at waypoints, wait below each valve until it opens.
function runBot({ fix, seconds }) {
  const heart = createHeartModel({ avDelay: BROKEN_AV_DELAY });
  let p = createPlayer(SPAWN.x, SPAWN.y);
  let ls = createLevelState();
  const av = LANDMARK_SPOTS.find(s => s.id === 'av-node');
  const route = [
    { x: 930, y: 300 }, { x: 930, y: 900 }, ...(fix ? [{ x: av.x, y: av.y, act: 'fix' }] : []),
    { x: 650, y: 960, gate: 'tricuspid' }, { x: 650, y: 1300 }, { x: 900, y: 1500 },
    { x: 1400, y: 1150 }, { x: 1400, y: 770, gate: 'pulmonary' }, { x: 1400, y: 450 },
  ];
  let w = 0, fixStage = 0, maxY = -Infinity;
  for (let t = 0; t < seconds; t += DT) {
    heart.tick(DT);
    const wp = route[Math.min(w, route.length - 1)];
    let dx = wp.x - p.x, dy = wp.y - p.y; const d = Math.hypot(dx, dy);
    const actions = { use: false, dial: 0, dt: DT };
    if (wp.act === 'fix' && d < 40) {
      if (fixStage === 0) { actions.use = true; fixStage = 1; }
      else if (fixStage === 1) { actions.setDial = 0.10; fixStage = 2; }
      else if (fixStage === 2) { actions.use = true; fixStage = 3; }
      else w++;
    } else if (d < 40) {
      if (!wp.gate || heart.state.valves[wp.gate]) w++;
    }
    if (wp.gate && d < 40 && heart.state.valves[wp.gate]) { dy = 1000 * (wp.gate === 'tricuspid' ? 1 : -1); dx = 0; }
    const m = Math.hypot(dx, dy) || 1;
    p = stepPlayer(p, { x: dx / m, y: dy / m, burst: false }, currentAt(p.x, p.y, heart.state), segmentsFor(heart.state), DT);
    ls = updateLevel(ls, p, heart, actions).ls;
    maxY = Math.max(maxY, p.y);
    if (ls.part === 'complete') return { ls, t, maxY };
  }
  return { ls, t: seconds, maxY };
}

test('scripted bot completes the level', () => {
  const r = runBot({ fix: true, seconds: 180 });
  assert.equal(r.ls.part, 'complete', `stuck in ${r.ls.part}`);
});

test('bot cannot pass while broken', () => {
  const r = runBot({ fix: false, seconds: 60 });
  assert.ok(r.maxY < TRICUSPID_Y, `got to y ${r.maxY}`);
});

test('arrival moves on after 20 s', () => {
  const heart = createHeartModel({ avDelay: BROKEN_AV_DELAY });
  let ls = createLevelState(); const p = createPlayer(SPAWN.x, SPAWN.y);
  for (let t = 0; t < 21; t += DT) ls = updateLevel(ls, p, heart, { use: false, dial: 0, dt: DT }).ls;
  assert.equal(ls.part, 'broken-door');
  assert.ok(inRA(SPAWN.x, SPAWN.y + 200));
});
