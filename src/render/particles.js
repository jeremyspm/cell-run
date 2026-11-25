// Plasma motes carried by the real current field (so you can see the flow), plus blurred
// foreground strands that drift past closer to the camera.
import { currentAt } from '../level1.js';
import { canvasTex, rng, softBlob } from './tex.js';

const COUNT = 240;

export function createParticles(scene) {
  const r = rng(77);
  const g = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
  const cam = scene.cameras.main;
  const motes = Array.from({ length: COUNT }, () => ({ x: r(), y: r(), s: 1 + r() * 2.5, a: 0.15 + r() * 0.35 }));
  let placed = false;

  canvasTex(scene, 'strand', 256, 256, (ctx) => {
    softBlob(ctx, 128, 128, 120, '200,70,100', 0.35);
    softBlob(ctx, 100, 140, 60, '255,150,170', 0.2);
  });
  const strands = Array.from({ length: 5 }, (_, i) =>
    scene.add.image(0, 0, 'strand').setScrollFactor(0).setDepth(50).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(2 + r() * 2).setAlpha(0.18).setData('px', r() * 1600).setData('py', r() * 1000).setData('f', 0.3 + i * 0.06));

  return {
    update({ heart }, dt = 1 / 60) {
      const vx0 = cam.scrollX, vy0 = cam.scrollY, W = cam.width, H = cam.height;
      if (!placed) { for (const m of motes) { m.x = vx0 + m.x * W; m.y = vy0 + m.y * H; } placed = true; }
      g.clear();
      for (const m of motes) {
        const c = currentAt(m.x, m.y, heart);
        m.x += (c.x * 0.8 + Math.sin(m.y * 0.01 + scene.time.now * 0.001) * 6) * dt;
        m.y += (c.y * 0.8 + Math.cos(m.x * 0.01) * 6) * dt;
        // Keep motes around the camera: wrap ones that leave the view.
        if (m.x < vx0 - 40) m.x += W + 80; else if (m.x > vx0 + W + 40) m.x -= W + 80;
        if (m.y < vy0 - 40) m.y += H + 80; else if (m.y > vy0 + H + 40) m.y -= H + 80;
        g.fillStyle(0xffb3c4, m.a).fillCircle(m.x, m.y, m.s);
      }
      // Foreground strands move faster than the world (scroll factor ≈ 1.3).
      for (const s of strands) {
        const f = s.getData('f');
        let x = (s.getData('px') - cam.scrollX * f) % 1600; if (x < 0) x += 1600;
        let y = (s.getData('py') - cam.scrollY * f) % 1000; if (y < 0) y += 1000;
        s.setPosition(x - 160, y - 140);
      }
    },
  };
}
