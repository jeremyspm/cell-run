import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeartModel, isAvDelaySolved, BROKEN_AV_DELAY } from '../src/heart-model.js';

const DT = 1 / 60;
function run(model, seconds, dt = DT) {
  const ticks = []; const events = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    for (const e of model.tick(dt)) events.push(e);
    const s = model.state;
    ticks.push({ ...s, pressures: { ...s.pressures }, valves: { ...s.valves } });
  }
  return { ticks, events };
}
const valveSeq = evs => evs.filter(e => e.type === 'valve').map(e => (e.valve === 'tricuspid' ? 'T' : 'P') + (e.open ? '-open' : '-close'));

test('normal cycle valve order', () => {
  const { events } = run(createHeartModel(), 4.8 * 3);
  const seq = valveSeq(events);
  const start = seq.indexOf('T-close');
  assert.ok(start >= 0);
  const cycle = seq.slice(start, start + 8);
  assert.deepEqual(cycle, ['T-close', 'P-open', 'P-close', 'T-open', 'T-close', 'P-open', 'P-close', 'T-open']);
});

test('valves never open against gradient', () => {
  for (const avDelay of [0.10, BROKEN_AV_DELAY]) {
    const { ticks } = run(createHeartModel({ avDelay }), 4.8 * 3);
    for (const s of ticks) {
      if (s.valves.tricuspid) assert.ok(s.pressures.ra > s.pressures.rv, `tricuspid open with ra ${s.pressures.ra} rv ${s.pressures.rv}`);
      if (s.valves.pulmonary) assert.ok(s.pressures.rv > s.pressures.pa, `pulmonary open with rv ${s.pressures.rv} pa ${s.pressures.pa}`);
    }
  }
});

test('broken rhythm squeezes a shut tricuspid', () => {
  const broken = run(createHeartModel({ avDelay: 0 }), 4.8 * 3).ticks;
  assert.ok(broken.some(s => s.atrialActive > 0.2 && !s.valves.tricuspid));
  const normal = run(createHeartModel(), 4.8 * 3).ticks;
  assert.ok(!normal.some(s => s.atrialActive > 0.2 && !s.valves.tricuspid));
});

test('pressure ranges', () => {
  const ticks = run(createHeartModel(), 4.8 * 3).ticks.slice(Math.ceil(4.8 / DT));
  const ra = ticks.map(s => s.pressures.ra), rv = ticks.map(s => s.pressures.rv), pa = ticks.map(s => s.pressures.pa);
  assert.ok(Math.min(...ra) >= 0 && Math.max(...ra) <= 8.5, `ra ${Math.min(...ra)}..${Math.max(...ra)}`);
  assert.ok(Math.max(...rv) >= 23 && Math.max(...rv) <= 27, `rv max ${Math.max(...rv)}`);
  assert.ok(Math.min(...rv) <= 6, `rv min ${Math.min(...rv)}`);
  assert.ok(Math.min(...pa) >= 8 && Math.min(...pa) <= 12, `pa min ${Math.min(...pa)}`);
  assert.ok(Math.max(...pa) <= 27, `pa max ${Math.max(...pa)}`);
});

test('beat rate', () => {
  const fires = run(createHeartModel(), 48).events.filter(e => e.type === 'sa-fire').length;
  assert.ok(Math.abs(fires - 10) <= 1, `fires ${fires}`);
});

test('phases follow the spec order', () => {
  const evs = run(createHeartModel(), 4.8 * 3).events.filter(e => e.type === 'phase').map(e => e.phase);
  const order = ['passive-filling', 'atrial-systole', 'isovolumetric-contraction', 'ejection', 'isovolumetric-relaxation'];
  const i = evs.indexOf('atrial-systole');
  assert.deepEqual(evs.slice(i, i + 5), [...order.slice(1), order[0]]);
});

test('large tick equals many small ticks', () => {
  const a = createHeartModel(); const big = valveSeq(a.tick(4.8));
  const small = valveSeq(run(createHeartModel(), 4.8).events);
  assert.deepEqual(big, small);
});

test('isAvDelaySolved', () => {
  assert.equal(isAvDelaySolved(0), false);
  assert.equal(isAvDelaySolved(0.10), true);
  assert.equal(isAvDelaySolved(0.20), false);
});

test('setAvDelay clamps', () => {
  const m = createHeartModel(); m.setAvDelay(1);
  assert.equal(m.state.avDelay, 0.24);
});

test('no valve chatter: one tricuspid close and one pulmonary close per beat', () => {
  for (const avDelay of [0.10, BROKEN_AV_DELAY]) {
    const evs = run(createHeartModel({ avDelay }), 4.8 * 5).events;
    const tClose = evs.filter(e => e.type === 'valve' && e.valve === 'tricuspid' && !e.open).length;
    const pClose = evs.filter(e => e.type === 'valve' && e.valve === 'pulmonary' && !e.open).length;
    assert.ok(tClose <= 5 && pClose <= 5, `avDelay ${avDelay}: ${tClose} tricuspid closes, ${pClose} pulmonary closes in 5 beats`);
  }
});

test('solved AV range never means first-degree block (PR = 0.06 + delay must stay <= 0.20 s)', () => {
  assert.equal(isAvDelaySolved(0.14), true);
  assert.equal(isAvDelaySolved(0.15), false);
});
