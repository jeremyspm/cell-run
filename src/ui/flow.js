// Ties the overlay to the game: start screen, per-part hints, solve notes, AV dial, pause, ending.
import { SOLVE_NOTES } from '../content/landmarks.js';
import { createOverlay } from './overlay.js';

const HINTS = {
  arrival: 'Swim with <kbd>WASD</kbd> / left stick. The glowing dots are landmarks: get close and press <kbd>E</kbd> / <kbd>X</kbd> to scan.',
  'broken-door': 'The atrium is squeezing against a shut valve, and backwash is blasting up the middle. Creep down the calm <b>septal wall</b> (right side) to the <b>AV node</b> near the floor and scan it.',
  'timing-door': 'Rhythm fixed. Wait above the tricuspid. When it opens, ride the flow down. Tip: <kbd>Tab</kbd> / View shows the pressure strip.',
  'rv-climb': 'Climb to the <b>outflow tract</b> (top right) before the ventricle squeezes. Ejection will carry you through the pulmonary valve.',
};

export function createFlow(scene, { strip }) {
  const ui = createOverlay();
  let hintTimer = null, s1Shown = false, ending = false, started = !!scene.skipStart;
  const showHint = (part) => {
    ui.hint(HINTS[part] || '');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => ui.hint(''), 14000);
  };

  if (!started) {
    scene.setPaused(true);
    ui.showStart(() => { started = true; scene.setPaused(false); showHint('arrival'); });
  } else showHint('arrival');

  scene.events.on('pause-pressed', () => {
    if (!started || ending) return;
    if (ui.screenOpen) { ui.closeScreen(); scene.setPaused(false); return; }
    scene.setPaused(true);
    ui.showPause(scene.levelState.scanned, () => scene.setPaused(false));
  });

  scene.events.on('level-event', (e) => {
    if (e.startsWith('part:')) {
      const part = e.slice(5);
      if (part === 'complete') return finish();
      showHint(part);
      if (part === 'rv-climb' && !strip.visible) ui.toast('Tip: press <kbd>Tab</kbd> / View to watch RV pressure beat pulmonary artery pressure.', false, 6000);
    }
    if (e === 'av-fixed') ui.toast(`<b>${SOLVE_NOTES.avFixed}</b><br><br>${SOLVE_NOTES.cannonWave}`, true, 14000);
    if (e === 'av-unsolved') ui.toast('Not yet. The atrium has to finish squeezing before the ventricle fires. Adjust the delay.', false, 5000);
    if (e === 'scan:av-node' && scene.levelState.part !== 'arrival') ui.toast('This is the AV node. Use <kbd>←</kbd> <kbd>→</kbd> / the stick, or drag the slider, to set its delay.', false, 6000);
  });

  scene.events.on('heart-event', (e) => {
    if (e.type === 'valve' && e.valve === 'tricuspid' && !e.open && !s1Shown && scene.levelState.part === 'timing-door') {
      s1Shown = true; ui.toast(SOLVE_NOTES.s1, true, 6000);
    }
  });

  function finish() {
    ending = true; ui.hint('');
    let done = false;
    const go = () => {
      if (done) return; done = true;
      ui.toast(SOLVE_NOTES.s2, true, 5000);
      scene.cell.setColour(0xe0242f);
      scene.time.delayedCall(3200, () => {
        scene.setPaused(true);
        ui.showComplete({ scanned: scene.levelState.scanned, seconds: scene.levelState.time, note: SOLVE_NOTES.lungsArrival,
          onAgain: () => { ui.toast('', false, 1); scene.scene.restart({ skipStart: true }); } });
      });
    };
    const onValve = (e) => { if (e.type === 'valve' && e.valve === 'pulmonary' && !e.open) { scene.events.off('heart-event', onValve); go(); } };
    scene.events.on('heart-event', onValve);
    scene.time.delayedCall(2500, go);
  }

  return {
    update({ heart, dialOpen }) {
      const inp = scene.lastInput;
      if (ui.screenOpen && inp && inp.confirm) ui.clickPrimary();
      if (ui.screenOpen && inp && Math.abs(inp.y) > 0.3) ui.scrollScreen(inp.y * 14); // stick / keys scroll the codex
      ui.dial(dialOpen && !scene.paused, heart.avDelay, (v) => { scene.pendingDial = v; });
    },
    destroy() { clearTimeout(hintTimer); ui.remove(); },
  };
}
