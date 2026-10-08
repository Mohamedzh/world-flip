import { describe, expect, it } from 'vitest';
import { findFreeSpot, overlapsSolid, type SolidAt } from '../src/systems/pushOut';

const T = 18;

/** Builds a solid-tile lookup from rows of '#' (solid) and '.' (free). Outside the grid is solid. */
function grid(rows: string[]): SolidAt {
  return (c, r) => r < 0 || r >= rows.length || c < 0 || c >= rows[0].length || rows[r][c] === '#';
}

describe('overlapsSolid', () => {
  const solid = grid(['...', '.#.', '...']);

  it('detects a box inside a solid tile', () => {
    expect(overlapsSolid({ x: 20, y: 20, width: 12, height: 16 }, T, solid)).toBe(true);
  });

  it('does not count a box that only touches a tile edge', () => {
    expect(overlapsSolid({ x: 6, y: 18, width: 12, height: 16 }, T, solid)).toBe(false);
  });
});

describe('findFreeSpot', () => {
  it('pushes the hero out of a block that turned solid, to the nearest free tile', () => {
    // A solid row with the hero inside tile (2,1): nearest free spot is straight up, standing on it.
    const solid = grid(['.....', '#####', '#####']);
    const hero = { x: 2 * T + 3, y: 1 * T + 1, width: 12, height: 16 };
    const spot = findFreeSpot(hero, T, solid)!;
    expect(spot).toEqual({ x: 2 * T + 3, y: 1 * T - 16 });
    expect(overlapsSolid({ ...hero, ...spot }, T, solid)).toBe(false);
  });

  it('prefers a free tile beside the hero over one further away', () => {
    const solid = grid(['###', '#..', '###']);
    const hero = { x: 0 + 3, y: 1 * T + 1, width: 12, height: 16 };
    expect(findFreeSpot(hero, T, solid)).toEqual({ x: T + 3, y: 2 * T - 16 });
  });

  it('pops up when up is nearest', () => {
    const solid = grid(['...', '.#.', '...']);
    const hero = { x: T + 3, y: T + 1, width: 12, height: 16 };
    expect(findFreeSpot(hero, T, solid)).toEqual({ x: T + 3, y: T - 16 });
  });

  it('prefers solid footing over a slightly nearer spot above a pit', () => {
    // The hero is inside a bridge that just turned solid; the floor under the bridge is gone.
    const solid = (c: number, r: number) => r === 1 || c < 0 || c > 4;
    const hero = { x: 2 * T + 3, y: 1 * T + 2.2, width: 12, height: 16 }; // a bit low, so "down" is nearer
    expect(findFreeSpot(hero, T, solid)).toEqual({ x: 2 * T + 3, y: T - 16 });
  });

  it('uses the nearest mid-air spot when there is no ground nearby', () => {
    // Inside a tall pillar that just turned solid, high above the ground: step out sideways.
    const solid = (c: number) => c === 3;
    const hero = { x: 3 * T + 3, y: 5 * T + 1, width: 12, height: 16 };
    expect(findFreeSpot(hero, T, solid)).toEqual({ x: 2 * T + 3, y: 6 * T - 16 });
  });

  it('upside-down: pushes the hero out to hang under the ceiling, mirroring normal gravity', () => {
    // A thick ceiling (rows 0-2); the hero is inside its lowest row when it turns solid.
    const solid = (_c: number, r: number) => r <= 2;
    const hero = { x: 2 * T + 3, y: 2 * T + 1, width: 12, height: 16 };
    expect(findFreeSpot(hero, T, solid, 4, -1)).toEqual({ x: 2 * T + 3, y: 3 * T });
  });

  it('returns null when nothing is free in range', () => {
    const solid: SolidAt = () => true;
    expect(findFreeSpot({ x: 0, y: 0, width: 12, height: 16 }, T, solid, 2)).toBeNull();
  });
});
