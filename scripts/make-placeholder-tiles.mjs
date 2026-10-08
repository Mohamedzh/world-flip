// Draws the placeholder tileset (plain colored shapes, per the spec's milestone 1-2 art plan)
// and writes it as a PNG, so both Phaser and the Tiled editor can use it.
// Run: npm run gen:tiles
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TILE = 18;
// Tile order matters: tile id N in the level file is column N-1 here.
const TILES = ['grass', 'dirt', 'orange', 'blue', 'ice'];
const OUT = new URL('../public/assets/tiles/placeholder-tiles.png', import.meta.url);

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255, 255];
const C = {
  grass: hex(0x5ab552),
  grassDark: hex(0x3e8a3a),
  dirt: hex(0x8b5a2b),
  dirtDark: hex(0x6e4520),
  orange: hex(0xf28c28),
  orangeDark: hex(0xb85f0e),
  blue: hex(0x3b82f6),
  blueDark: hex(0x1e4fa8),
  ice: hex(0xeef8ff),
  iceLight: hex(0xffffff),
  iceDark: hex(0x7fb6d9),
  iceTint: hex(0xcfeafa),
};

// Each painter returns the RGBA color for pixel (x, y) inside one tile.
const painters = {
  grass: (x, y) => (y < 4 ? (y === 3 ? C.grassDark : C.grass) : painters.dirt(x, y)),
  dirt: (x, y) => ((x * 7 + y * 13) % 11 === 0 ? C.dirtDark : C.dirt),
  // Orange blocks carry diagonal stripes, blue blocks carry dots, so they differ without color.
  orange: (x, y) => (border(x, y) || (x + y) % 6 < 2 ? C.orangeDark : C.orange),
  blue: (x, y) => (border(x, y) || (x % 6 === 3 && y % 6 === 3) ? C.blueDark : C.blue),
  // Ice bridges (Snow): nearly white, with a blue edge and a few pale streaks, so they stand out from water.
  ice: (x, y) =>
    border(x, y) ? C.iceDark : (x - y + 18) % 9 === 0 && x > 2 && x < 15 ? C.iceLight : (x + 2 * y) % 13 === 0 ? C.iceTint : C.ice,
};
function border(x, y) {
  return x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
}

const width = TILE * TILES.length;
const height = TILE;
const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  const row = y * (width * 4 + 1);
  raw[row] = 0; // PNG filter type: none
  for (let x = 0; x < width; x++) {
    const rgba = painters[TILES[Math.floor(x / TILE)]](x % TILE, y);
    raw.set(rgba, row + 1 + x * 4);
  }
}

writeFileSync(OUT, encodePng(width, height, raw));
console.log(`Wrote ${OUT.pathname} (${width}x${height}, tiles: ${TILES.join(', ')})`);

function encodePng(w, h, pixelRows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixelRows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
