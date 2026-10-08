// World 1: Meadow. Introduces low gravity and the color swap; the Ember Beetle guards Fire,
// which is then needed to burn the crate wall before the crown.
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(190, 15); // floor surface is row 12

// 1. Start: flat ground with a small bump and the first enemy.
g.ground(0, 24, 12);
g.ground(10, 12, 11);
g.place('spawn', 3, 11).place('enemy', 18, 11);

// 2. A small pit, then the bounce mushroom and a high shortcut over the next pit.
//    The shortcut is also reachable in low gravity.
g.ground(28, 47, 12);
g.place('checkpoint', 30, 11).place('mushroom', 38, 11).place('enemy', 44, 11);
g.fill(40, 50, 6, 6, '#');
g.fill(49, 50, 10, 10, '#'); // stepping stone for the low path over the pit at 48-52

// 3. Color bridges: orange is solid normally; in the color swap it vanishes and the blue one above turns solid.
g.ground(53, 66, 12);
g.place('enemy', 60, 11);
g.fill(67, 74, 12, 12, 'O');
g.fill(67, 74, 10, 10, 'B');

// 4. Staircase to a ledge, a stepping stone, then a pit.
g.ground(75, 92, 12);
g.place('checkpoint', 78, 11);
g.ground(84, 85, 11);
g.ground(86, 87, 10);
g.ground(88, 92, 9);
g.place('enemy', 90, 8);
g.fill(95, 95, 9, 9, '#');

// 5. The Ember Beetle's arena, closed on the right by a crate wall only Fire (or low gravity) gets past.
g.ground(98, 142, 12);
g.place('enemy', 105, 11).place('checkpoint', 115, 11);
g.ground(112, 113, 10); // a low wall that keeps the beetle in its arena
g.place('emberBeetle', 132, 11);
g.fill(141, 142, 7, 11, 'X');

// 6. Final stretch: a blue wall (solid only in the color swap, low enough to jump), a pit, the crown.
g.ground(143, 160, 12);
g.place('enemy', 150, 11);
g.fill(156, 156, 9, 11, 'B');
g.ground(164, 189, 12);
g.place('enemy', 170, 11).place('crown', 184, 11);

writeLevel(g, new URL('../../public/assets/levels/level-1.tmj', import.meta.url), {
  name: 'Meadow',
  theme: 'meadow',
  flipOrder: 'lowGravity,colorSwap,normal',
  parTimeSec: 180,
});
