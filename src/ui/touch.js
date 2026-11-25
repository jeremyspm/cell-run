// Tablet bonus: a left-thumb virtual stick plus Burst and Scan buttons. Only on touch screens.
export function createTouchControls(overlayEl) {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return null;
  const css = `
    .tc-stick{position:absolute;left:28px;bottom:28px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.06);border:2px solid rgba(255,170,190,.35);pointer-events:auto;touch-action:none}
    .tc-knob{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px;border-radius:50%;background:rgba(255,170,190,.45)}
    .tc-btn{position:absolute;width:86px;height:86px;border-radius:50%;background:rgba(224,36,47,.55);color:#fff;font:600 15px system-ui;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;user-select:none}
    .tc-small{width:64px;height:40px;border-radius:10px;font-size:13px;background:rgba(40,10,20,.85);border:1px solid rgba(255,170,190,.35);bottom:auto;top:14px}.tc-pause{right:14px}.tc-strip{right:88px}.tc-burst{right:28px;bottom:40px}.tc-use{right:128px;bottom:110px;background:rgba(255,214,140,.45)}`;
  if (!document.getElementById('tc-style')) { const style = document.createElement('style'); style.id = 'tc-style'; style.textContent = css; document.head.appendChild(style); }
  const stick = document.createElement('div'); stick.className = 'tc-stick';
  const knob = document.createElement('div'); knob.className = 'tc-knob'; stick.appendChild(knob);
  const burst = Object.assign(document.createElement('div'), { className: 'tc-btn tc-burst', textContent: 'Burst' });
  const use = Object.assign(document.createElement('div'), { className: 'tc-btn tc-use', textContent: 'Scan' });
  const pause = Object.assign(document.createElement('div'), { className: 'tc-btn tc-small tc-pause', textContent: 'Pause' });
  const strip = Object.assign(document.createElement('div'), { className: 'tc-btn tc-small tc-strip', textContent: 'Strip' });
  overlayEl.append(stick, burst, use, pause, strip);

  const st = { x: 0, y: 0, burst: false, use: false, pause: false, strip: false };
  let id = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    st.x = dx; st.y = dy; knob.style.transform = `translate(${dx * 44}px, ${dy * 44}px)`;
  };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; try { stick.setPointerCapture(id); } catch {} move(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; st.x = st.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const [elx, key] of [[burst, 'burst'], [use, 'use'], [pause, 'pause'], [strip, 'strip']]) {
    elx.addEventListener('pointerdown', e => { e.preventDefault(); st[key] = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) elx.addEventListener(ev, () => { st[key] = false; });
  }
  return { state: () => st, remove() { for (const n of [stick, burst, use, pause, strip]) n.remove(); } };
}
