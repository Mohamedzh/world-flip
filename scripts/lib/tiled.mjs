// Shared helpers for building level files in the Tiled map format (.tmj).
// Levels are drawn on a character grid, then turned into tile layers:
//   '#' ground (auto-tiled with Kenney grass or snow, and dirt)   'O' orange block   'B' blue block
//   'X' wooden crate (burnable)   'W' water (deadly, Snow freezes it)   '.' empty
import { writeFileSync } from 'node:fs';

export const TILE = 18;

// Tilesets. Kenney's Pixel Platformer tiles come first; the orange/blue blocks stay our own,
// because they need stripes and dots for color-blind players (spec). Ice is ours too.
const KENNEY = { firstgid: 1, name: 'kenney', image: '../kenney/tiles.png', columns: 20, rows: 9 };
const BLOCKS = { firstgid: 181, name: 'placeholder', image: '../tiles/placeholder-tiles.png', columns: 5, rows: 1 };

/** Kenney tile index (0-based, as numbered on the sheet) to the map's tile id. */
const kenney = (index) => KENNEY.firstgid + index;

/** Ground tiles per theme: top row [left, middle, right], one-tile platforms [single, left, middle, right]. */
const GROUND = {
  grass: { top: [21, 22, 23], platform: [0, 1, 2, 3] },
  snow: { top: [101, 102, 103], platform: [80, 81, 82, 83] },
};
/** Each world's look; the game uses the same theme name for the background. */
export const THEMES = { meadow: 'grass', lake: 'grass', mountain: 'snow', sky: 'grass', castle: 'snow' };

const T = {
  // Dirt under the top row: left edge, middle, right edge.
  dirtLeft: kenney(121),
  dirt: kenney(122),
  dirtRight: kenney(123),
  crate: kenney(26),
  waterTop: kenney(33),
  water: kenney(53),
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

  /** A ceiling hanging from the top of the map down to row `bottom`. */
  ceiling(x1, x2, bottom) {
    return this.fill(x1, x2, 0, bottom, '#');
  }

  /**
   * Places a point object standing on the floor of tile (col, row):
   * x = tile center, y = top of the tile below. `properties` become Tiled custom properties.
   */
  place(type, col, row, properties = {}) {
    this.objects.push({ type, x: col * TILE + TILE / 2, y: (row + 1) * TILE, properties });
    return this;
  }

  at(x, y) {
    if (x < 0 || x >= this.width) return '#'; // map sides count as ground, so no edge is drawn there
    if (y < 0 || y >= this.height) return '.';
    return this.rows[y][x];
  }
}

function groundTile(g, x, y, set) {
  const solid = (dx, dy) => g.at(x + dx, y + dy) === '#';
  const left = solid(-1, 0);
  const right = solid(1, 0);
  const pick = ([l, m, r]) => kenney(!left ? l : !right ? r : m);
  if (solid(0, -1)) return !left ? T.dirtLeft : !right ? T.dirtRight : T.dirt;
  if (!solid(0, 1)) {
    // A one-tile-high floating platform.
    if (!left && !right) return kenney(set.platform[0]);
    return pick(set.platform.slice(1));
  }
  return pick(set.top);
}

/** A repeatable pseudo-random number in [0, 1) for a tile, so decorations don't move between builds. */
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const propType = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : 'string');
const toProps = (obj) => Object.entries(obj).map(([name, value]) => ({ name, type: propType(value), value }));

/**
 * Writes the level as a .tmj file.
 * properties: map properties, e.g. { name: 'Meadow', theme: 'meadow', flipOrder: 'lowGravity,colorSwap', parTimeSec: 180 }
 */
export function writeLevel(g, outUrl, properties) {
  const set = GROUND[THEMES[properties.theme] ?? 'grass'];
  const layerData = { ground: [], orange: [], blue: [], burnable: [], water: [], decor: [] };
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const ch = g.rows[y][x];
      layerData.ground.push(ch === '#' ? groundTile(g, x, y, set) : 0);
      layerData.orange.push(ch === 'O' ? T.orange : 0);
      layerData.blue.push(ch === 'B' ? T.blue : 0);
      layerData.burnable.push(ch === 'X' ? T.crate : 0);
      layerData.water.push(ch === 'W' ? (g.at(x, y - 1) === 'W' ? T.water : T.waterTop) : 0);
      // Sprinkle a few plants on open ground (not on snow).
      const onGround = ch === '.' && g.at(x, y + 1) === '#' && g.at(x, y - 1) === '.' && set === GROUND.grass;
      const r = hash(x, y);
      layerData.decor.push(onGround && r < 0.18 ? (r < 0.06 ? T.tree : r < 0.12 ? T.tallSprout : T.sprout) : 0);
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
    ...(Object.keys(o.properties).length > 0 ? { properties: toProps(o.properties) } : {}),
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
    properties: toProps(properties),
    tilesets: [tileset(KENNEY), tileset(BLOCKS)],
    layers: [
      tileLayer('decor', layerData.decor),
      tileLayer('water', layerData.water),
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
