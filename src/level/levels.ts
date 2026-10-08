// The levels in play order. Finishing one unlocks the next (spec).

export interface LevelEntry {
  id: string;
  /** File under public/assets/levels/. */
  file: string;
}

export const LEVELS: LevelEntry[] = [{ id: 'level-1', file: 'level-1.tmj' }];

/** Development-only level with every flip and creature close together: open the game with ?level=test-level */
export const TEST_LEVEL: LevelEntry = { id: 'test-level', file: 'test-level.tmj' };

export const FIRST_LEVEL = LEVELS[0].id;

export function findLevel(id: string): LevelEntry | undefined {
  return [...LEVELS, TEST_LEVEL].find((l) => l.id === id);
}

export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}
