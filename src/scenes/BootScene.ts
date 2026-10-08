// Loads the art and every level, prepares textures and animations, then shows the main menu.
import Phaser from 'phaser';
import { createPlaceholderTextures } from '../gfx/placeholderTextures';
import { createAnimations, loadSheets } from '../gfx/sprites';
import { LEVELS, TEST_LEVEL } from '../level/levels';
import { ASSETS, SCENES } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    loadSheets(this);
    this.load.image(ASSETS.blockTiles, 'assets/tiles/placeholder-tiles.png');
    for (const level of [...LEVELS, TEST_LEVEL]) {
      this.load.tilemapTiledJSON(level.id, `assets/levels/${level.file}`);
    }
  }

  create(): void {
    createPlaceholderTextures(this);
    createAnimations(this);
    this.scene.start(SCENES.menu);
    this.scene.launch(SCENES.ui);
  }
}
