import Phaser from 'phaser';
import { DEBUG, PHYSICS, VIEW } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { MapScene } from './scenes/MapScene';
import { SelectScene } from './scenes/SelectScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#10141c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravity },
      // Creates the outline layer that the G key toggles; it starts hidden.
      debug: DEBUG.enabled,
    },
  },
  scene: [BootScene, MapScene, SelectScene, GameScene, HudScene],
});

// Lets the browser console inspect the running game during development.
if (DEBUG.enabled) (window as unknown as { game: Phaser.Game }).game = game;
