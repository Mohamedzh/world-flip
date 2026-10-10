// World 3: Mountain. A cave with a ceiling all the way along, for the new upside-down flip (spec:
// every reversal area has a ceiling). Enemies are tougher and some throw pellets.
// Needs Water (fire wall, seed pods). The Frost Owl guards Snow, which freezes the last lake.
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(210, 15); // floor surface is row 12, ceiling rows 0-1
const lake = (x1, x2) => g.fill(x1, x2, 12, 14, 'W');

g.ceiling(0, 209, 1);
// Rocks hanging from the ceiling: walls to jump over when walking upside-down.
g.fill(44, 45, 2, 4, '#');
g.fill(112, 113, 2, 4, '#');
g.fill(176, 177, 2, 4, '#');

// 1. Start and a pit.
g.ground(0, 25, 12);
g.place('spawn', 3, 11).place('enemy', 14, 11).place('thrower', 22, 11);

// 2. A fire wall from floor to ceiling: only Water puts it out.
g.ground(29, 50, 12);
g.place('checkpoint', 31, 11).place('fireWall', 40, 11).place('enemy', 47, 11);

// 3. A lake with color bridges.
lake(51, 58);
g.fill(51, 58, 11, 11, 'O');
g.fill(51, 58, 8, 8, 'B');

// 4. A cliff too tall to jump: two seed pods grow a leaf staircase up to it (or walk the ceiling).
g.ground(59, 74, 12);
g.place('checkpoint', 62, 11);
g.place('seedPod', 67, 11, { height: 2 }).place('seedPod', 72, 11, { height: 4 });
g.ground(75, 95, 7);
g.place('enemy', 88, 6);

// 5. Down again, past a thrower, to the Frost Owl's arena.
g.ground(96, 150, 12);
g.place('checkpoint', 100, 11).place('thrower', 110, 11);
g.ground(119, 120, 10);
g.place('frostOwl', 135, 8);

// 6. The last lake: Snow freezes it into an ice bridge for 8 seconds.
lake(151, 160);

// 7. The crown.
g.ground(161, 209, 12);
g.place('enemy', 170, 11).place('thrower', 184, 11).place('crown', 202, 11);

writeLevel(g, new URL('../../public/assets/levels/level-3.tmj', import.meta.url), {
  name: 'Mountain',
  theme: 'mountain',
  flipOrder: 'upsideDown,colorSwap,lowGravity,friendFoe,normal',
  parTimeSec: 240,
  flipIntervalSec: 12,
  enemyHealth: 4,
  arrowDamage: 2,
  enemySpeed: 1.3,
});
