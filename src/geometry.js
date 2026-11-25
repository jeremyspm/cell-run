// Circle-vs-segment collision. Pure.

export function closestOnSegment(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / len2));
  return { x: s.x1 + t * dx, y: s.y1 + t * dy };
}

export function resolveCircle(x, y, r, segments) {
  let hitNormal = null;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const s of segments) {
      const c = closestOnSegment(x, y, s);
      let nx = x - c.x, ny = y - c.y;
      let d = Math.hypot(nx, ny);
      if (d >= r) continue;
      if (d < 1e-9) { nx = -(s.y2 - s.y1); ny = s.x2 - s.x1; d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d; d = 0; }
      else { nx /= d; ny /= d; }
      x = c.x + nx * r; y = c.y + ny * r;
      hitNormal = hitNormal ? normalise(hitNormal.x + nx, hitNormal.y + ny) : { x: nx, y: ny };
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y, hitNormal };
}

function normalise(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
