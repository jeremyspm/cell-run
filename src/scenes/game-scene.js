import { createHeartModel, BROKEN_AV_DELAY } from '../heart-model.js';
import { createPlayer, stepPlayer, MAX_DT, CELL_RADIUS } from '../player-physics.js';
import {
  WORLD, SPAWN, WALLS, VALVES, LANDMARK_SPOTS, currentAt, segmentsFor, nearestLandmark,
  createLevelState, updateLevel, isAtAvNode,
} from '../level1.js';
import { createInput } from '../input.js';
import { createBackground } from '../render/background.js';
import { createWalls } from '../render/walls.js';
import { createParticles } from '../render/particles.js';
import { createCell } from '../render/cell.js';
import { createLabels } from '../ui/labels.js';
import { createPressureStrip } from '../ui/pressure-strip.js';
import { createFlow } from '../ui/flow.js';
import { createAudio, pickVariant } from '../audio.js';
import { createTouchControls } from '../ui/touch.js';

// Owns the simulation. Views (render, UI, audio) subscribe to:
//   'heart' (state, player, levelState) every frame, 'heart-event' (model event), 'level-event' (string).
export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create(data = {}) {
    this.heart = createHeartModel({ avDelay: BROKEN_AV_DELAY });
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.levelState = createLevelState();
    this.paused = false;
    this.dialOpen = false;
    this.skipStart = !!data.skipStart;
    this.pendingDial = undefined;
    this.inputs = createInput(this);
    this.touch = createTouchControls(document.getElementById('overlay'));
    if (this.touch) this.inputs.setTouch(this.touch);

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.focus = this.add.zone(SPAWN.x, SPAWN.y, 1, 1);
    this.cameras.main.startFollow(this.focus, true, 0.08, 0.08);

    this.views = [];
    const debug = new URLSearchParams(location.search).has('debug');
    this.cell = createCell(this);
    const makeViews = data.makeViews || (scene => [createBackground(scene), createWalls(scene), createParticles(scene), scene.cell, createLabels(scene), ...(debug ? [createGreybox(scene)] : [])]);
    if (this.game.renderer.type === Phaser.WEBGL) { this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.9, 1.15); this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.35); }
    for (const v of makeViews(this)) this.views.push(v);
    if (!data.makeViews) { const strip = createPressureStrip(this); this.views.push(strip, createFlow(this, { strip }), createSoundView(this)); }
    this.events.once('shutdown', () => {
      for (const v of this.views) if (v.destroy) v.destroy();
      if (this.touch) this.touch.remove();
      for (const n of ['heart-event', 'level-event', 'pause-pressed', 'toggle-strip']) this.events.removeAllListeners(n);
    });
    window.cellRun = this;
  }

  setPaused(p) { this.paused = p; }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, MAX_DT);
    const inp = this.inputs.poll();
    this.lastInput = inp;
    if (inp.pause) this.events.emit('pause-pressed');
    if (inp.toggleStrip) this.events.emit('toggle-strip');
    if (this.paused) { this.emitFrame(dt); return; }

    for (const e of this.heart.tick(dt)) this.events.emit('heart-event', e);

    // The AV dial is "open" while at the scanned AV node and the rhythm isn't fixed yet.
    const near = nearestLandmark(this.player.x, this.player.y);
    const ls = this.levelState;
    this.dialOpen = !!(isAtAvNode(this.player.x, this.player.y) && ls.scanned.has('av-node') && !ls.avFixed && ls.part !== 'arrival');
    const actions = { use: inp.use, dial: 0, dt };
    if (this.pendingDial !== undefined) { actions.setDial = this.pendingDial; this.pendingDial = undefined; }
    let swim = { x: inp.x, y: inp.y, burst: inp.burst };
    if (this.dialOpen) {
      actions.dial = (inp.dialRight ? 1 : 0) - (inp.dialLeft ? 1 : 0);
      swim = { x: 0, y: inp.y, burst: false }; // left/right turn the dial; up/down still swims away
    }

    const h = this.heart.state;
    this.player = stepPlayer(this.player, swim, currentAt(this.player.x, this.player.y, h), segmentsFor(h), dt);
    const r = updateLevel(ls, this.player, this.heart, actions);
    this.levelState = r.ls;
    for (const e of r.events) this.events.emit('level-event', e);
    this.focus.setPosition(this.player.x, this.player.y);
    this.emitFrame(dt);
  }

  emitFrame(dt = 1 / 60) {
    const f = { heart: this.heart.state, player: this.player, level: this.levelState, dialOpen: this.dialOpen };
    for (const v of this.views) v.update(f, dt);
  }
}

// Plain debug drawing: walls, valves (red shut / green open), landmarks, the cell.
export function createGreybox(scene) {
  const g = scene.add.graphics();
  return {
    update({ heart, player, level }) {
      g.clear();
      g.lineStyle(4, 0xcdbfb8, 1);
      for (const s of WALLS) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      for (const [name, segs] of Object.entries(VALVES)) {
        g.lineStyle(8, heart.valves[name] ? 0x3fbf7f : 0xe0242f, 1);
        for (const s of segs) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      }
      for (const l of LANDMARK_SPOTS) { g.fillStyle(level.scanned.has(l.id) ? 0x3fbf7f : 0xd19a00, 1); g.fillCircle(l.x, l.y, 8); }
      g.fillStyle(0x6b2a55, 1); g.fillCircle(player.x, player.y, CELL_RADIUS);
    },
  };
}

// Heart sounds follow the model's valve events; ambient flow follows the current around the cell.
const audio = { instance: null };
function createSoundView(scene) {
  if (!audio.instance) {
    audio.instance = createAudio(pickVariant());
    // Keep trying on every key/tap until the browser lets audio start (some keys, e.g. Esc, don't count).
    const wake = () => {
      audio.instance.resume();
      if (audio.instance.ctx && audio.instance.ctx.state === 'running') { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); }
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  }
  const a = audio.instance;
  scene.events.on('heart-event', e => {
    if (e.type !== 'valve' || e.open || scene.paused) return;
    if (e.valve === 'tricuspid') a.s1(); else a.s2();
  });
  return {
    update({ heart, player }) {
      const c = currentAt(player.x, player.y, heart);
      a.setFlow(scene.paused ? 0 : Math.hypot(c.x, c.y) / 660);
    },
  };
}
