// Reads the parts of a Tiled map (.tmj) that the game needs, and checks the level is complete.
// Plain TypeScript so every level file can be validated by the unit tests.
import { BOW } from '../config';
import type { Point } from '../systems/CheckpointTracker';
import { FLIP_STATES, isFlipState, type FlipState } from '../systems/flips';
import type { FlipMode } from '../systems/FlipManager';
import type { Element } from '../systems/powers';

/** One tile layer per block type (spec). */
export const TILE_LAYERS = {
  ground: 'ground',
  orange: 'orange',
  blue: 'blue',
  /** Wooden crates that Fire burns away. */
  burnable: 'burnable',
  /** Deadly water. Snow freezes its surface into an ice bridge. */
  water: 'water',
} as const;

/** Optional layer of plants and other decorations, drawn behind everything and never solid. */
export const DECOR_LAYER = 'decor';

export const OBJECT_LAYER = 'objects';

/** Tilesets used by the .tmj files: Kenney's tiles, and our own orange/blue blocks. */
export const TILESETS = {
  kenney: 'kenney',
  blocks: 'placeholder',
} as const;

/** Guardian enemies, and the power each one gives (spec). */
export const GUARDIANS = {
  emberBeetle: { name: 'Ember Beetle', element: 'fire' },
  tideFrog: { name: 'Tide Frog', element: 'water' },
  frostOwl: { name: 'Frost Owl', element: 'snow' },
  stormHawk: { name: 'Storm Hawk', element: 'wind' },
} as const satisfies Record<string, { name: string; element: Element }>;
export type GuardianKind = keyof typeof GUARDIANS;

export interface GuardianSpawn extends Point {
  kind: GuardianKind;
}

/** Map property listing the level's flips in order, e.g. "lowGravity,colorSwap,friendFoe,normal". */
export const FLIP_ORDER_PROPERTY = 'flipOrder';
/** Map property: par time in seconds, for the 2- and 3-star ratings. */
export const PAR_PROPERTY = 'parTimeSec';
/** Map property: the level's name, shown to the player. */
export const NAME_PROPERTY = 'name';

/** Each world's look (background and ground). */
export const THEMES = ['meadow', 'lake', 'mountain', 'sky', 'castle'] as const;
export type Theme = (typeof THEMES)[number];

/** A seed pod grows this many tiles tall when watered, unless its object says otherwise. */
export const DEFAULT_POD_HEIGHT = 3;

export interface SeedPodSpawn extends Point {
  height: number;
}

/** The minimal slice of the Tiled JSON format used here. */
export interface TiledObject {
  id: number;
  name: string;
  properties?: TiledProperty[];
  /** Tiled 1.10+ writes an object's class as `type`; 1.9 briefly used `class`. */
  type?: string;
  class?: string;
  x: number;
  y: number;
}

export interface TiledLayer {
  name: string;
  type: string;
  objects?: TiledObject[];
}

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  properties?: TiledProperty[];
}

export interface LevelData {
  name: string;
  theme: Theme;
  parMs: number;
  /** fixed: flips in list order; random: picked at random from the list (level 4). */
  flipMode: FlipMode;
  /** Basic enemies get tougher and faster in later worlds (spec). */
  enemyHealth: number;
  enemySpeed: number;
  /** A plain arrow's damage (2 from World 3 on, where enemies have 4 health). */
  arrowDamage: number;
  spawn: Point;
  /** Sorted left to right. */
  checkpoints: Point[];
  crown: Point;
  enemies: Point[];
  /** Bounce mushrooms, the friend creature. */
  mushrooms: Point[];
  guardians: GuardianSpawn[];
  /** Enemies that stand back and throw slow pellets (the Knight's swing knocks them back). */
  throwers: Point[];
  /** The final boss, the Shifting King (only in the castle). */
  boss: Point | null;
  /** A door that opens only for a hero with all four powers (spec). */
  bossDoors: Point[];
  /** Overrides the usual time between flips, e.g. a longer window for the boss fight. */
  flipIntervalMs: number | null;
  seedPods: SeedPodSpawn[];
  fireWalls: Point[];
  flipOrder: FlipState[];
}

export class LevelDataError extends Error {}

export function parseLevel(map: TiledMap): LevelData {
  for (const name of Object.values(TILE_LAYERS)) {
    if (!map.layers.some((l) => l.name === name && l.type === 'tilelayer')) {
      throw new LevelDataError(`Level is missing the tile layer "${name}"`);
    }
  }
  const layer = map.layers.find((l) => l.name === OBJECT_LAYER && l.type === 'objectgroup');
  if (!layer?.objects) throw new LevelDataError(`Level is missing the object layer "${OBJECT_LAYER}"`);

  const objectsOf = (kind: string) => layer.objects!.filter((o) => (o.type || o.class || o.name) === kind);
  const ofKind = (kind: string) => objectsOf(kind).map(({ x, y }) => ({ x, y }));

  const spawns = ofKind('spawn');
  const crowns = ofKind('crown');
  if (spawns.length !== 1) throw new LevelDataError(`Level needs exactly 1 spawn, found ${spawns.length}`);
  if (crowns.length !== 1) throw new LevelDataError(`Level needs exactly 1 crown, found ${crowns.length}`);

  const guardians: GuardianSpawn[] = [];
  for (const kind of Object.keys(GUARDIANS) as GuardianKind[]) {
    for (const p of ofKind(kind)) guardians.push({ kind, ...p });
  }

  const par = property(map, PAR_PROPERTY);
  if (typeof par !== 'number' || par <= 0) {
    throw new LevelDataError(`Level needs a "${PAR_PROPERTY}" map property: the par time in seconds`);
  }
  const name = property(map, NAME_PROPERTY);
  const theme = property(map, 'theme');
  if (typeof theme !== 'string' || !(THEMES as readonly string[]).includes(theme)) {
    throw new LevelDataError(`Level needs a "theme" map property: one of ${THEMES.join(', ')}`);
  }
  const flipMode = property(map, 'flipMode') ?? 'fixed';
  if (flipMode !== 'fixed' && flipMode !== 'random') {
    throw new LevelDataError(`"flipMode" must be fixed or random, not "${String(flipMode)}"`);
  }
  const number = (key: string, fallback: number) => {
    const v = property(map, key);
    return typeof v === 'number' && v > 0 ? v : fallback;
  };

  return {
    name: typeof name === 'string' && name ? name : 'Unnamed level',
    theme: theme as Theme,
    parMs: par * 1000,
    flipMode,
    enemyHealth: number('enemyHealth', 2),
    enemySpeed: number('enemySpeed', 1),
    arrowDamage: number('arrowDamage', BOW.damage),
    spawn: spawns[0],
    checkpoints: ofKind('checkpoint').sort((a, b) => a.x - b.x),
    crown: crowns[0],
    enemies: ofKind('enemy'),
    mushrooms: ofKind('mushroom'),
    guardians,
    throwers: ofKind('thrower'),
    boss: ofKind('shiftingKing')[0] ?? null,
    bossDoors: ofKind('bossDoor'),
    flipIntervalMs: property(map, 'flipIntervalSec') !== undefined ? number('flipIntervalSec', 0) * 1000 || null : null,
    seedPods: objectsOf('seedPod').map((o) => {
      const h = o.properties?.find((p) => p.name === 'height')?.value;
      return { x: o.x, y: o.y, height: typeof h === 'number' && h > 0 ? h : DEFAULT_POD_HEIGHT };
    }),
    fireWalls: ofKind('fireWall'),
    flipOrder: parseFlipOrder(map),
  };
}

function property(map: TiledMap, name: string): unknown {
  return map.properties?.find((p) => p.name === name)?.value;
}

function parseFlipOrder(map: TiledMap): FlipState[] {
  const value = property(map, FLIP_ORDER_PROPERTY);
  if (typeof value !== 'string') {
    throw new LevelDataError(`Level needs a "${FLIP_ORDER_PROPERTY}" map property, e.g. "lowGravity,colorSwap"`);
  }
  const names = value.split(',').map((s) => s.trim()).filter(Boolean);
  const bad = names.filter((n) => !isFlipState(n));
  if (names.length === 0 || bad.length > 0) {
    throw new LevelDataError(
      `Bad "${FLIP_ORDER_PROPERTY}": ${bad.join(', ') || '(empty)'}. Use: ${FLIP_STATES.join(', ')}`,
    );
  }
  return names as FlipState[];
}
