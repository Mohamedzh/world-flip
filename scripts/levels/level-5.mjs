// World 5: Crown Castle. A short walk to the door (it opens only with all four powers), then the
// Shifting King's hall. Every flip can happen here, in random order, with a longer window between
// flips so all four shield pieces can be broken in one go. The hall has a ceiling for upside-down.
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(80, 15); // floor surface is row 12, ceiling rows 0-1

g.ceiling(0, 79, 1);
g.ground(0, 79, 12);

// The approach and the door, set in a wall from the ceiling down to the doorway.
g.place('spawn', 3, 11).place('checkpoint', 8, 11);
g.fill(14, 14, 2, 9, '#');
g.place('bossDoor', 14, 11);

// The hall: a few platforms to dodge on, including color blocks for the color swap.
g.place('checkpoint', 18, 11);
g.fill(25, 28, 8, 8, '#');
g.fill(70, 73, 8, 8, '#');
g.fill(39, 42, 9, 9, 'O');
g.fill(56, 59, 9, 9, 'B');
g.place('shiftingKing', 50, 11);
// The crown appears here once the King is beaten.
g.place('crown', 49, 11);

writeLevel(g, new URL('../../public/assets/levels/level-5.tmj', import.meta.url), {
  name: 'Crown Castle',
  theme: 'castle',
  flipMode: 'random',
  flipOrder: 'lowGravity,colorSwap,friendFoe,upsideDown,normal',
  flipIntervalSec: 20,
  parTimeSec: 300,
});
