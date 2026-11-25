// DOM screens and messages over the game: start, hints, toasts, AV dial, pause/codex, completion.
import { LANDMARKS } from '../content/landmarks.js';
import { AV_DIAL_MAX, AV_SOLVED_MIN, AV_SOLVED_MAX } from '../heart-model.js';

const root = () => document.getElementById('overlay');
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

const CONTROLS = `
<table>
<tr><td>Swim</td><td><kbd>WASD</kbd> / arrows · left stick</td></tr>
<tr><td>Burst (recharges)</td><td><kbd>Space</kbd> · <kbd>A</kbd></td></tr>
<tr><td>Scan / use</td><td><kbd>E</kbd> · <kbd>X</kbd></td></tr>
<tr><td>Pressure strip</td><td><kbd>Tab</kbd> · View</td></tr>
<tr><td>Pause and codex</td><td><kbd>Esc</kbd> · Start</td></tr>
</table>`;

export function createOverlay() {
  const r = root();
  const hint = el('<div class="hint hidden"></div>'); r.appendChild(hint);
  const toast = el('<div class="toast hidden"></div>'); r.appendChild(toast);
  const dial = el(`<div class="dial hidden">
    <h3>AV node delay</h3>
    <input type="range" min="0" max="${AV_DIAL_MAX}" step="0.01" tabindex="-1">
    <p>Delay: <span class="val"></span> · <kbd>←</kbd><kbd>→</kbd> / stick to adjust · <kbd>E</kbd> / <kbd>X</kbd> to lock it in</p>
    <p class="msg"></p></div>`);
  r.appendChild(dial);
  const slider = dial.querySelector('input');
  let toastTimer = null, screen = null, onDial = null;
  slider.addEventListener('input', () => onDial && onDial(Number(slider.value)));
  slider.addEventListener('pointerup', () => slider.blur());

  const showScreen = (html, buttons) => {
    if (screen) screen.remove();
    screen = el(`<div class="screen"><div class="panel">${html}<div class="btns"></div></div></div>`);
    const box = screen.querySelector('.btns');
    for (const b of buttons) {
      const btn = document.createElement('button'); btn.textContent = b.label; if (b.ghost) btn.className = 'ghost';
      btn.onclick = () => { b.onClick(); }; box.appendChild(btn);
    }
    r.appendChild(screen);
    const first = box.querySelector('button'); if (first) first.focus();
    return screen;
  };

  return {
    remove() { clearTimeout(toastTimer); for (const n of [hint, toast, dial]) n.remove(); if (screen) screen.remove(); screen = null; },
    scrollScreen(dy) { const p = screen && screen.querySelector('.panel'); if (p) p.scrollTop += dy; },
    get screenOpen() { return !!screen; },
    clickPrimary() { const b = screen && screen.querySelector('button'); if (b) b.click(); },
    closeScreen() { if (screen) { screen.remove(); screen = null; } },
    showStart(onStart) {
      showScreen(`
        <h1>Cell Run</h1><p class="sub">Level 1 · Out of Sync · the right heart</p>
        <p>You're a red blood cell, low on oxygen, coming back from the upper body. The heart's rhythm is broken, and you're stuck in the right atrium until you fix it.</p>
        <details><summary>What is this?</summary>
          <p>A study game for first-year A&amp;P. The level <i>is</i> the anatomy: you learn where things are by swimming past them and scanning them. The puzzles <i>are</i> the physiology: valves open only when the pressure behind them is higher, and you fix the rhythm by setting the AV node's delay.</p>
          <p>About 10–15 minutes. There's no dying. Nothing is saved or sent anywhere.</p></details>
        <h2>Controls</h2>${CONTROLS}`,
      [{ label: 'Start', onClick: () => { this.closeScreen(); onStart(); } }]);
    },
    showPause(scanned, onResume) {
      const items = LANDMARKS.map(l => scanned.has(l.id)
        ? `<li><b>${l.name}</b><br>${l.codex}</li>`
        : `<li class="locked">??? (not scanned yet)</li>`).join('');
      showScreen(`<h1>Paused</h1><h2>Codex · ${scanned.size} of ${LANDMARKS.length}</h2><ul class="codex">${items}</ul><h2>Controls</h2>${CONTROLS}`,
        [{ label: 'Resume', onClick: () => { this.closeScreen(); onResume(); } }]);
    },
    showComplete({ scanned, seconds, note, onAgain }) {
      const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
      showScreen(`<h1>Level complete</h1><p class="sub">Time ${m}:${String(s).padStart(2, '0')} · Codex ${scanned.size} of ${LANDMARKS.length}</p>
        <p>${note}</p>
        <h2>What you did</h2>
        <ul><li>Fixed the AV node delay, so the atria finish emptying before the ventricles fire.</li>
        <li>Rode passive filling and the atrial kick through the tricuspid, which shut behind you (S1).</li>
        <li>Got into the outflow tract before the squeeze, and ejection carried you through the pulmonary valve (S2).</li></ul>
        ${scanned.size < LANDMARKS.length ? '<p>Play again to find the landmarks you missed.</p>' : '<p>Every landmark scanned. Nice.</p>'}`,
      [{ label: 'Play again', onClick: () => { this.closeScreen(); onAgain(); } }]);
    },
    hint(text) {
      if (!text) { hint.classList.add('hidden'); return; }
      hint.innerHTML = text; hint.classList.remove('hidden');
    },
    toast(text, good = false, ms = 7000) {
      toast.innerHTML = text; toast.className = 'toast' + (good ? ' good' : '');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
    },
    dial(open, value, onChange) {
      onDial = onChange;
      dial.classList.toggle('hidden', !open);
      if (!open) return;
      if (document.activeElement !== slider) slider.value = String(value);
      dial.querySelector('.val').textContent = `${Math.round(value * 1000)} ms`;
      const msg = dial.querySelector('.msg');
      if (value < AV_SOLVED_MIN) { msg.textContent = 'Atria and ventricles are still overlapping.'; msg.className = 'msg'; }
      else if (value > AV_SOLVED_MAX) { msg.textContent = 'Too slow: like first-degree heart block.'; msg.className = 'msg'; }
      else { msg.textContent = 'In sync. Lock it in.'; msg.className = 'msg ok'; }
    },
  };
}
