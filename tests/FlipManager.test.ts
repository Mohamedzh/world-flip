import { describe, expect, it } from 'vitest';
import { FlipManager, type FlipChange, type FlipWarning } from '../src/systems/FlipManager';
import { rulesFor, isFlipState } from '../src/systems/flips';

const timing = { intervalMs: 50_000, warningMs: 3_000 };

function setup(order = ['lowGravity', 'colorSwap', 'friendFoe'] as const) {
  const fm = new FlipManager(order, timing);
  const warnings: FlipWarning[] = [];
  const changes: FlipChange[] = [];
  fm.onWarning((w) => warnings.push(w));
  fm.onChanged((c) => changes.push(c));
  return { fm, warnings, changes };
}

/** Advances in 100 ms steps, like game frames. */
function advance(fm: FlipManager, ms: number) {
  for (let t = 0; t < ms; t += 100) fm.update(100);
}

describe('FlipManager', () => {
  it('starts in the Normal state', () => {
    const { fm } = setup();
    expect(fm.state).toBe('normal');
    expect(fm.next).toBe('lowGravity');
    expect(fm.msUntilFlip).toBe(50_000);
  });

  it('warns at 47 s with the next flip, then flips at 50 s', () => {
    const { fm, warnings, changes } = setup();
    advance(fm, 46_900);
    expect(warnings).toEqual([]);
    advance(fm, 100);
    expect(warnings).toEqual([{ next: 'lowGravity' }]);
    expect(fm.warningActive).toBe(true);
    advance(fm, 2_900);
    expect(changes).toEqual([]);
    advance(fm, 100);
    expect(changes).toEqual([{ from: 'normal', to: 'lowGravity' }]);
    expect(fm.state).toBe('lowGravity');
    expect(fm.warningActive).toBe(false);
  });

  it('follows the fixed order and loops', () => {
    const { fm, changes } = setup();
    advance(fm, 50_000 * 4);
    expect(changes.map((c) => c.to)).toEqual(['lowGravity', 'colorSwap', 'friendFoe', 'lowGravity']);
    expect(changes[1].from).toBe('lowGravity');
  });

  it('warns exactly once per flip', () => {
    const { fm, warnings } = setup();
    advance(fm, 50_000 * 3);
    expect(warnings.map((w) => w.next)).toEqual(['lowGravity', 'colorSwap', 'friendFoe']);
  });

  it('a hold delays a due flip until the hold ends, then fires it', () => {
    const { fm, changes } = setup();
    advance(fm, 49_000);
    fm.holdFor(2_000);
    advance(fm, 1_900);
    expect(changes).toEqual([]);
    advance(fm, 100);
    expect(changes.length).toBe(1);
  });

  it('a hold that ends before the flip is due changes nothing', () => {
    const { fm, changes } = setup();
    fm.holdFor(2_000);
    advance(fm, 50_000);
    expect(changes.length).toBe(1);
  });

  it('time that is not passed to update (pause, dying) never advances the flip', () => {
    const { fm } = setup();
    advance(fm, 10_000);
    expect(fm.msUntilFlip).toBe(40_000);
  });

  it('forceFlip flips now and restarts the timer', () => {
    const { fm, changes } = setup();
    advance(fm, 20_000);
    fm.forceFlip();
    expect(changes).toEqual([{ from: 'normal', to: 'lowGravity' }]);
    expect(fm.msUntilFlip).toBe(50_000);
  });

  it('rejects an empty order', () => {
    expect(() => new FlipManager([], timing)).toThrow();
  });
});

describe('rulesFor', () => {
  it('only the active flip changes the rules', () => {
    expect(rulesFor('normal', 0.3)).toEqual({ gravityScale: 1, gravityDir: 1, colorsSwapped: false, friendsHostile: false });
    expect(rulesFor('lowGravity', 0.3)).toEqual({ gravityScale: 0.3, gravityDir: 1, colorsSwapped: false, friendsHostile: false });
    expect(rulesFor('colorSwap', 0.3)).toEqual({ gravityScale: 1, gravityDir: 1, colorsSwapped: true, friendsHostile: false });
    expect(rulesFor('friendFoe', 0.3)).toEqual({ gravityScale: 1, gravityDir: 1, colorsSwapped: false, friendsHostile: true });
  });

  it('recognizes flip state names', () => {
    expect(isFlipState('colorSwap')).toBe(true);
    expect(isFlipState('upsideDown')).toBe(true);
    expect(isFlipState('sideways')).toBe(false);
  });
});

describe('FlipManager random order (level 4)', () => {
  /** A repeatable sequence of "random" numbers. */
  function seq(...values: number[]) {
    let i = 0;
    return () => values[i++ % values.length];
  }

  it('picks each flip from the list and never repeats the current state', () => {
    const order = ['lowGravity', 'colorSwap', 'friendFoe', 'upsideDown'] as const;
    const fm = new FlipManager(order, timing, 'random', seq(0, 0, 0.99, 0.5, 0, 0.3));
    let prev = fm.state;
    for (let i = 0; i < 6; i++) {
      fm.forceFlip();
      expect(fm.state).not.toBe(prev);
      expect(order).toContain(fm.state);
      prev = fm.state;
    }
  });

  it('the warning shows the flip that actually comes next', () => {
    const fm = new FlipManager(['lowGravity', 'colorSwap', 'upsideDown'], timing, 'random', seq(0.7, 0.1, 0.9));
    let warned: string | null = null;
    fm.onWarning((w) => (warned = w.next));
    for (let i = 0; i < 4; i++) {
      advance(fm, 47_000);
      const announced = warned;
      advance(fm, 3_000);
      expect(fm.state).toBe(announced);
    }
  });
});

describe('upside-down rules', () => {
  it('reverses gravity and changes nothing else', () => {
    expect(rulesFor('upsideDown', 0.3)).toEqual({ gravityScale: 1, gravityDir: -1, colorsSwapped: false, friendsHostile: false });
  });
});
