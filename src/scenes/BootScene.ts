// Loads the level and tiles, draws the placeholder art, then starts the game.
import Phaser from 'phaser';
import { createPlaceholderTextures } from '../gfx/placeholderTextures';
import { ASSETS, SCENES } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.image(ASSETS.tiles, 'assets/tiles/placeholder-tiles.png');
    this.load.tilemapTiledJSON(ASSETS.testLevel, 'assets/levels/test-level.tmj');
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start(SCENES.game);
  }
}
