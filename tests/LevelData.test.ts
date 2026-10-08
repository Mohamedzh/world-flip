import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LevelDataError, parseLevelObjects, TILESET_NAME, type TiledMap } from '../src/level/LevelData';
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
      const objects = parseLevelObjects(map);

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

      it('spawn, checkpoints and crown all stand on ground', () => {
        const ground = map.layers.find((l: { name: string }) => l.name === 'ground').data as number[];
        for (const p of [objects.spawn, ...objects.checkpoints, objects.crown]) {
          const col = Math.floor(p.x / TILE);
          const rowBelow = Math.round(p.y / TILE);
          expect(ground[rowBelow * map.width + col], `nothing under (${p.x}, ${p.y})`).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('parseLevelObjects', () => {
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
  });

  it('rejects a level without a crown', () => {
    const map = base([{ id: 1, name: 'spawn', type: 'spawn', x: 0, y: 0 }]);
    expect(() => parseLevelObjects(map)).toThrow(LevelDataError);
  });

  it('accepts the Tiled 1.9 class field and sorts checkpoints', () => {
    const lvl = parseLevelObjects(
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
    expect(() => parseLevelObjects(map)).toThrow(/blue/);
  });
});
