import { describe, expect, it } from 'vitest';
import { approach, formatTime } from '../src/systems/math';

describe('approach', () => {
  it('steps toward the target without overshooting', () => {
    expect(approach(0, 100, 30)).toBe(30);
    expect(approach(90, 100, 30)).toBe(100);
    expect(approach(0, -100, 30)).toBe(-30);
    expect(approach(-90, -100, 30)).toBe(-100);
    expect(approach(50, 50, 30)).toBe(50);
  });
});

describe('formatTime', () => {
  it('formats as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9_999)).toBe('0:09');
    expect(formatTime(83_500)).toBe('1:23');
    expect(formatTime(300_000)).toBe('5:00');
  });
});
