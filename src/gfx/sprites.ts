// Kenney Pixel Platformer art (CC0, kenney.nl): sheet keys, frame numbers and animations.
// Frame numbers are 0-based, counted left to right, top to bottom on each sheet.
import Phaser from 'phaser';

export const SHEETS = {
  /** 18 x 18 tiles, 20 per row. */
  tiles: 'kenney-tiles',
  /** 24 x 24 characters, 9 per row. */
  characters: 'kenney-characters',
  /** 24 x 24 background pieces, 8 per row. */
  backgrounds: 'kenney-backgrounds',
} as const;

export function loadSheets(scene: Phaser.Scene): void {
  scene.load.spritesheet(SHEETS.tiles, 'assets/kenney/tiles.png', { frameWidth: 18, frameHeight: 18 });
  scene.load.spritesheet(SHEETS.characters, 'assets/kenney/characters.png', { frameWidth: 24, frameHeight: 24 });
  scene.load.spritesheet(SHEETS.backgrounds, 'assets/kenney/backgrounds.png', { frameWidth: 24, frameHeight: 24 });
}

/** A character drawn from the characters sheet: two walking frames. */
export interface Look {
  sheet: string;
  frames: [number, number];
  walkAnim: string;
}

const look = (name: string, frames: [number, number]): Look => ({
  sheet: SHEETS.characters,
  frames,
  walkAnim: `${name}-walk`,
});

export const LOOKS = {
  knight: look('knight', [2, 3]),
  ranger: look('ranger', [0, 1]),
  walker: look('walker', [18, 19]),
  emberBeetle: look('ember-beetle', [21, 22]),
} as const;

/** Single frames from the tiles sheet. */
export const TILE_FRAMES = {
  heartFull: 44,
  heartEmpty: 46,
  mushroom: 128,
  flag: 111,
  flagWave: 112,
} as const;

export const FLAG_ANIM = 'flag-wave';

/** Background pieces for World 1 (the green set): sky, hills and the low ground behind them. */
export const MEADOW_BACKGROUND = { sky: 6, hills: 14, low: 22 } as const;

export function createAnimations(scene: Phaser.Scene): void {
  for (const l of Object.values(LOOKS)) {
    scene.anims.create({
      key: l.walkAnim,
      frames: scene.anims.generateFrameNumbers(l.sheet, { frames: l.frames }),
      frameRate: 6,
      repeat: -1,
    });
  }
  scene.anims.create({
    key: FLAG_ANIM,
    frames: scene.anims.generateFrameNumbers(SHEETS.tiles, { frames: [TILE_FRAMES.flag, TILE_FRAMES.flagWave] }),
    frameRate: 3,
    repeat: -1,
  });
}
