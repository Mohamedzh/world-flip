// The levels in play order. Finishing one unlocks the next (spec).

export interface LevelEntry {
  id: string;
  /** File under public/assets/levels/. */
  file: string;
  /** Shown on the world map. */
  world: number;
  name: string;
  /** The boss level: its door opens only with all four powers (spec). */
  needsAllPowers?: boolean;
}

export const LEVELS: LevelEntry[] = [
  { id: 'level-1', file: 'level-1.tmj', world: 1, name: 'Meadow' },
  { id: 'level-2', file: 'level-2.tmj', world: 2, name: 'Lake' },
  { id: 'level-3', file: 'level-3.tmj', world: 3, name: 'Mountain' },
  { id: 'level-4', file: 'level-4.tmj', world: 4, name: 'Sky' },
  { id: 'level-5', file: 'level-5.tmj', world: 5, name: 'Crown Castle', needsAllPowers: true },
];

/** Development-only level with every flip and creature close together: open the game with ?level=test-level */
export const TEST_LEVEL: LevelEntry = { id: 'test-level', file: 'test-level.tmj', world: 0, name: 'Test Level' };

export const FIRST_LEVEL = LEVELS[0].id;

export function findLevel(id: string): LevelEntry | undefined {
  return [...LEVELS, TEST_LEVEL].find((l) => l.id === id);
}

export const LEVEL_ORDER = LEVELS.map((l) => l.id);

export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}
