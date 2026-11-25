// Deep red glow plus three parallax layers of soft tissue shapes. Brightness pulses with the heart.
import { canvasTex, rng, softBlob } from './tex.js';

const LAYERS = [
  { key: 'bg-far', factor: 0.2, seed: 11, count: 26, rmin: 60, rmax: 170, rgb: '120,20,45', a: 0.35 },
  { key: 'bg-mid', factor: 0.45, seed: 23, count: 22, rmin: 30, rmax: 90, rgb: '160,40,70', a: 0.28 },
  { key: 'bg-near', factor: 0.75, seed: 37, count: 30, rmin: 8, rmax: 30, rgb: '230,120,150', a: 0.18 },
];

export function createBackground(scene) {
  const W = 1280, H = 720;
  canvasTex(scene, 'bg-glow', W, H, (ctx) => {
    ctx.fillStyle = '#12060a'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#5a1022'); g.addColorStop(0.55, '#2a0812'); g.addColorStop(1, '#0d0307');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  const glow = scene.add.image(0, 0, 'bg-glow').setOrigin(0).setScrollFactor(0).setDepth(-100);

  const layers = LAYERS.map((L, i) => {
    canvasTex(scene, L.key, 1024, 1024, (ctx) => {
      const r = rng(L.seed);
      for (let k = 0; k < L.count; k++) {
        const x = r() * 1024, y = r() * 1024, rad = L.rmin + r() * (L.rmax - L.rmin);
        // draw wrapped copies so the tile has no seams
        for (const dx of [-1024, 0, 1024]) for (const dy of [-1024, 0, 1024]) softBlob(ctx, x + dx, y + dy, rad, L.rgb, L.a * (0.5 + r() * 0.5));
      }
    });
    const ts = scene.add.tileSprite(0, 0, W, H, L.key).setOrigin(0).setScrollFactor(0).setDepth(-90 + i)
      .setBlendMode(Phaser.BlendModes.ADD);
    return { ts, factor: L.factor };
  });

  return {
    update({ heart }) {
      const cam = scene.cameras.main;
      const beat = 0.6 * heart.ventricularActive + 0.4 * heart.atrialActive;
      for (const l of layers) {
        l.ts.tilePositionX = cam.scrollX * l.factor;
        l.ts.tilePositionY = cam.scrollY * l.factor;
        l.ts.setAlpha(0.75 + 0.25 * beat);
      }
      glow.setAlpha(0.85 + 0.15 * beat);
    },
  };
}
