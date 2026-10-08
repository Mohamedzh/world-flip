// Placeholder art drawn from tiny pixel maps, per the spec (shapes first, real sprites in milestone 3).
// Each row string is one line of pixels; each character picks a color from the palette ('.' = clear).
import Phaser from 'phaser';
import { COLORS } from '../config';
import type { FlipState } from '../systems/flips';

export const TEXTURES = {
  knight: 'hero-knight',
  ranger: 'hero-ranger',
  enemy: 'enemy',
  enemyCalm: 'enemy-calm',
  mushroom: 'mushroom',
  mushroomHostile: 'mushroom-hostile',
  arrow: 'arrow',
  pixel: 'pixel',
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

// 14 x 14: enemies are red squares (spec); calm ones (friend/foe swap) are purple and smile.
const ENEMY_ROWS = [
  'oooooooooooooo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obkkbbbbbbkkbo',
  'obbkkbbbbkkbbo',
  'obbwwbbbbwwbbo',
  'obbwkbbbbwkbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obbbkkkkkkbbbo',
  'obbkbbbbbbkbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'oooooooooooooo',
];
const ENEMY_CALM_ROWS = [
  'oooooooooooooo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obbwwbbbbwwbbo',
  'obbwkbbbbwkbbo',
  'obbbbbbbbbbbbo',
  'obbkbbbbbbkbbo',
  'obbbkkkkkkbbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'obbbbbbbbbbbbo',
  'oooooooooooooo',
];

// 16 x 14: friends are yellow circles (spec), here a round bounce mushroom with a stem.
const MUSHROOM_ROWS = [
  '.....oooooo.....',
  '...oocccccccoo..',
  '..occcsscccccco.',
  '.occcsssscccccco',
  '.occcccccccssco.',
  'occcccccccsssco.',
  'occcccccccccccco',
  'oooooooooooooooo',
  '....oeeeeeeo....',
  '....oewkewkeo...',
  '....oeeeeeeeo...',
  '....oeeeeeeeo...',
  '....oeeeeeeeo...',
  '....ooooooooo...',
];
const MUSHROOM_HOSTILE_ROWS = [
  '.....oooooo.....',
  '...oocccccccoo..',
  '..occcsscccccco.',
  '.occcsssscccccco',
  '.occcccccccssco.',
  'occcccccccsssco.',
  'occcccccccccccco',
  'oooooooooooooooo',
  '....okeeeekeo...',
  '....oekwewkeo...',
  '....oeeeeeeeo...',
  '....oekkkkkeo...',
  '....oeeeeeeeo...',
  '....ooooooooo...',
];

// 10 x 3
const ARROW_ROWS = ['.......w..', 'ssssssssww', '.......w..'];

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
  pixelTexture(scene, TEXTURES.ranger, HERO_ROWS, {
    o: shade(COLORS.ranger, 0.45),
    b: COLORS.ranger,
    w: 0xffffff,
    k: 0x111111,
  });
  const creature = (base: number) => ({ o: shade(base, 0.5), b: base, w: 0xffffff, k: 0x111111 });
  pixelTexture(scene, TEXTURES.enemy, ENEMY_ROWS, creature(COLORS.enemy));
  pixelTexture(scene, TEXTURES.enemyCalm, ENEMY_CALM_ROWS, creature(COLORS.enemyCalm));
  const mushroom = (cap: number) => ({ o: shade(cap, 0.55), c: cap, s: 0xffffff, e: 0xf3e3c3, w: 0xffffff, k: 0x111111 });
  pixelTexture(scene, TEXTURES.mushroom, MUSHROOM_ROWS, mushroom(COLORS.friend));
  pixelTexture(scene, TEXTURES.mushroomHostile, MUSHROOM_HOSTILE_ROWS, mushroom(COLORS.friendHostile));
  pixelTexture(scene, TEXTURES.arrow, ARROW_ROWS, { s: COLORS.arrow, w: 0xdddddd });
  pixelTexture(scene, TEXTURES.pixel, ['w'], { w: 0xffffff });
  createFlipIcons(scene);
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

/** 9 x 9 icons for the flip indicator in the top bar. */
export const FLIP_ICONS: Record<FlipState, string> = {
  normal: 'flip-normal',
  lowGravity: 'flip-low-gravity',
  colorSwap: 'flip-color-swap',
  friendFoe: 'flip-friend-foe',
};

function createFlipIcons(scene: Phaser.Scene): void {
  // Normal: a sun.
  pixelTexture(scene, FLIP_ICONS.normal, [
    '....y....',
    '.y.....y.',
    '...yyy...',
    '..yyyyy..',
    'y.yyyyy.y',
    '..yyyyy..',
    '...yyy...',
    '.y.....y.',
    '....y....',
  ], { y: COLORS.crown });
  // Low gravity: a feather-light arrow pointing up.
  pixelTexture(scene, FLIP_ICONS.lowGravity, [
    '....w....',
    '...www...',
    '..wwwww..',
    '.ww.w.ww.',
    '....w....',
    '....w....',
    '...w.w...',
    '..w...w..',
    '.w.....w.',
  ], { w: 0xffffff });
  // Color swap: half orange (stripes), half blue (dots).
  pixelTexture(scene, FLIP_ICONS.colorSwap, [
    'poooobbbb',
    'opooobqbb',
    'oopoobbbb',
    'ooopobbbb',
    'poooobbbb',
    'opooobqbb',
    'oopoobbbb',
    'ooopobbbb',
    'poooobbbb',
  ], { o: 0xf28c28, p: 0xb85f0e, b: 0x3b82f6, q: 0x1e4fa8 });
  // Friend/foe swap: a red square and a yellow circle side by side.
  pixelTexture(scene, FLIP_ICONS.friendFoe, [
    '.........',
    'rrrr..yy.',
    'rrrr.yyyy',
    'rrrr.yyyy',
    'rrrr..yy.',
    '.........',
    '..a...a..',
    '.aaaaaaa.',
    '..a...a..',
  ], { r: COLORS.enemy, y: COLORS.friend, a: 0xffffff });
}
