// The player: a biconcave red blood cell (pale-ish rim, dimpled darker centre) that squashes
// with speed and turns from plum to bright red when oxygenated.
import { CELL_RADIUS } from '../player-physics.js';
import { canvasTex, softBlob } from './tex.js';

function discTex(scene, key, rim, mid, centre) {
  return canvasTex(scene, key, 96, 96, (ctx) => {
    softBlob(ctx, 48, 48, 48, '255,120,140', 0.25); // halo
    const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 30);
    g.addColorStop(0, centre); g.addColorStop(0.55, mid); g.addColorStop(0.85, rim); g.addColorStop(1, mid);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(48, 48, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,230,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(48, 48, 28, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke(); // highlight
  });
}

export function createCell(scene) {
  discTex(scene, 'cell-plum', '#9a4a80', '#6b2a55', '#3d1230');
  discTex(scene, 'cell-red', '#ff6a72', '#e0242f', '#9e0f1a');
  const scale = (CELL_RADIUS * 2) / 60;
  const img = scene.add.image(0, 0, 'cell-plum').setDepth(10).setScale(scale);
  const red = scene.add.image(0, 0, 'cell-red').setDepth(11).setScale(scale).setAlpha(0);
  if (scene.game.renderer.type === Phaser.WEBGL && img.preFX) img.preFX.addGlow(0xff9fb5, 2, 0, false, 0.1, 8);

  return {
    setColour(hex) {
      scene.tweens.add({ targets: red, alpha: hex === 0xe0242f ? 1 : 0, duration: 1500 });
    },
    update({ player }) {
      const sp = Math.hypot(player.vx, player.vy);
      const squash = Math.min(0.25, sp / 1600);
      const ang = sp > 5 ? Math.atan2(player.vy, player.vx) : img.rotation;
      for (const im of [img, red]) {
        im.setPosition(player.x, player.y).setRotation(ang);
        im.setScale(scale * (1 + squash), scale * (1 - squash));
      }
    },
  };
}
