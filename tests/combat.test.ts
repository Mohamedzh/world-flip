import { describe, expect, it } from 'vitest';
import { touchEffect, weaponHitEffect } from '../src/systems/combat';
import { ChargeTrigger, Cooldown } from '../src/systems/triggers';

describe('weaponHitEffect', () => {
  it('enemies take damage in every state', () => {
    expect(weaponHitEffect('enemy', 2, { friendsHostile: false })).toEqual({ kind: 'damage', amount: 2 });
    expect(weaponHitEffect('enemy', 1, { friendsHostile: true })).toEqual({ kind: 'damage', amount: 1 });
  });

  it('weapons never hurt friends: no effect when friendly, only a stun when hostile', () => {
    expect(weaponHitEffect('friend', 2, { friendsHostile: false })).toEqual({ kind: 'none' });
    expect(weaponHitEffect('friend', 2, { friendsHostile: true })).toEqual({ kind: 'stun' });
  });

  it('Snow then Fire: fire shatters a frozen enemy for double damage', () => {
    expect(weaponHitEffect('enemy', 3, { friendsHostile: false, frozen: true, fire: true })).toEqual({
      kind: 'shatter',
      amount: 6,
    });
    expect(weaponHitEffect('enemy', 2, { friendsHostile: false, frozen: true })).toEqual({ kind: 'damage', amount: 2 });
  });
});

describe('touchEffect', () => {
  it('a dizzy boss is harmless and can be stomped', () => {
    const ctx = { friendsHostile: false, stunned: false, dizzy: true };
    expect(touchEffect('enemy', { ...ctx, landingOnTop: false })).toBe('none');
    expect(touchEffect('enemy', { ...ctx, landingOnTop: true })).toBe('stomp');
  });

  const ctx = { friendsHostile: false, landingOnTop: false, stunned: false };

  it('enemies hurt on touch from the side, and are stomped from above', () => {
    expect(touchEffect('enemy', ctx)).toBe('hurtHero');
    expect(touchEffect('enemy', { ...ctx, landingOnTop: true })).toBe('stomp');
  });

  it('during the friend/foe swap, enemies are harmless and bounceable', () => {
    expect(touchEffect('enemy', { ...ctx, friendsHostile: true })).toBe('none');
    expect(touchEffect('enemy', { ...ctx, friendsHostile: true, landingOnTop: true })).toBe('bounce');
  });

  it('a friendly mushroom springs the hero when landed on', () => {
    expect(touchEffect('friend', { ...ctx, landingOnTop: true })).toBe('spring');
    expect(touchEffect('friend', ctx)).toBe('none');
  });

  it('a frozen enemy never hurts: it is a block to stand on', () => {
    expect(touchEffect('enemy', { ...ctx, frozen: true })).toBe('none');
  });

  it('a hostile friend hurts, unless stunned', () => {
    expect(touchEffect('friend', { ...ctx, friendsHostile: true })).toBe('hurtHero');
    expect(touchEffect('friend', { ...ctx, friendsHostile: true, stunned: true })).toBe('none');
  });
});

describe('Cooldown', () => {
  it('allows one use per cooldown', () => {
    const cd = new Cooldown(350);
    expect(cd.tryUse(0)).toBe(true);
    expect(cd.tryUse(349)).toBe(false);
    expect(cd.tryUse(350)).toBe(true);
  });
});

describe('ChargeTrigger', () => {
  it('a tap fires a normal shot on release', () => {
    const t = new ChargeTrigger(800, 500);
    expect(t.update(0, true)).toBe('none');
    expect(t.update(100, false)).toBe('normal');
  });

  it('holding 0.8 s fires a charged shot', () => {
    const t = new ChargeTrigger(800, 500);
    t.update(0, true);
    expect(t.progress(400)).toBeCloseTo(0.5);
    t.update(799, true);
    expect(t.update(800, false)).toBe('charged');
  });

  it('respects the cooldown between shots, then charges if still held', () => {
    const t = new ChargeTrigger(800, 500);
    t.update(0, true);
    expect(t.update(10, false)).toBe('normal');
    expect(t.update(100, true)).toBe('none');
    expect(t.update(200, false)).toBe('none'); // released during the cooldown: nothing fires
    t.update(300, true);
    t.update(510, true); // cooldown over: charging starts here
    expect(t.progress(910)).toBeCloseTo(0.5);
    expect(t.update(1310, false)).toBe('charged');
  });
});
