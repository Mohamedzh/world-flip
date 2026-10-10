// World 2: Lake. Adds the friend/foe swap and tougher enemies; water is deadly.
// Needs Fire (crate wall). The Tide Frog guards Water, which then grows seed pods into leaf
// platforms across the last lake (low gravity also gets you across).
import { LevelGrid, writeLevel } from '../lib/tiled.mjs';

const g = new LevelGrid(200, 15); // floor surface is row 12
const lake = (x1, x2) => g.fill(x1, x2, 12, 14, 'W');

// 1. Start, a small pool, then a crate wall that needs Fire.
g.ground(0, 20, 12);
g.place('spawn', 3, 11).place('enemy', 15, 11);
lake(21, 23);
g.ground(24, 60, 12);
g.place('checkpoint', 26, 11).place('enemy', 33, 11);
g.fill(41, 42, 8, 11, 'X');
g.place('enemy', 50, 11).place('enemy', 56, 11);

// 2. A lake with color bridges: orange just above the water, blue higher up.
lake(61, 68);
g.fill(61, 68, 11, 11, 'O');
g.fill(61, 68, 9, 9, 'B');

// 3. A bounce mushroom (it bites during the friend/foe swap), then stepping stones over a lake.
g.ground(69, 90, 12);
g.place('checkpoint', 72, 11).place('mushroom', 80, 11).place('enemy', 86, 11);
lake(91, 103);
g.ground(94, 95, 11);
g.ground(99, 100, 11);

// 4. The Tide Frog's arena, ending at the shore of the last lake.
g.ground(104, 140, 12);
g.place('checkpoint', 108, 11);
g.ground(116, 117, 10);
g.place('tideFrog', 132, 11);

// 5. The last lake: too wide to jump. Two rocks hold seed pods; one Water wave from the shore
//    reaches both and grows them into a leaf bridge.
lake(141, 155);
g.ground(145, 145, 12);
g.ground(150, 150, 12);
g.place('seedPod', 145, 11, { height: 2 }).place('seedPod', 150, 11, { height: 2 });

// 6. The crown.
g.ground(156, 199, 12);
g.place('enemy', 168, 11).place('crown', 192, 11);

writeLevel(g, new URL('../../public/assets/levels/level-2.tmj', import.meta.url), {
  name: 'Lake',
  theme: 'lake',
  flipOrder: 'friendFoe,lowGravity,colorSwap,normal',
  parTimeSec: 210,
  flipIntervalSec: 13,
  enemyHealth: 3,
  enemySpeed: 1.15,
});
