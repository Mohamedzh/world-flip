import { describe, expect, it } from 'vitest';
import { newSave, parseSave, recordLevel, SaveStore, starsFor, withPower, type KeyValueStore } from '../src/systems/progress';

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
