// Reads the parts of a Tiled map (.tmj) that the game needs, and checks the level is complete.
// Plain TypeScript so every level file can be validated by the unit tests.
import type { Point } from '../systems/CheckpointTracker';

/** One tile layer per block type (spec). */
export const TILE_LAYERS = {
  ground: 'ground',
  orange: 'orange',
  blue: 'blue',
} as const;

export const OBJECT_LAYER = 'objects';

/** Name of the tileset inside the .tmj files. */
export const TILESET_NAME = 'placeholder';

/** The minimal slice of the Tiled JSON format used here. */
export interface TiledObject {
  id: number;
  name: string;
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

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
}

export interface LevelObjects {
  spawn: Point;
  /** Sorted left to right. */
  checkpoints: Point[];
  crown: Point;
}

export class LevelDataError extends Error {}

export function parseLevelObjects(map: TiledMap): LevelObjects {
  for (const name of Object.values(TILE_LAYERS)) {
    if (!map.layers.some((l) => l.name === name && l.type === 'tilelayer')) {
      throw new LevelDataError(`Level is missing the tile layer "${name}"`);
    }
  }
  const layer = map.layers.find((l) => l.name === OBJECT_LAYER && l.type === 'objectgroup');
  if (!layer?.objects) throw new LevelDataError(`Level is missing the object layer "${OBJECT_LAYER}"`);

  const ofKind = (kind: string) =>
    layer.objects!.filter((o) => (o.type || o.class || o.name) === kind).map(({ x, y }) => ({ x, y }));

  const spawns = ofKind('spawn');
  const crowns = ofKind('crown');
  if (spawns.length !== 1) throw new LevelDataError(`Level needs exactly 1 spawn, found ${spawns.length}`);
  if (crowns.length !== 1) throw new LevelDataError(`Level needs exactly 1 crown, found ${crowns.length}`);

  return {
    spawn: spawns[0],
    checkpoints: ofKind('checkpoint').sort((a, b) => a.x - b.x),
    crown: crowns[0],
  };
}
