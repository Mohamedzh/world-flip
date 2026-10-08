import { describe, expect, it } from 'vitest';
import { CheckpointTracker } from '../src/systems/CheckpointTracker';

const spawn = { x: 10, y: 100 };
const cps = [
  { x: 300, y: 100 },
  { x: 600, y: 80 },
];

describe('CheckpointTracker', () => {
  it('respawns at the spawn point before any checkpoint', () => {
    expect(new CheckpointTracker(spawn, cps).respawnPoint).toEqual(spawn);
  });

  it('moves the respawn point forward when a checkpoint is touched', () => {
    const t = new CheckpointTracker(spawn, cps);
    expect(t.activate(0)).toBe(true);
    expect(t.respawnPoint).toEqual(cps[0]);
    expect(t.activate(1)).toBe(true);
    expect(t.respawnPoint).toEqual(cps[1]);
  });

  it('never moves the respawn point backwards', () => {
    const t = new CheckpointTracker(spawn, cps);
    t.activate(1);
    expect(t.activate(0)).toBe(false);
    expect(t.activate(1)).toBe(false);
    expect(t.respawnPoint).toEqual(cps[1]);
  });

  it('ignores out-of-range indexes and resets to spawn', () => {
    const t = new CheckpointTracker(spawn, cps);
    expect(t.activate(5)).toBe(false);
    t.activate(0);
    t.reset();
    expect(t.respawnPoint).toEqual(spawn);
    expect(t.activeIndex).toBe(-1);
  });
});
