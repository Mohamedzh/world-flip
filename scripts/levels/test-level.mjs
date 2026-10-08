// A short development level that has every flip, creature and the guardian close together.
// Play it with http://localhost:5173/?level=test-level
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(130, 15); // floor surface is row 12

g.ground(0, 21, 12); //   start area, one enemy patrolling
g.ground(15, 18, 10); //  first step up
//                        pit at 22-24
g.ground(25, 39, 12); //  checkpoint 1 area with a bounce mushroom
g.fill(33, 40, 6, 6, '#'); // high shortcut: reach it with the mushroom or in low gravity
g.fill(42, 43, 10, 10, '#'); // stepping stones over the pit at 40-48
g.fill(46, 47, 9, 9, '#');
g.ground(49, 55, 12);
g.fill(56, 61, 12, 12, 'O'); // orange bridge: vanishes in the color swap...
g.fill(56, 61, 10, 10, 'B'); // ...and this blue bridge turns solid instead
g.ground(62, 84, 12); //  checkpoint 2 area
g.ground(72, 73, 11); //  staircase
g.ground(74, 75, 10);
g.ground(76, 84, 9); //   high ledge, then a pit at 85-88
g.ground(89, 129, 12); // guardian, crates and the crown
g.fill(95, 95, 9, 11, 'B'); // blue wall: walk through normally, jump it in the color swap
g.fill(112, 113, 7, 11, 'X'); // crate wall: burn it with Fire

g.place('spawn', 3, 11)
  .place('enemy', 10, 11)
  .place('checkpoint', 27, 11)
  .place('mushroom', 31, 11)
  .place('enemy', 52, 11)
  .place('checkpoint', 64, 11)
  .place('enemy', 69, 11)
  .place('emberBeetle', 104, 11)
  .place('crown', 124, 11);

writeLevel(g, new URL('../../public/assets/levels/test-level.tmj', import.meta.url), {
  name: 'Test Level',
  flipOrder: 'lowGravity,colorSwap,friendFoe,normal',
  parTimeSec: 90,
});
