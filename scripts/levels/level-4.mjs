// World 4: Sky. The flips come in random order (spec), so there is a cloud ceiling all the way
// along for the upside-down flip. Needs Fire, Water and Snow, including the Water-then-Snow combo.
// The Storm Hawk guards Wind, whose double jump crosses the last gap.
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(220, 15); // floor surface is row 12, ceiling rows 0-1
const lake = (x1, x2) => g.fill(x1, x2, 12, 14, 'W');

g.ceiling(0, 219, 1);

// 1. Start, a pit, a bounce mushroom, then crates from floor to ceiling (Fire).
g.ground(0, 18, 12);
g.place('spawn', 3, 11).place('enemy', 12, 11);
g.ground(22, 40, 12);
g.place('checkpoint', 24, 11).place('mushroom', 30, 11);
g.fill(37, 38, 2, 11, 'X');

// 2. A thrower, then a fire wall (Water), then a lake (Snow).
g.ground(41, 60, 12);
g.place('enemy', 46, 11).place('thrower', 52, 11).place('fireWall', 58, 11);
lake(61, 70);

// 3. Color bridges over a pit.
g.ground(71, 95, 12);
g.place('checkpoint', 74, 11).place('enemy', 84, 11);
g.fill(96, 103, 12, 12, 'O');
g.fill(96, 103, 10, 10, 'B');

// 4. A gap with no rocks: send a Water wave across it, then freeze the water with Snow.
g.ground(104, 125, 12);
g.place('enemy', 110, 11).place('thrower', 120, 11);

// 5. The Storm Hawk's arena.
g.ground(132, 160, 12);
g.place('checkpoint', 135, 11);
g.place('stormHawk', 150, 8);

// 6. The widest gap: Wind's double jump gets across.
g.ground(168, 219, 12);
g.place('enemy', 178, 11).place('thrower', 190, 11).place('crown', 212, 11);

writeLevel(g, new URL('../../public/assets/levels/level-4.tmj', import.meta.url), {
  name: 'Sky',
  theme: 'sky',
  flipMode: 'random',
  flipOrder: 'lowGravity,colorSwap,friendFoe,upsideDown,normal',
  parTimeSec: 270,
  enemyHealth: 4,
  enemySpeed: 1.4,
});
