import { describe, expect, it } from 'vitest';
import { HeroVitals } from '../src/systems/HeroVitals';

const cfg = { maxHearts: 5, lives: 3, invulnerableMs: 1500 };

describe('HeroVitals', () => {
  it('starts with full hearts and lives', () => {
    const v = new HeroVitals(cfg);
    expect(v.hearts).toBe(5);
    expect(v.lives).toBe(3);
  });

  it('a hit costs one heart and gives 1.5 s of invulnerability', () => {
    const v = new HeroVitals(cfg);
    expect(v.takeHit(1000)).toBe('hurt');
    expect(v.hearts).toBe(4);
    expect(v.takeHit(2000)).toBe('ignored');
    expect(v.hearts).toBe(4);
    expect(v.isInvulnerable(2499)).toBe(true);
    expect(v.takeHit(2500)).toBe('hurt');
    expect(v.hearts).toBe(3);
  });

  it('reports death when the last heart is lost', () => {
    const v = new HeroVitals({ ...cfg, maxHearts: 1 });
    expect(v.takeHit(0)).toBe('dead');
    expect(v.hearts).toBe(0);
    expect(v.takeHit(10_000)).toBe('ignored');
  });

  it('losing a life refills hearts and respawns while lives remain', () => {
    const v = new HeroVitals(cfg);
    v.takeHit(0);
    expect(v.loseLife()).toBe('respawn');
    expect(v.lives).toBe(2);
    expect(v.hearts).toBe(5);
  });

  it('losing the last life restarts the level with full lives', () => {
    const v = new HeroVitals(cfg);
    expect(v.loseLife()).toBe('respawn');
    expect(v.loseLife()).toBe('respawn');
    expect(v.loseLife()).toBe('restartLevel');
    expect(v.lives).toBe(3);
    expect(v.hearts).toBe(5);
  });

  it('respawn protection blocks hits', () => {
    const v = new HeroVitals(cfg);
    v.grantInvulnerability(0, 2000);
    expect(v.takeHit(1999)).toBe('ignored');
    expect(v.takeHit(2000)).toBe('hurt');
  });
});
