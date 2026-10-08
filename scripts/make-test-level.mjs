// Builds the milestone 1 test level as a Tiled map (.tmj) so it can be opened and edited in Tiled.
// Once the level has been edited in Tiled, don't re-run this script: it would overwrite those edits.
// Run: npm run gen:level
import { writeFileSync } from 'node:fs';

const TILE = 18;
const W = 110;
const H = 15; // 15 rows x 18 px = 270 px, exactly one screen tall
const OUT = new URL('../public/assets/levels/test-level.tmj', import.meta.url);

// Tile ids (1-based, matching the column order in placeholder-tiles.png)
const GRASS = 1;
const DIRT = 2;
const ORANGE = 3;
const BLUE = 4;

const grid = Array.from({ length: H }, () => Array(W).fill('.'));
function fill(x1, x2, y1, y2, ch) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) grid[y][x] = ch;
}

// --- Layout: '#' ground, 'O' orange block, 'B' blue block. Floor surface is row 12. ---
fill(0, 21, 12, 14, '#'); //   start area
fill(15, 18, 10, 11, '#'); //  first step up
//                             pit at 22-24
fill(25, 39, 12, 14, '#'); //  checkpoint 1 area
fill(42, 43, 10, 10, '#'); //  floating stepping stones over the pit at 40-48
fill(46, 47, 9, 9, '#');
fill(49, 55, 12, 14, '#');
fill(56, 61, 12, 12, 'O'); //  orange bridge over a pit (solid in the Normal state)
fill(57, 60, 8, 8, 'B'); //    blue blocks are ghosts in the Normal state
fill(62, 84, 12, 14, '#'); //  checkpoint 2 area
fill(72, 73, 11, 11, '#'); //  staircase
fill(74, 75, 10, 11, '#');
fill(76, 84, 9, 11, '#'); //   high ledge, then a pit at 85-88
fill(89, 109, 12, 14, '#'); // final stretch to the crown
fill(95, 95, 9, 11, 'B'); //   a blue "wall" you can walk through

const objects = [
  point('spawn', 3, 11),
  point('checkpoint', 30, 11),
  point('checkpoint', 66, 11),
  point('crown', 104, 11),
].map((obj, i) => ({ id: i + 1, ...obj }));

const ground = [];
const orange = [];
const blue = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ch = grid[y][x];
    const above = y > 0 ? grid[y - 1][x] : '.';
    ground.push(ch === '#' ? (above === '#' ? DIRT : GRASS) : 0);
    orange.push(ch === 'O' ? ORANGE : 0);
    blue.push(ch === 'B' ? BLUE : 0);
  }
}

let nextLayerId = 1;
const tileLayer = (name, data) => ({
  id: nextLayerId++,
  name,
  type: 'tilelayer',
  width: W,
  height: H,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  data,
});

const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  compressionlevel: -1,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  tilesets: [
    {
      firstgid: 1,
      name: 'placeholder',
      image: '../tiles/placeholder-tiles.png',
      imagewidth: TILE * 4,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: 4,
      columns: 4,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [
    tileLayer('blue', blue),
    tileLayer('ground', ground),
    tileLayer('orange', orange),
    {
      id: nextLayerId++,
      name: 'objects',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects,
    },
  ],
  nextlayerid: nextLayerId,
  nextobjectid: objects.length + 1,
};

writeFileSync(OUT, JSON.stringify(map, null, 1));
console.log(`Wrote ${OUT.pathname} (${W}x${H} tiles, ${objects.length} objects)`);

// A point object marks where a thing stands: x = tile center, y = top of the tile below (the floor).
function point(type, col, row) {
  return {
    name: type,
    type,
    x: col * TILE + TILE / 2,
    y: (row + 1) * TILE,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    point: true,
  };
}
