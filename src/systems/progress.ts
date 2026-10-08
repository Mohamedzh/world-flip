// Star ratings and the saved game. Plain TypeScript so the rules can be unit tested.
import type { HeroKind } from '../hero/Hero';
import { isElement, type Element } from './powers';

/** Spec: 1 star for the crown, 2 under par time, 3 under par with no hearts lost. */
export function starsFor(timeMs: number, parMs: number, heartsLost: boolean): 1 | 2 | 3 {
  if (timeMs >= parMs) return 1;
  return heartsLost ? 2 : 3;
}

export interface LevelRecord {
  bestStars: number;
  bestTimeMs: number;
}

/** What is kept in the browser between visits (spec): unlocked levels, powers, best stars, chosen hero. */
export interface SaveData {
  version: 1;
  hero: HeroKind;
  powers: Element[];
  /** Level ids the player may start. */
  unlocked: string[];
  levels: Record<string, LevelRecord>;
}

export function newSave(firstLevel: string): SaveData {
  return { version: 1, hero: 'knight', powers: [], unlocked: [firstLevel], levels: {} };
}

/** Reads saved JSON defensively: anything missing or broken falls back to a fresh save. */
export function parseSave(json: string | null, firstLevel: string): SaveData {
  const fresh = newSave(firstLevel);
  if (!json) return fresh;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fresh;
  }
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return fresh;
  const r = raw as Partial<Record<keyof SaveData, unknown>>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const levels: Record<string, LevelRecord> = {};
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, rec] of Object.entries(r.levels as Record<string, unknown>)) {
      const { bestStars, bestTimeMs } = (rec ?? {}) as Partial<LevelRecord>;
      if (typeof bestStars === 'number' && typeof bestTimeMs === 'number') levels[id] = { bestStars, bestTimeMs };
    }
  }
  const unlocked = strings(r.unlocked);
  return {
    version: 1,
    hero: r.hero === 'ranger' ? 'ranger' : 'knight',
    powers: strings(r.powers).filter(isElement),
    unlocked: unlocked.includes(firstLevel) ? unlocked : [firstLevel, ...unlocked],
    levels,
  };
}

/** Records a finished level: keeps the best stars and best time, and unlocks the next level. */
export function recordLevel(
  save: SaveData,
  levelId: string,
  stars: number,
  timeMs: number,
  nextLevel: string | null,
): SaveData {
  const prev = save.levels[levelId];
  const levels = {
    ...save.levels,
    [levelId]: {
      bestStars: Math.max(prev?.bestStars ?? 0, stars),
      bestTimeMs: Math.min(prev?.bestTimeMs ?? Infinity, timeMs),
    },
  };
  const unlocked = nextLevel && !save.unlocked.includes(nextLevel) ? [...save.unlocked, nextLevel] : save.unlocked;
  return { ...save, levels, unlocked };
}

export function withPower(save: SaveData, e: Element): SaveData {
  return save.powers.includes(e) ? save : { ...save, powers: [...save.powers, e] };
}

/** The bit of Web Storage the save needs, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Loads and stores the save. Storage can be missing or throw (private windows, blocked storage); the game then just doesn't remember. */
export class SaveStore {
  private data: SaveData;

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly key: string,
    firstLevel: string,
  ) {
    let json: string | null = null;
    try {
      json = store?.getItem(key) ?? null;
    } catch {
      json = null;
    }
    this.data = parseSave(json, firstLevel);
  }

  get current(): SaveData {
    return this.data;
  }

  update(change: (save: SaveData) => SaveData): void {
    this.data = change(this.data);
    try {
      this.store?.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep playing with the in-memory save.
    }
  }
}
