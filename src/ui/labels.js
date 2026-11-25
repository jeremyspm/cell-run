// World-space labels: a "scan" prompt near unscanned landmarks, and the name + one line after a scan.
import { LANDMARKS } from '../content/landmarks.js';
import { LANDMARK_SPOTS, nearestLandmark } from '../level1.js';

const byId = Object.fromEntries(LANDMARKS.map(l => [l.id, l]));

export function createLabels(scene) {
  const style = { fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffe9ee', align: 'center', wordWrap: { width: 340 } };
  const prompt = scene.add.text(0, 0, '', { ...style, fontSize: '15px', color: '#ffd68c' }).setOrigin(0.5, 1).setDepth(60).setResolution(2);
  const card = scene.add.container(0, 0).setDepth(61).setAlpha(0);
  const bg = scene.add.graphics();
  const title = scene.add.text(0, 0, '', { ...style, fontSize: '19px', fontStyle: 'bold', color: '#ffd0da' }).setOrigin(0.5, 0).setResolution(2);
  const body = scene.add.text(0, 26, '', style).setOrigin(0.5, 0).setResolution(2);
  card.add([bg, title, body]);
  // Soft markers so landmarks read as "scannable" before you get close.
  const markers = LANDMARK_SPOTS.map(s => scene.add.circle(s.x, s.y, 6, 0xffd68c, 0.5).setDepth(3).setBlendMode(Phaser.BlendModes.ADD));
  let cardTween = null;

  scene.events.on('level-event', e => {
    if (!e.startsWith('scan:')) return;
    const id = e.slice(5), l = byId[id], s = LANDMARK_SPOTS.find(x => x.id === id);
    title.setText(l.name); body.setText(l.scan);
    const w = Math.max(title.width, body.width) + 28, h = 26 + body.height + 18;
    bg.clear().fillStyle(0x1e050c, 0.88).fillRoundedRect(-w / 2, -10, w, h, 10).lineStyle(1, 0xffb3c4, 0.4).strokeRoundedRect(-w / 2, -10, w, h, 10);
    card.setPosition(s.x, s.y - h - 40);
    if (cardTween) cardTween.stop();
    card.setAlpha(1);
    cardTween = scene.tweens.add({ targets: card, alpha: 0, delay: 4500, duration: 800 });
  });

  return {
    update({ player, level }) {
      const t = scene.time.now / 1000;
      markers.forEach((m, i) => {
        const done = level.scanned.has(LANDMARK_SPOTS[i].id);
        m.setFillStyle(done ? 0x9fe0c0 : 0xffd68c, done ? 0.25 : 0.45 + 0.25 * Math.sin(t * 3 + i));
      });
      const near = nearestLandmark(player.x, player.y);
      if (near && !level.scanned.has(near.id)) prompt.setText('E / X  scan').setPosition(near.x, near.y - 16).setVisible(true);
      else prompt.setVisible(false);
    },
  };
}
