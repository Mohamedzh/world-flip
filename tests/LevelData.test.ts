import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LevelDataError, parseLevel, TILESET_NAME, type TiledMap } from '../src/level/LevelData';
import { TILE } from '../src/config';

const levelsDir = new URL('../public/assets/levels/', import.meta.url);
const levelFiles = readdirSync(levelsDir).filter((f) => f.endsWith('.tmj'));
const load = (file: string) => JSON.parse(readFileSync(new URL(file, levelsDir), 'utf8'));

describe('level files', () => {
  it('there is at least one level', () => {
    expect(levelFiles.length).toBeGreaterThan(0);
  });

  for (const file of levelFiles) {
    describe(file, () => {
      const map = load(file);
      const objects = parseLevel(map);

      it('uses the shared tile size and tileset', () => {
        expect(map.tilewidth).toBe(TILE);
        expect(map.tileheight).toBe(TILE);
        expect(map.tilesets.map((t: { name: string }) => t.name)).toContain(TILESET_NAME);
      });

      it('has 2-3 checkpoints, as the spec asks', () => {
        expect(objects.checkpoints.length).toBeGreaterThanOrEqual(2);
        expect(objects.checkpoints.length).toBeLessThanOrEqual(3);
      });

      it('places spawn, checkpoints and crown inside the map, left to right', () => {
        const w = map.width * TILE;
        const h = map.height * TILE;
        const all = [objects.spawn, ...objects.checkpoints, objects.crown];
        for (const p of all) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(w);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(h);
        }
        const xs = all.map((p) => p.x);
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
      });

      it('spawn, checkpoints, crown and creatures all stand on ground', () => {
        const ground = map.layers.find((l: { name: string }) => l.name === 'ground').data as number[];
        for (const p of [objects.spawn, ...objects.checkpoints, objects.crown, ...objects.enemies, ...objects.mushrooms]) {
          const col = Math.floor(p.x / TILE);
          const rowBelow = Math.round(p.y / TILE);
          expect(ground[rowBelow * map.width + col], `nothing under (${p.x}, ${p.y})`).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('parseLevel', () => {
  const base = (objects: unknown[]): TiledMap => ({
    width: 2,
    height: 2,
    tilewidth: TILE,
    tileheight: TILE,
    layers: [
      { name: 'ground', type: 'tilelayer' },
      { name: 'orange', type: 'tilelayer' },
      { name: 'blue', type: 'tilelayer' },
      { name: 'objects', type: 'objectgroup', objects: objects as never },
    ],
    properties: [{ name: 'flipOrder', type: 'string', value: 'lowGravity, colorSwap' }],
  });
  const minimal = [
    { id: 1, name: '', type: 'spawn', x: 0, y: 0 },
    { id: 2, name: '', type: 'crown', x: 9, y: 0 },
  ];

  it('rejects a level without a crown', () => {
    const map = base([{ id: 1, name: 'spawn', type: 'spawn', x: 0, y: 0 }]);
    expect(() => parseLevel(map)).toThrow(LevelDataError);
  });

  it('accepts the Tiled 1.9 class field and sorts checkpoints', () => {
    const lvl = parseLevel(
      base([
        { id: 1, name: '', class: 'spawn', x: 0, y: 0 },
        { id: 2, name: '', class: 'checkpoint', x: 50, y: 0 },
        { id: 3, name: '', class: 'checkpoint', x: 20, y: 0 },
        { id: 4, name: '', class: 'crown', x: 90, y: 0 },
      ]),
    );
    expect(lvl.checkpoints.map((c) => c.x)).toEqual([20, 50]);
  });

  it('rejects a level with a missing tile layer', () => {
    const map = base([]);
    map.layers = map.layers.filter((l) => l.name !== 'blue');
    expect(() => parseLevel(map)).toThrow(/blue/);
  });

  it('reads the flip order, trimming spaces', () => {
    expect(parseLevel(base(minimal)).flipOrder).toEqual(['lowGravity', 'colorSwap']);
  });

  it('rejects a misspelled flip and a missing flip order', () => {
    const typo = base(minimal);
    typo.properties = [{ name: 'flipOrder', type: 'string', value: 'lowGravty' }];
    expect(() => parseLevel(typo)).toThrow(/lowGravty/);
    const none = base(minimal);
    none.properties = [];
    expect(() => parseLevel(none)).toThrow(/flipOrder/);
  });

  it('reads enemies and mushrooms', () => {
    const lvl = parseLevel(
      base([...minimal, { id: 3, name: '', type: 'enemy', x: 5, y: 0 }, { id: 4, name: '', type: 'mushroom', x: 6, y: 0 }]),
    );
    expect(lvl.enemies).toEqual([{ x: 5, y: 0 }]);
    expect(lvl.mushrooms).toEqual([{ x: 6, y: 0 }]);
  });
});
