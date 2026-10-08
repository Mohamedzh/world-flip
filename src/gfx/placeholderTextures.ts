// Small pixel-art textures drawn in code, for things the Kenney pack doesn't have.
// Each row string is one line of pixels; each character picks a color from the palette ('.' = clear).
import Phaser from 'phaser';
import { COLORS } from '../config';
import type { FlipState } from '../systems/flips';
import type { Element } from '../systems/powers';

export const TEXTURES = {
  crown: 'crown',
  arrow: 'arrow',
  fireball: 'fireball',
  wave: 'water-wave',
  snowball: 'snowball',
  pellet: 'pellet',
  flameA: 'flame-a',
  flameB: 'flame-b',
  lock: 'lock',
  starFull: 'star-full',
  starEmpty: 'star-empty',
  pixel: 'pixel',
} as const;

/** 9 x 9 icons for the flip indicator in the top bar. */
export const FLIP_ICONS: Record<FlipState, string> = {
  normal: 'flip-normal',
  lowGravity: 'flip-low-gravity',
  colorSwap: 'flip-color-swap',
  friendFoe: 'flip-friend-foe',
  upsideDown: 'flip-upside-down',
};

/** 10 x 10 power icons, used in the HUD and for the power orbs guardians drop. */
export const POWER_ICONS: Record<Element, string> = {
  fire: 'power-fire',
  water: 'power-water',
  snow: 'power-snow',
  wind: 'power-wind',
};

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

// 10 x 3
const ARROW_ROWS = ['.......w..', 'ssssssssww', '.......w..'];

// 8 x 8
const FIREBALL_ROWS = [
  '..rrrr..',
  '.rooyor.',
  'rooyyoor',
  'roywwyor',
  'roywwyor',
  'rooyyoor',
  '.rooyor.',
  '..rrrr..',
];

// 14 x 18: a curling wave.
const WAVE_ROWS = [
  '..............',
  '......dddd....',
  '....ddwwwwd...',
  '...dwwbbbwwd..',
  '..dwbbbbbbwd..',
  '..dbbbd..dbwd.',
  '.dbbbd....dwd.',
  '.dbbd......d..',
  'dbbbd.........',
  'dbbbbd........',
  'dbbbbbd.......',
  'dbbbbbbd......',
  'dbbbbbbbdd....',
  'dbbbbbbbbbdd..',
  'dbbbbbbbbbbbd.',
  'dbbbbbbbbbbbbd',
  'dbbbbbbbbbbbbd',
  'dddddddddddddd',
];

// 8 x 8
const SNOWBALL_ROWS = [
  '..bbbb..',
  '.bwwwwb.',
  'bwwwwwwb',
  'bwwwwlwb',
  'bwwwwwwb',
  'bwlwwwwb',
  '.bwwwwb.',
  '..bbbb..',
];

// 6 x 6
const PELLET_ROWS = ['.pppp.', 'pqqqqp', 'pqwqqp', 'pqqqqp', 'pqqqqp', '.pppp.'];

// 18 x 18, two frames of a flickering flame (fire walls).
const FLAME_A = [
  '......r.....r.....',
  '.....rr....rr.....',
  '....ror...ror..r..',
  '...roor..roor.rr..',
  '..rooor.rooorror..',
  '..rooyorooyoooor..',
  '.rooyyoooyyyoyor..',
  '.royyyyoyyyyyyoor.',
  'roywyyyyywwyyyyor.',
  'royywwyyywwwyyyor.',
  'royywwwyyywwyyyor.',
  'roywwwwwyywwwyyor.',
  'royywwwwwwwwwyyor.',
  'roywwwwwwwwwwwyor.',
  'royywwwwwwwwwyyor.',
  '.royywwwwwwwyyor..',
  '.rooyyyyyyyyyoor..',
  '..rrrrrrrrrrrrr...',
];
const FLAME_B = [
  '...r.......r......',
  '...rr.....rr...r..',
  '..ror....ror..rr..',
  '..roor..roor.ror..',
  '.rooor.rooorroor..',
  '.rooyorooyooooyor.',
  '.rooyyooyyyyoyyor.',
  'royyyyyyyyyyyyyor.',
  'royywyyyywwyyyyor.',
  'royywwyyywwwyyyor.',
  'roywwwwyyywwwyyor.',
  'royywwwwyywwwyyor.',
  'roywwwwwwwwwwyyor.',
  'royywwwwwwwwwwyor.',
  'roywwwwwwwwwwyyor.',
  '.royywwwwwwwwyor..',
  '.rooyyyyyyyyyyor..',
  '..rrrrrrrrrrrrr...',
];

// 9 x 11: a padlock for locked worlds on the map.
const LOCK_ROWS = [
  '..ggggg..',
  '.gg...gg.',
  '.g.....g.',
  '.g.....g.',
  'yyyyyyyyy',
  'yyyyyyyyy',
  'yyyykyyyy',
  'yyykkkyyy',
  'yyyykyyyy',
  'yyyyyyyyy',
  'ddddddddd',
];

// 11 x 11
const STAR_ROWS = [
  '.....s.....',
  '....sss....',
  '....sss....',
  'sssssssssss',
  '.sssssssss.',
  '..sssssss..',
  '..sssssss..',
  '.ssss.ssss.',
  '.sss...sss.',
  'ss.......ss',
  '...........',
];

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  pixelTexture(scene, TEXTURES.crown, CROWN_ROWS, { y: COLORS.crown, d: shade(COLORS.crown, 0.3), r: 0xe8384f });
  pixelTexture(scene, TEXTURES.arrow, ARROW_ROWS, { s: COLORS.arrow, w: 0xdddddd });
  pixelTexture(scene, TEXTURES.fireball, FIREBALL_ROWS, { r: 0xd84315, o: 0xff7043, y: 0xffca28, w: 0xfff8e1 });
  pixelTexture(scene, TEXTURES.starFull, STAR_ROWS, { s: COLORS.crown });
  pixelTexture(scene, TEXTURES.starEmpty, STAR_ROWS, { s: 0x3a3f4b });
  pixelTexture(scene, TEXTURES.pixel, ['w'], { w: 0xffffff });
  pixelTexture(scene, TEXTURES.wave, WAVE_ROWS, { d: 0x1e4fa8, b: 0x4fc3f7, w: 0xe3f2fd });
  pixelTexture(scene, TEXTURES.snowball, SNOWBALL_ROWS, { b: 0x90caf9, w: 0xffffff, l: 0xbbdefb });
  pixelTexture(scene, TEXTURES.pellet, PELLET_ROWS, { p: 0x6a1b9a, q: 0xba68c8, w: 0xf3e5f5 });
  const flame = { r: 0xd84315, o: 0xff7043, y: 0xffca28, w: 0xfff8e1 };
  pixelTexture(scene, TEXTURES.flameA, FLAME_A, flame);
  pixelTexture(scene, TEXTURES.flameB, FLAME_B, flame);
  pixelTexture(scene, TEXTURES.lock, LOCK_ROWS, { g: 0x9e9e9e, y: COLORS.crown, k: 0x5d4037, d: shade(COLORS.crown, 0.3) });
  createFlipIcons(scene);
  createPowerIcons(scene);
}

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
  // Low gravity: a light arrow pointing up.
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
  // Upside-down: an arrow pointing up at a ceiling bar.
  pixelTexture(scene, FLIP_ICONS.upsideDown, [
    'ccccccccc',
    '.........',
    '....w....',
    '...www...',
    '..wwwww..',
    '....w....',
    '....w....',
    '....w....',
    '....w....',
  ], { c: 0xffd23f, w: 0xffffff });
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

function createPowerIcons(scene: Phaser.Scene): void {
  pixelTexture(scene, POWER_ICONS.fire, [
    '....r.....',
    '...rr.....',
    '...ror..r.',
    '..roor.rr.',
    '.rooyorror',
    '.royyyoor.',
    'royywyyor.',
    'roywwwyor.',
    '.roywyor..',
    '..rrrrr...',
  ], { r: 0xd84315, o: 0xff7043, y: 0xffca28, w: 0xfff8e1 });
  pixelTexture(scene, POWER_ICONS.water, [
    '....b.....',
    '....b.....',
    '...bbb....',
    '...bcb....',
    '..bbccb...',
    '.bbcccbb..',
    '.bcwcccb..',
    '.bcwcccb..',
    '..bcccb...',
    '...bbb....',
  ], { b: 0x1e4fa8, c: 0x3b82f6, w: 0xe3f2fd });
  pixelTexture(scene, POWER_ICONS.snow, [
    '....w.....',
    '.w..w..w..',
    '..w.w.w...',
    '...www....',
    'wwwwwwwww.',
    '...www....',
    '..w.w.w...',
    '.w..w..w..',
    '....w.....',
    '..........',
  ], { w: 0xe1f5fe });
  pixelTexture(scene, POWER_ICONS.wind, [
    '..........',
    '.wwwwww...',
    '.......w..',
    '.wwww..w..',
    '.....ww...',
    'wwwwwwwww.',
    '.........w',
    '.wwwwww..w',
    '.......ww.',
    '..........',
  ], { w: 0xe0f7fa });
}
