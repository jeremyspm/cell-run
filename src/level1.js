// Level 1 "Out of Sync": right-heart layout, currents and puzzle states. Pure.
// Side-on, textbook convention: the patient's right is on the screen's left.
// RA at the top left, tricuspid below it, RV underneath, outflow tract (infundibulum)
// rising up the right side to the pulmonary valve and trunk.
//
// Tuned numbers (bot tests in tests/level1.test.mjs depend on these):
//   CURRENT_UNIT 300 px/s; RA filling 1.0 early / 0.7 atrial kick / 0.3 otherwise;
//   cannon backwash 2.2 upward over the RA for the rest of a beat in which `heart.cannon` was set (gameplay exaggeration, said so in SOLVE_NOTES.cannonWave);
//   ejection 1.6 in the outflow tract and trunk, 0.4 elsewhere in the RV; 0.2 down through an open tricuspid.
import { isAvDelaySolved } from './heart-model.js';

export const WORLD = { width: 1800, height: 2600 };
export const SPAWN = { x: 525, y: 60 };
export const CURRENT_UNIT = 300;
export const TRICUSPID_Y = 1030;
export const PULMONARY_Y = 700;
export const EXIT_Y = 560;
const USE_RANGE = 80;

const path = pts => pts.slice(1).map((p, i) => ({ x1: pts[i][0], y1: pts[i][1], x2: p[0], y2: p[1] }));

// One closed outline, traced clockwise from the SVC.
export const OUTLINE = [
  [450, 150], [450, 0], [600, 0], [600, 150],          // superior vena cava
  [1000, 150], [1000, 1000],                            // RA roof, interatrial septum
  [800, 1000], [800, 1060],                             // RA floor (septal side), tricuspid ring
  [1100, 1060], [1250, 900], [1250, 250],               // RV roof up the outflow tract and trunk
  [1550, 250], [1550, 1500], [1300, 2300],              // trunk cap, outer RV wall
  [1100, 2450], [500, 2450], [300, 2300],               // apex
  [300, 1060], [500, 1060], [500, 1000],                // RV roof (right side), tricuspid ring
  [200, 1000], [200, 920], [100, 920], [100, 820], [200, 820], // RA floor, inferior vena cava
  [200, 150], [450, 150],
];
export const WALLS = path(OUTLINE);

export const VALVES = {
  tricuspid: [{ x1: 500, y1: TRICUSPID_Y, x2: 800, y2: TRICUSPID_Y }],
  pulmonary: [{ x1: 1250, y1: PULMONARY_Y, x2: 1550, y2: PULMONARY_Y }],
};

export const LANDMARK_SPOTS = [
  { id: 'svc', x: 525, y: 175, r: 70 },
  { id: 'sa-node', x: 640, y: 185, r: 40 },
  { id: 'pectinate', x: 245, y: 420, r: 90 },
  { id: 'ivc', x: 235, y: 870, r: 60 },
  { id: 'fossa-ovalis', x: 965, y: 520, r: 60 },
  { id: 'coronary-sinus', x: 950, y: 950, r: 40 },
  { id: 'av-node', x: 870, y: 965, r: 30 },
  { id: 'tricuspid', x: 650, y: 985, r: 60 },
  { id: 'chordae', x: 650, y: 1160, r: 70 },
  { id: 'papillary', x: 640, y: 1380, r: 60 },
  { id: 'moderator-band', x: 820, y: 1700, r: 80 },
  { id: 'infundibulum', x: 1400, y: 1050, r: 90 },
  { id: 'pulmonary-valve', x: 1400, y: 745, r: 60 },
];

export function inRA(x, y) { return y < TRICUSPID_Y && x < 1050; }
export function inBackwash(x) { return x > 330 && x < 830; }
export function inOutflow(x, y) { return x > 1150 && y < 1400; }

const toward = (x, y, tx, ty, k) => { const d = Math.hypot(tx - x, ty - y) || 1; return { x: (tx - x) / d * k, y: (ty - y) / d * k }; };

export function currentAt(x, y, h) {
  const U = CURRENT_UNIT;
  if (inRA(x, y)) {
    // Backwash runs up the middle of the atrium; the septal wall stays calm enough to creep down to the AV node.
    if (h.cannon) return inBackwash(x) ? { x: 0, y: -2.2 * U } : { x: 0, y: 0 };
    if (h.valves.tricuspid) {
      const early = h.tReal - h.tricuspidOpenedAt < 0.15;
      const k = early ? 1.0 : h.atrialActive > 0.2 ? 0.7 : 0.3;
      return toward(x, y, 650, TRICUSPID_Y + 40, k * U);
    }
    return { x: 0, y: 0 };
  }
  if (h.valves.pulmonary) {
    if (inOutflow(x, y)) return { x: 0, y: -1.6 * U };
    return toward(x, y, 1400, 1100, 0.4 * U);
  }
  if (h.valves.tricuspid && y < 1400 && x < 1000) return { x: 0, y: 0.2 * U };
  return { x: 0, y: 0 };
}

export function segmentsFor(h) {
  const segs = WALLS.slice();
  if (!h.valves.tricuspid) segs.push(...VALVES.tricuspid);
  if (!h.valves.pulmonary) segs.push(...VALVES.pulmonary);
  return segs;
}

export function nearestLandmark(x, y) {
  let best = null, bd = Infinity;
  for (const s of LANDMARK_SPOTS) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return bd <= USE_RANGE ? best : null;
}

const AV = () => LANDMARK_SPOTS.find(s => s.id === 'av-node');
export function isAtAvNode(x, y) { const a = AV(); return Math.hypot(a.x - x, a.y - y) <= USE_RANGE; }

export function createLevelState() {
  return { part: 'arrival', avFixed: false, scanned: new Set(), time: 0 };
}

// heart is the HeartModel (needs setAvDelay); actions = { use, dial: -1|0|1, setDial?, dt }
export function updateLevel(ls, player, heart, actions) {
  const events = [];
  const next = { ...ls, scanned: new Set(ls.scanned), time: ls.time + (actions.dt || 0) };
  const setPart = p => { if (next.part !== p) { next.part = p; events.push('part:' + p); } };
  const near = nearestLandmark(player.x, player.y);
  const atAv = isAtAvNode(player.x, player.y);

  if (actions.use && (near || atAv)) {
    if (near && !next.scanned.has(near.id)) { next.scanned.add(near.id); events.push('scan:' + near.id); }
    else if (atAv && next.scanned.has('av-node') && !next.avFixed && next.part !== 'arrival') {
      if (isAvDelaySolved(heart.state.avDelay)) { next.avFixed = true; events.push('av-fixed'); }
      else events.push('av-unsolved');
    }
    if (next.part === 'arrival') setPart('broken-door');
  }
  if (next.part === 'arrival' && next.time >= 20) setPart('broken-door');

  if (atAv && !next.avFixed) {
    if (typeof actions.setDial === 'number') heart.setAvDelay(actions.setDial);
    else if (actions.dial) heart.setAvDelay(Math.round((heart.state.avDelay + 0.01 * actions.dial) * 100) / 100);
  }

  if (next.part === 'broken-door' && next.avFixed) setPart('timing-door');
  if (next.part === 'timing-door' && player.y > TRICUSPID_Y + 30) setPart('rv-climb');
  if (next.part === 'rv-climb' && player.y < EXIT_Y && player.x > 1250) setPart('complete');
  return { ls: next, events };
}
