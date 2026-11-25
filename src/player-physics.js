// Swimming in blood: weighted self-propulsion plus whatever the current is doing. Pure.
import { resolveCircle } from './geometry.js';

export const MAX_DT = 1 / 30;
export const ACCEL = 900;          // px/s²
export const MAX_SWIM = 220;       // px/s
export const DRAG = 2.5;           // 1/s
export const BURST_SPEED = 420;    // px/s
export const BURST_RECHARGE = 2.0; // s
export const CELL_RADIUS = 18;

export function createPlayer(x, y) { return { x, y, vx: 0, vy: 0, burstCharge: 1 }; }

export function stepPlayer(p, input, current, segments, dt) {
  dt = Math.min(Math.max(dt, 0), MAX_DT);
  let { x, y, vx, vy, burstCharge } = p;

  let ix = input.x || 0, iy = input.y || 0;
  const im = Math.hypot(ix, iy);
  if (im > 1) { ix /= im; iy /= im; }

  // Burst: a quick push in the input direction (or current heading), only with a full charge.
  if (input.burst && burstCharge >= 1) {
    let bx = ix, by = iy;
    if (Math.hypot(bx, by) < 0.1) { const s = Math.hypot(vx, vy); bx = s ? vx / s : 0; by = s ? vy / s : -1; }
    const bm = Math.hypot(bx, by) || 1;
    vx = (bx / bm) * BURST_SPEED; vy = (by / bm) * BURST_SPEED;
    burstCharge = 0;
  }
  burstCharge = Math.min(1, burstCharge + dt / BURST_RECHARGE);

  const speedBefore = Math.hypot(vx, vy);
  if (im > 0.01 && speedBefore <= MAX_SWIM) {
    vx += ix * ACCEL * dt; vy += iy * ACCEL * dt;
    const s = Math.hypot(vx, vy);
    if (s > MAX_SWIM) { vx *= MAX_SWIM / s; vy *= MAX_SWIM / s; }
  } else {
    const k = Math.exp(-DRAG * dt);
    vx *= k; vy *= k;
  }

  // Move in small sub-steps so nothing can tunnel through a wall or a shut valve.
  const mx = (vx + current.x) * dt, my = (vy + current.y) * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(mx, my) / (CELL_RADIUS / 2)));
  for (let i = 0; i < n; i++) {
    const r = resolveCircle(x + mx / n, y + my / n, CELL_RADIUS, segments);
    x = r.x; y = r.y;
    if (r.hitNormal) {
      const into = vx * r.hitNormal.x + vy * r.hitNormal.y;
      if (into < 0) { vx -= into * r.hitNormal.x; vy -= into * r.hitNormal.y; }
    }
  }
  return { x, y, vx, vy, burstCharge };
}
