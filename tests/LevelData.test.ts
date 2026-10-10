import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LevelDataError, parseLevel, TILESETS, type TiledMap } from '../src/level/LevelData';
import { findLevel, LEVELS } from '../src/level/levels';
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
        const names = map.tilesets.map((t: { name: string }) => t.name);
        for (const ts of Object.values(TILESETS)) expect(names).toContain(ts);
      });

      it('is listed in the level registry', () => {
        expect(findLevel(file.replace(/.tmj$/, ''))?.file).toBe(file);
      });

      it('has a name and a par time', () => {
        expect(objects.name).not.toBe('Unnamed level');
        expect(objects.parMs).toBeGreaterThan(0);
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
        for (const p of [objects.spawn, ...objects.checkpoints, objects.crown, ...objects.enemies, ...objects.mushrooms, ...objects.throwers, ...objects.fireWalls, ...objects.seedPods, ...objects.guardians.filter((g) => g.kind === 'emberBeetle' || g.kind === 'tideFrog')]) {
          const col = Math.floor(p.x / TILE);
          const rowBelow = Math.round(p.y / TILE);
          expect(ground[rowBelow * map.width + col], `nothing under (${p.x}, ${p.y})`).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('flips across the worlds', () => {
  it('each world opens with its new flip first and keeps every flip from earlier worlds', () => {
    const seen = new Set<string>();
    for (const entry of LEVELS) {
      const order = parseLevel(load(entry.file)).flipOrder.filter((f) => f !== 'normal');
      const newOnes = order.filter((f) => !seen.has(f));
      for (const old of seen) expect(order, `${entry.id} is missing ${old}`).toContain(old);
      if (newOnes.length > 0) expect(newOnes, `${entry.id} should open with its new flip`).toContain(order[0]);
      for (const f of order) seen.add(f);
    }
  });
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
      { name: 'burnable', type: 'tilelayer' },
      { name: 'water', type: 'tilelayer' },
      { name: 'objects', type: 'objectgroup', objects: objects as never },
    ],
    properties: [
      { name: 'flipOrder', type: 'string', value: 'lowGravity, colorSwap' },
      { name: 'parTimeSec', type: 'int', value: 180 },
      { name: 'name', type: 'string', value: 'Meadow' },
      { name: 'theme', type: 'string', value: 'meadow' },
    ],
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
    typo.properties = [
      { name: 'flipOrder', type: 'string', value: 'lowGravty' },
      { name: 'parTimeSec', type: 'int', value: 180 },
      { name: 'theme', type: 'string', value: 'meadow' },
    ];
    expect(() => parseLevel(typo)).toThrow(/lowGravty/);
    const none = base(minimal);
    none.properties = [
      { name: 'parTimeSec', type: 'int', value: 180 },
      { name: 'theme', type: 'string', value: 'meadow' },
    ];
    expect(() => parseLevel(none)).toThrow(/flipOrder/);
  });

  it('reads the name and par time, and requires a par time', () => {
    const lvl = parseLevel(base(minimal));
    expect(lvl.name).toBe('Meadow');
    expect(lvl.parMs).toBe(180_000);
    const noPar = base(minimal);
    noPar.properties = noPar.properties!.filter((p) => p.name !== 'parTimeSec');
    expect(() => parseLevel(noPar)).toThrow(/parTimeSec/);
  });

  it('defaults flip mode, enemy health and speed; rejects a bad theme or flip mode', () => {
    const lvl = parseLevel(base(minimal));
    expect([lvl.flipMode, lvl.enemyHealth, lvl.enemySpeed, lvl.arrowDamage]).toEqual(['fixed', 2, 1, 1]);
    const badTheme = base(minimal);
    badTheme.properties = badTheme.properties!.map((p) => (p.name === 'theme' ? { ...p, value: 'moon' } : p));
    expect(() => parseLevel(badTheme)).toThrow(/theme/);
    const badMode = base(minimal);
    badMode.properties!.push({ name: 'flipMode', type: 'string', value: 'shuffle' });
    expect(() => parseLevel(badMode)).toThrow(/flipMode/);
  });

  it('arrows hit harder from World 3 on, where enemies are tougher', () => {
    expect(parseLevel(load('level-1.tmj')).arrowDamage).toBe(1);
    expect(parseLevel(load('level-3.tmj')).arrowDamage).toBe(2);
    expect(parseLevel(load('level-4.tmj')).arrowDamage).toBe(2);
  });

  it('reads seed pods with their height (default 3), fire walls and throwers', () => {
    const lvl = parseLevel(
      base([
        ...minimal,
        { id: 3, name: '', type: 'seedPod', x: 1, y: 0 },
        { id: 4, name: '', type: 'seedPod', x: 2, y: 0, properties: [{ name: 'height', type: 'int', value: 5 }] },
        { id: 5, name: '', type: 'fireWall', x: 3, y: 0 },
        { id: 6, name: '', type: 'thrower', x: 4, y: 0 },
      ]),
    );
    expect(lvl.seedPods).toEqual([
      { x: 1, y: 0, height: 3 },
      { x: 2, y: 0, height: 5 },
    ]);
    expect(lvl.fireWalls).toEqual([{ x: 3, y: 0 }]);
    expect(lvl.throwers).toEqual([{ x: 4, y: 0 }]);
  });

  it('reads guardians by kind', () => {
    const lvl = parseLevel(base([...minimal, { id: 3, name: '', type: 'emberBeetle', x: 7, y: 0 }]));
    expect(lvl.guardians).toEqual([{ kind: 'emberBeetle', x: 7, y: 0 }]);
  });

  it('reads enemies and mushrooms', () => {
    const lvl = parseLevel(
      base([...minimal, { id: 3, name: '', type: 'enemy', x: 5, y: 0 }, { id: 4, name: '', type: 'mushroom', x: 6, y: 0 }]),
    );
    expect(lvl.enemies).toEqual([{ x: 5, y: 0 }]);
    expect(lvl.mushrooms).toEqual([{ x: 6, y: 0 }]);
  });
});
