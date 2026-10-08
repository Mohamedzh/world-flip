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
  thrower: look('thrower', [4, 5]),
  tideFrog: look('tide-frog', [13, 14]),
  flyer: look('flyer', [24, 25]),
} as const;

/** Single frames from the tiles sheet. */
export const TILE_FRAMES = {
  heartFull: 44,
  heartEmpty: 46,
  mushroom: 128,
  flag: 111,
  flagWave: 112,
  /** A seed pod, and what it grows into: a trunk topped by a leafy platform. */
  seedPod: 124,
  trunk: 116,
  leafLeft: 77,
  leaf: 78,
  leafRight: 79,
  /** Water surface, used for the puddle a Water wave leaves across a gap. */
  waterTop: 33,
} as const;

export const FLAG_ANIM = 'flag-wave';

/** Background pieces per world: the sky color comes from `sky`; `hills` and `low` are two scrolling bands. */
export const BACKGROUNDS = {
  meadow: { sky: 6, hills: 14, low: 22 },
  lake: { sky: 6, hills: 14, low: 22 },
  mountain: { sky: 0, hills: 11, low: 19 },
  sky: { sky: 1, hills: 8, low: 16 },
} as const;

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
