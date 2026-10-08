// Placeholder art drawn from tiny pixel maps, per the spec (shapes first, real sprites in milestone 3).
// Each row string is one line of pixels; each character picks a color from the palette ('.' = clear).
import Phaser from 'phaser';
import { COLORS } from '../config';

export const TEXTURES = {
  knight: 'hero-knight',
  checkpointOff: 'checkpoint-off',
  checkpointOn: 'checkpoint-on',
  crown: 'crown',
  heartFull: 'heart-full',
  heartEmpty: 'heart-empty',
} as const;

type Palette = Record<string, number>;

function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], palette: Palette): void {
  const g = scene.make.graphics({}, false);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle(palette[ch], 1);
      g.fillRect(x, y, 1, 1);
    });
  });
  g.generateTexture(key, rows[0].length, rows.length);
  g.destroy();
}

/** Darkens a 0xRRGGBB color by `amount` (0-1). */
function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const k = 1 - amount;
  return Phaser.Display.Color.GetColor(c.red * k, c.green * k, c.blue * k);
}

// 12 x 16: a plain rectangle with an eye on the right, so you can see which way the hero faces.
const HERO_ROWS = [
  'oooooooooooo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbwwbo',
  'obbbbbbbwkbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'oooooooooooo',
];

// 10 x 22: a pole with a flag.
const FLAG_ROWS = [
  'pp........',
  'ppffff....',
  'ppffffff..',
  'ppffffffff',
  'ppffffff..',
  'ppffff....',
  ...Array(16).fill('pp........'),
];

// 16 x 12
const CROWN_ROWS = [
  '.......r........',
  '.y.....y.....y..',
  '.yy...yyy...yy..',
  '.yyy.yyyyy.yyy..',
  '.yyyyyyyyyyyyy..',
  '.yyyyyyyyyyyyy..',
  '.yryyyyryyyyry..',
  '.yyyyyyyyyyyyy..',
  '.yyyyyyyyyyyyy..',
  '.ddddddddddddd..',
  '.ddddddddddddd..',
  '................',
];

// 9 x 8
const HEART_ROWS = [
  '.hh...hh.',
  'hhhh.hhhh',
  'hhhhhhhhh',
  'hhhhhhhhh',
  '.hhhhhhh.',
  '..hhhhh..',
  '...hhh...',
  '....h....',
];

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  pixelTexture(scene, TEXTURES.knight, HERO_ROWS, {
    o: shade(COLORS.knight, 0.45),
    b: COLORS.knight,
    w: 0xffffff,
    k: 0x111111,
  });
  pixelTexture(scene, TEXTURES.checkpointOff, FLAG_ROWS, { p: 0x5b4a3a, f: COLORS.checkpointOff });
  pixelTexture(scene, TEXTURES.checkpointOn, FLAG_ROWS, { p: 0x5b4a3a, f: COLORS.checkpointOn });
  pixelTexture(scene, TEXTURES.crown, CROWN_ROWS, {
    y: COLORS.crown,
    d: shade(COLORS.crown, 0.3),
    r: 0xe8384f,
  });
  pixelTexture(scene, TEXTURES.heartFull, HEART_ROWS, { h: COLORS.heart });
  pixelTexture(scene, TEXTURES.heartEmpty, HEART_ROWS, { h: COLORS.heartEmpty });
}
