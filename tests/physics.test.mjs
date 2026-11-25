import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCircle } from '../src/geometry.js';
import { createPlayer, stepPlayer, CELL_RADIUS, MAX_SWIM } from '../src/player-physics.js';

const floor = [{ x1: -50, y1: 0, x2: 50, y2: 0 }];
const still = { x: 0, y: 0, burst: false };
const none = { x: 0, y: 0 };

test('resolveCircle pushes out', () => {
  const r = resolveCircle(0, 5, 10, floor);
  assert.ok(r.y >= 10 - 1e-9, `y ${r.y}`);
  assert.ok(r.hitNormal);
});

test('no tunnelling at huge dt', () => {
  const p = { ...createPlayer(0, -30), vy: 5000 };
  const q = stepPlayer(p, still, none, floor, 1);
  assert.ok(q.y <= -CELL_RADIUS + 0.01, `y ${q.y}`);
});

test('swim caps at MAX_SWIM', () => {
  let p = createPlayer(0, 0);
  for (let i = 0; i < 180; i++) p = stepPlayer(p, { x: 1, y: 0, burst: false }, none, [], 1 / 60);
  assert.ok(p.vx <= MAX_SWIM + 1e-6, `vx ${p.vx}`);
  assert.ok(p.vx > MAX_SWIM * 0.9);
});

test('burst needs charge', () => {
  let p = createPlayer(0, 0);
  p = stepPlayer(p, { x: 1, y: 0, burst: true }, none, [], 1 / 60);
  for (let i = 0; i < 30; i++) p = stepPlayer(p, { x: 1, y: 0, burst: false }, none, [], 1 / 60);
  const before = Math.hypot(p.vx, p.vy);
  p = stepPlayer(p, { x: 1, y: 0, burst: true }, none, [], 1 / 60);
  assert.ok(Math.hypot(p.vx, p.vy) <= Math.max(before, MAX_SWIM) + 1e-6);
});

test('current carries a still player', () => {
  let p = createPlayer(0, 0);
  for (let i = 0; i < 60; i++) p = stepPlayer(p, still, { x: 0, y: 300 }, [], 1 / 60);
  assert.ok(Math.abs(p.y - 300) <= 30, `y ${p.y}`);
});

test('stepPlayer returns a new object', () => {
  const p = createPlayer(0, 0);
  const q = stepPlayer(p, still, none, [], 1 / 60);
  assert.notEqual(p, q);
});
