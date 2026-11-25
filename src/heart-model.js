// Right-heart cardiac cycle. Pure: no Phaser, window or document.
// Valves open ONLY by comparing pressures: tricuspid = RA > RV, pulmonary = RV > PA.
// All times inside the model are real seconds; tick() takes game seconds and scales by TIME_SCALE.

export const CYCLE_SEC = 0.8;          // 75 bpm
export const TIME_SCALE = 1 / 6;       // one game beat ≈ 4.8 s
export const NORMAL_AV_DELAY = 0.10;
export const BROKEN_AV_DELAY = 0;
export const AV_SOLVED_MIN = 0.06;
export const AV_SOLVED_MAX = 0.14; // PR = 0.06 conduction + delay stays <= 0.20 s (above that is first-degree block)
export const AV_DIAL_MAX = 0.24;

const ATRIAL_SYSTOLE = 0.10;   // atrial contraction length
const ATRIAL_CONDUCTION = 0.06; // SA node to AV node, before the nodal delay
const VENT_SYSTOLE = 0.30;     // ventricular contraction length
const PA_FLOOR = 10, PA_TAU = 0.2;
const SUBSTEP = 0.002;

export function isAvDelaySolved(sec) { return sec >= AV_SOLVED_MIN && sec <= AV_SOLVED_MAX; }

export function createHeartModel({ avDelay = NORMAL_AV_DELAY } = {}) {
  const s = {
    tReal: 0, phase: 'passive-filling', avDelay,
    pressures: { ra: 3, rv: 2, pa: PA_FLOOR },
    valves: { tricuspid: true, pulmonary: false },
    atrialActive: 0, ventricularActive: 0,
    tricuspidOpenedAt: -1, // real time the tricuspid last opened (early rapid filling follows)
    cannon: false,         // true once the atrium squeezed a shut tricuspid this beat (cleared at the next SA fire)
  };
  let ejectedThisBeat = false;

  function compute(dtReal, events) {
    const c = s.tReal % CYCLE_SEC;
    const vOn = ATRIAL_CONDUCTION + s.avDelay;
    const a = c < ATRIAL_SYSTOLE ? Math.sin(Math.PI * c / ATRIAL_SYSTOLE) : 0;
    const dv = c - vOn;
    const v = dv >= 0 && dv < VENT_SYSTOLE ? Math.sin(Math.PI * dv / VENT_SYSTOLE) : 0;
    s.atrialActive = a; s.ventricularActive = v;

    const p = s.pressures;
    // The tricuspid is open while the atrium (filling or squeezing) out-pushes the actively contracting ventricle.
    // Shut, an atrial squeeze spikes RA pressure (cannon a wave) but stays below RV pressure, which is why it stays shut.
    const rvActive = 2 + 23 * v, raOpen = 3 + 4 * a;
    if (raOpen > rvActive) { p.ra = raOpen; p.rv = Math.max(raOpen - 1, rvActive); }
    else { p.ra = Math.min(3 + 9 * a, rvActive - 0.05); p.rv = rvActive; }
    const decayed = p.pa + (PA_FLOOR - p.pa) * (1 - Math.exp(-dtReal / PA_TAU));
    p.pa = Math.max(decayed, p.rv - 0.5);

    const tri = p.ra > p.rv, pul = p.rv > p.pa;
    if (events) {
      if (tri !== s.valves.tricuspid) events.push({ type: 'valve', valve: 'tricuspid', open: tri });
      if (pul !== s.valves.pulmonary) events.push({ type: 'valve', valve: 'pulmonary', open: pul });
    }
    if (tri && !s.valves.tricuspid) s.tricuspidOpenedAt = s.tReal;
    if (!tri && a > 0.2) s.cannon = true; // atrium squeezed a shut tricuspid this beat
    s.valves.tricuspid = tri; s.valves.pulmonary = pul;
    if (pul) ejectedThisBeat = true;

    let phase;
    if (pul) phase = 'ejection';
    else if (!tri) phase = ejectedThisBeat ? 'isovolumetric-relaxation' : 'isovolumetric-contraction';
    else if (!ejectedThisBeat && c < vOn + VENT_SYSTOLE) phase = 'atrial-systole'; // P wave until the tricuspid shuts
    else phase = 'passive-filling';
    if (phase !== s.phase && events) events.push({ type: 'phase', phase });
    s.phase = phase;
  }

  compute(0, null);
  // Start mid-diastole so the first thing the player sees is calm filling.
  s.tReal = 0.5; compute(0, null);

  return {
    get state() { return s; },
    setAvDelay(sec) { s.avDelay = Math.min(AV_DIAL_MAX, Math.max(0, sec)); },
    tick(dtGame) {
      const events = [];
      let remaining = Math.max(0, dtGame) * TIME_SCALE;
      while (remaining > 1e-12) {
        const step = Math.min(SUBSTEP, remaining);
        const before = Math.floor(s.tReal / CYCLE_SEC);
        s.tReal += step; remaining -= step;
        if (Math.floor(s.tReal / CYCLE_SEC) !== before) { events.push({ type: 'sa-fire' }); ejectedThisBeat = false; s.cannon = false; }
        compute(step, events);
      }
      return events;
    },
  };
}
