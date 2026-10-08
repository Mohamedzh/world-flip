import { describe, expect, it } from 'vitest';
import { isLevelUnlocked, newSave, parseSave, recordLevel, SaveStore, starsFor, withPower, type KeyValueStore } from '../src/systems/progress';

describe('starsFor', () => {
  const par = 180_000;
  it('1 star for reaching the crown', () => {
    expect(starsFor(200_000, par, false)).toBe(1);
    expect(starsFor(180_000, par, false)).toBe(1);
  });
  it('2 stars under par', () => {
    expect(starsFor(179_999, par, true)).toBe(2);
  });
  it('3 stars under par with no hearts lost', () => {
    expect(starsFor(100_000, par, false)).toBe(3);
  });
});

describe('parseSave', () => {
  it('falls back to a fresh save for missing, broken or foreign data', () => {
    const fresh = newSave('level-1');
    expect(parseSave(null, 'level-1')).toEqual(fresh);
    expect(parseSave('{not json', 'level-1')).toEqual(fresh);
    expect(parseSave('{"version":99}', 'level-1')).toEqual(fresh);
  });

  it('keeps valid fields and drops bad ones', () => {
    const json = JSON.stringify({
      version: 1,
      hero: 'ranger',
      powers: ['fire', 'lava', 3],
      unlocked: ['level-2'],
      levels: { 'level-1': { bestStars: 2, bestTimeMs: 150000 }, junk: { bestStars: 'x' } },
    });
    expect(parseSave(json, 'level-1')).toEqual({
      version: 1,
      hero: 'ranger',
      powers: ['fire'],
      unlocked: ['level-1', 'level-2'],
      levels: { 'level-1': { bestStars: 2, bestTimeMs: 150000 } },
    });
  });
});

describe('recordLevel', () => {
  it('keeps the best stars and best time separately, and unlocks the next level', () => {
    let s = newSave('level-1');
    s = recordLevel(s, 'level-1', 3, 170_000, 'level-2');
    s = recordLevel(s, 'level-1', 1, 150_000, 'level-2');
    expect(s.levels['level-1']).toEqual({ bestStars: 3, bestTimeMs: 150_000 });
    expect(s.unlocked).toEqual(['level-1', 'level-2']);
  });

  it('the last level unlocks nothing', () => {
    expect(recordLevel(newSave('a'), 'a', 1, 1, null).unlocked).toEqual(['a']);
  });
});

describe('SaveStore', () => {
  function memory(): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  }

  it('writes every change and reads it back next time', () => {
    const store = memory();
    new SaveStore(store, 'key', 'level-1').update((s) => withPower(s, 'fire'));
    expect(new SaveStore(store, 'key', 'level-1').current.powers).toEqual(['fire']);
  });

  it('keeps working when storage throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const s = new SaveStore(broken, 'key', 'level-1');
    s.update((d) => withPower(d, 'fire'));
    expect(s.current.powers).toEqual(['fire']);
  });

  it('works with no storage at all', () => {
    expect(new SaveStore(null, 'key', 'level-1').current.unlocked).toEqual(['level-1']);
  });
});

describe('isLevelUnlocked', () => {
  const order = ['level-1', 'level-2', 'level-5'];
  it('opens the first level, and each next one once the one before is finished', () => {
    let s = newSave('level-1');
    expect(isLevelUnlocked(s, order, 'level-1')).toBe(true);
    expect(isLevelUnlocked(s, order, 'level-2')).toBe(false);
    s = recordLevel(s, 'level-1', 1, 100, null);
    expect(isLevelUnlocked(s, order, 'level-2')).toBe(true);
  });

  it('a save from before a level existed still opens it (nothing stored about it)', () => {
    const s = { ...newSave('level-1'), levels: { 'level-1': { bestStars: 3, bestTimeMs: 1 }, 'level-2': { bestStars: 1, bestTimeMs: 1 } } };
    expect(isLevelUnlocked({ ...s, powers: ['fire', 'water', 'snow', 'wind'] }, order, 'level-5', true)).toBe(true);
  });

  it('the boss level also needs all four powers', () => {
    const s = { ...newSave('level-1'), levels: { 'level-2': { bestStars: 1, bestTimeMs: 1 } } };
    expect(isLevelUnlocked({ ...s, powers: ['fire', 'water', 'snow'] }, order, 'level-5', true)).toBe(false);
    expect(isLevelUnlocked({ ...s, powers: ['fire', 'water', 'snow', 'wind'] }, order, 'level-5', true)).toBe(true);
  });

  it('unknown levels are never open', () => {
    expect(isLevelUnlocked(newSave('level-1'), order, 'nope')).toBe(false);
  });
});
