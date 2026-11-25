// Heart wall tissue around the chamber, a wet rim, valve leaflets, chordae, papillary muscles,
// moderator band, pectinate ridges and the two glowing nodes. Visual only: collision stays in level1.js.
import { OUTLINE, WORLD, TRICUSPID_Y, PULMONARY_Y, LANDMARK_SPOTS } from '../level1.js';
import { canvasTex, rng, smoothClosed, softBlob } from './tex.js';

const spot = id => LANDMARK_SPOTS.find(s => s.id === id);

export function createWalls(scene) {
  const smooth = smoothClosed(OUTLINE, 2);
  const flat = smooth.flat();

  // Muscle-fibre tissue texture.
  canvasTex(scene, 'tissue', 512, 512, (ctx) => {
    ctx.fillStyle = '#4a0f1f'; ctx.fillRect(0, 0, 512, 512);
    const r = rng(5);
    for (let i = 0; i < 40; i++) for (const d of [-512, 0, 512]) softBlob(ctx, r() * 512 + d, r() * 512, 40 + r() * 80, '110,24,48', 0.5);
    ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      const x = r() * 512, y = r() * 512, len = 60 + r() * 140, ang = -0.5 + r() * 0.35;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '140,40,64' : '60,10,24'},${0.25 + r() * 0.3})`;
      ctx.lineWidth = 2 + r() * 5;
      for (const d of [-512, 0, 512]) {
        ctx.beginPath(); ctx.moveTo(x + d, y);
        ctx.quadraticCurveTo(x + d + len / 2, y + Math.sin(ang) * len + 20, x + d + len, y + Math.sin(ang) * len); ctx.stroke();
      }
    }
  });
  canvasTex(scene, 'node-glow', 128, 128, (ctx) => softBlob(ctx, 64, 64, 64, '255,214,140', 1));

  // Tissue everywhere except the chamber: a tiled texture under an inverted polygon mask.
  const tissue = scene.add.tileSprite(0, 0, WORLD.width, WORLD.height, 'tissue').setOrigin(0).setDepth(-20);
  const maskShape = scene.make.graphics({ add: false });
  maskShape.fillStyle(0xffffff).fillPoints(smooth.map(([x, y]) => ({ x, y })), true);
  const mask = maskShape.createGeometryMask(); mask.setInvertAlpha(true);
  tissue.setMask(mask);

  // Chamber interior: translucent so the parallax glow shows through.
  const inner = scene.add.graphics().setDepth(-30);
  inner.fillStyle(0x2a0712, 0.35).fillPoints(smooth.map(([x, y]) => ({ x, y })), true);

  const rim = scene.add.graphics().setDepth(-10);
  const anatomy = scene.add.graphics().setDepth(-5);
  const leaflets = scene.add.graphics().setDepth(5);

  const sa = spot('sa-node'), av = spot('av-node');
  const saGlow = scene.add.image(sa.x, sa.y, 'node-glow').setDepth(-4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setScale(0.6);
  const avGlow = scene.add.image(av.x, av.y, 'node-glow').setDepth(-4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setScale(0.45);
  let saFlash = 0;
  scene.events.on('heart-event', e => { if (e.type === 'sa-fire') saFlash = 1; });

  // Fixed anatomy, drawn once.
  const r = rng(9);
  // Pectinate muscles: comb-like ridges on the anterior right atrial wall (screen left).
  for (let y = 260; y < 760; y += 34) {
    anatomy.lineStyle(10, 0x7a1d36, 0.9).beginPath();
    anatomy.moveTo(200, y); anatomy.lineTo(240 + r() * 25, y + 10); anatomy.strokePath();
    anatomy.lineStyle(3, 0xc0607a, 0.35).beginPath();
    anatomy.moveTo(202, y - 3); anatomy.lineTo(236 + r() * 20, y + 6); anatomy.strokePath();
  }
  // Fossa ovalis: a shallow oval dent in the septum.
  anatomy.fillStyle(0x3a0a18, 0.9).fillEllipse(985, 520, 36, 110);
  anatomy.lineStyle(3, 0xd07890, 0.5).strokeEllipse(985, 520, 36, 110);
  // Coronary sinus and IVC openings: dark mouths.
  anatomy.fillStyle(0x1a0409, 1).fillEllipse(975, 950, 34, 50);
  // Papillary muscles: pillars rising from the RV floor.
  const pap = [{ x: 590, base: 2400, top: 1420 }, { x: 760, base: 2430, top: 1470 }];
  for (const p of pap) {
    anatomy.fillStyle(0x7a1d36, 1).fillTriangle(p.x - 55, p.base, p.x + 55, p.base, p.x, p.top);
    anatomy.fillStyle(0xa83c5a, 0.6).fillTriangle(p.x - 18, p.base, p.x + 6, p.base, p.x - 4, p.top + 30);
  }
  // Moderator band: septum (outflow side) to the anterior papillary muscle.
  anatomy.lineStyle(26, 0x7a1d36, 1).beginPath(); anatomy.moveTo(1455, 1800);
  anatomy.lineTo(1050, 1760); anatomy.lineTo(780, 1640); anatomy.strokePath();
  anatomy.lineStyle(6, 0xc0607a, 0.45).beginPath(); anatomy.moveTo(1455, 1792);
  anatomy.lineTo(1050, 1752); anatomy.lineTo(780, 1632); anatomy.strokePath();
  // Trabeculae carneae: irregular ridges on the lower RV wall.
  for (let i = 0; i < 18; i++) {
    const t = i / 17, x = 320 + t * 960, y = 2380 - Math.sin(t * Math.PI) * 120;
    anatomy.fillStyle(0x6a1830, 0.9).fillEllipse(x, y, 60 + r() * 40, 24);
  }

  let triOpen = 1, pulOpen = 0;
  return {
    update({ heart, dialOpen }, dt = 1 / 60) {
      const beat = Math.max(heart.ventricularActive, heart.atrialActive * 0.7);
      // Wet rim: layered strokes, brighter on each squeeze.
      rim.clear();
      rim.lineStyle(26, 0x6a1328, 0.9).strokePoints(smooth.map(([x, y]) => ({ x, y })), true, true);
      rim.lineStyle(9, 0xb83a5c, 0.55 + 0.35 * beat).strokePoints(smooth.map(([x, y]) => ({ x, y })), true, true);
      rim.lineStyle(2.5, 0xffc2d2, 0.25 + 0.5 * beat).strokePoints(smooth.map(([x, y]) => ({ x, y })), true, true);

      // Valve leaflets swing smoothly toward open/shut.
      const k = 1 - Math.exp(-dt * 14);
      triOpen += ((heart.valves.tricuspid ? 1 : 0) - triOpen) * k;
      pulOpen += ((heart.valves.pulmonary ? 1 : 0) - pulOpen) * k;
      leaflets.clear();
      const flap = (hx, hy, len, ang, col) => {
        const ex = hx + Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
        leaflets.lineStyle(14, col, 1).beginPath(); leaflets.moveTo(hx, hy);
        leaflets.lineTo((hx + ex) / 2, (hy + ey) / 2 + 6); leaflets.lineTo(ex, ey); leaflets.strokePath();
        leaflets.lineStyle(3, 0xffd6e0, 0.6).beginPath(); leaflets.moveTo(hx, hy - 3); leaflets.lineTo(ex, ey - 3); leaflets.strokePath();
        return { x: ex, y: ey };
      };
      // Tricuspid: cusps hinge at the ring and drop into the RV when open.
      const tL = flap(500, TRICUSPID_Y, 152, (1 - triOpen) * 0 + triOpen * 1.35, 0xe8a0b4);
      const tR = flap(800, TRICUSPID_Y, 152, Math.PI - triOpen * 1.35, 0xe8a0b4);
      // Chordae tendineae: cords from cusp tips to the papillary muscle heads.
      leaflets.lineStyle(2, 0xf3d0da, 0.75);
      for (const [tip, p] of [[tL, pap[0]], [tR, pap[1]]]) for (const off of [-22, 0, 22]) {
        leaflets.beginPath(); leaflets.moveTo(tip.x + off * 0.3, tip.y); leaflets.lineTo(p.x + off, p.top); leaflets.strokePath();
      }
      // Pulmonary valve: cusps rise into the trunk when open.
      flap(1250, PULMONARY_Y, 152, -pulOpen * 1.35, 0xe8a0b4);
      flap(1550, PULMONARY_Y, 152, Math.PI + pulOpen * 1.35, 0xe8a0b4);

      saFlash = Math.max(0, saFlash - dt * 2.5);
      saGlow.setAlpha(0.25 + 0.75 * saFlash).setScale(0.6 + 0.5 * saFlash);
      const t = scene.time.now / 1000;
      avGlow.setAlpha(dialOpen ? 0.55 + 0.3 * Math.sin(t * 5) : 0.2 + 0.2 * heart.atrialActive).setScale(dialOpen ? 0.7 : 0.45);
    },
  };
}
