import { GameScene } from './scenes/game-scene.js';

window.game = new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', width: 1280, height: 720, backgroundColor: '#12060a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  audio: { noAudio: true }, // our own Web Audio heart sounds; avoids a second AudioContext
  scene: [GameScene],
});
