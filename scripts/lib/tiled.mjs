// Shared helpers for building level files in the Tiled map format (.tmj).
// Levels are drawn on a character grid, then turned into tile layers:
//   '#' ground (auto-tiled with Kenney grass and dirt)   'O' orange block   'B' blue block
//   'X' wooden crate (burnable)                           '.' empty
import { writeFileSync } from 'node:fs';

export const TILE = 18;

// Tilesets. Kenney's Pixel Platformer tiles come first; the orange/blue blocks stay our own,
// because they need stripes and dots for color-blind players (spec).
const KENNEY = { firstgid: 1, name: 'kenney', image: '../kenney/tiles.png', columns: 20, rows: 9 };
const BLOCKS = { firstgid: 181, name: 'placeholder', image: '../tiles/placeholder-tiles.png', columns: 4, rows: 1 };

/** Kenney tile index (0-based, as numbered on the sheet) to the map's tile id. */
const kenney = (index) => KENNEY.firstgid + index;
const T = {
  // Ground with a grass top: left edge, middle, right edge.
  grassLeft: kenney(21),
  grass: kenney(22),
  grassRight: kenney(23),
  // A floating one-tile-high platform: single, left, middle, right.
  platformSingle: kenney(0),
  platformLeft: kenney(1),
  platform: kenney(2),
  platformRight: kenney(3),
  // Dirt under the grass: left edge, middle, right edge.
  dirtLeft: kenney(121),
  dirt: kenney(122),
  dirtRight: kenney(123),
  crate: kenney(26),
  orange: BLOCKS.firstgid + 2,
  blue: BLOCKS.firstgid + 3,
  // Decorations drawn on top of ground: grass sprouts and a small tree.
  sprout: kenney(124),
  tallSprout: kenney(125),
  tree: kenney(126),
};

export class LevelGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.rows = Array.from({ length: height }, () => Array(width).fill('.'));
    this.objects = [];
  }

  /** Fills columns x1..x2 and rows y1..y2 (inclusive) with `ch`. */
  fill(x1, x2, y1, y2, ch) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.rows[y][x] = ch;
    return this;
  }

  /** Solid ground from row `top` down to the bottom of the map. */
  ground(x1, x2, top) {
    return this.fill(x1, x2, top, this.height - 1, '#');
  }

  /**
   * Places a point object standing on the floor of tile (col, row):
   * x = tile center, y = top of the tile below.
   */
  place(type, col, row) {
    this.objects.push({ type, x: col * TILE + TILE / 2, y: (row + 1) * TILE });
    return this;
  }

  at(x, y) {
    if (x < 0 || x >= this.width) return '#'; // map sides count as ground, so no edge is drawn there
    if (y < 0 || y >= this.height) return '.';
    return this.rows[y][x];
  }
}

function groundTile(g, x, y) {
  const solid = (dx, dy) => g.at(x + dx, y + dy) === '#';
  const left = solid(-1, 0);
  const right = solid(1, 0);
  if (solid(0, -1)) return !left ? T.dirtLeft : !right ? T.dirtRight : T.dirt;
  if (!solid(0, 1)) {
    // A one-tile-high floating platform.
    if (!left && !right) return T.platformSingle;
    return !left ? T.platformLeft : !right ? T.platformRight : T.platform;
  }
  return !left ? T.grassLeft : !right ? T.grassRight : T.grass;
}

/** A repeatable pseudo-random number in [0, 1) for a tile, so decorations don't move between builds. */
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Writes the level as a .tmj file.
 * properties: map properties, e.g. { name: 'Meadow', flipOrder: 'lowGravity,colorSwap', parTimeSec: 180 }
 */
export function writeLevel(g, outUrl, properties) {
  const layerData = { ground: [], orange: [], blue: [], burnable: [], decor: [] };
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const ch = g.rows[y][x];
      layerData.ground.push(ch === '#' ? groundTile(g, x, y) : 0);
      layerData.orange.push(ch === 'O' ? T.orange : 0);
      layerData.blue.push(ch === 'B' ? T.blue : 0);
      layerData.burnable.push(ch === 'X' ? T.crate : 0);
      // Sprinkle a few plants on open grass.
      const onGrass = ch === '.' && g.at(x, y + 1) === '#' && g.at(x, y - 1) === '.';
      const r = hash(x, y);
      layerData.decor.push(onGrass && r < 0.18 ? (r < 0.06 ? T.tree : r < 0.12 ? T.tallSprout : T.sprout) : 0);
    }
  }

  let nextLayerId = 1;
  const tileLayer = (name, data) => ({
    id: nextLayerId++,
    name,
    type: 'tilelayer',
    width: g.width,
    height: g.height,
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    data,
  });
  const objects = g.objects.map((o, i) => ({
    id: i + 1,
    name: o.type,
    type: o.type,
    x: o.x,
    y: o.y,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    point: true,
  }));
  const tileset = (ts) => ({
    firstgid: ts.firstgid,
    name: ts.name,
    image: ts.image,
    imagewidth: ts.columns * TILE,
    imageheight: ts.rows * TILE,
    tilewidth: TILE,
    tileheight: TILE,
    tilecount: ts.columns * ts.rows,
    columns: ts.columns,
    margin: 0,
    spacing: 0,
  });
  const propType = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : 'string');

  const map = {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    compressionlevel: -1,
    width: g.width,
    height: g.height,
    tilewidth: TILE,
    tileheight: TILE,
    properties: Object.entries(properties).map(([name, value]) => ({ name, type: propType(value), value })),
    tilesets: [tileset(KENNEY), tileset(BLOCKS)],
    layers: [
      tileLayer('decor', layerData.decor),
      tileLayer('blue', layerData.blue),
      tileLayer('ground', layerData.ground),
      tileLayer('orange', layerData.orange),
      tileLayer('burnable', layerData.burnable),
      { id: nextLayerId++, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
    ],
    nextlayerid: nextLayerId,
    nextobjectid: objects.length + 1,
  };
  writeFileSync(outUrl, JSON.stringify(map, null, 1));
  console.log(`Wrote ${outUrl.pathname} (${g.width}x${g.height} tiles, ${objects.length} objects)`);
}
