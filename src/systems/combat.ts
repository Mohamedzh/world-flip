// Who can hurt whom, and what weapons do to creatures. Plain TypeScript so the rules can be unit tested.

export type CreatureKind = 'enemy' | 'friend';

export type HitEffect = { kind: 'damage'; amount: number } | { kind: 'stun' } | { kind: 'none' };

/**
 * What a weapon hit does. Enemies always take damage. Weapons never hurt friends (spec):
 * a friendly creature is unaffected, a hostile one (friend/foe swap) is only stunned.
 */
export function weaponHitEffect(target: CreatureKind, damage: number, friendsHostile: boolean): HitEffect {
  if (target === 'enemy') return { kind: 'damage', amount: damage };
  return friendsHostile ? { kind: 'stun' } : { kind: 'none' };
}

/** What happens when the hero touches a creature. */
export type TouchEffect = 'hurtHero' | 'bounce' | 'spring' | 'none';

export interface TouchContext {
  friendsHostile: boolean;
  /** The hero is falling onto the creature from above. */
  landingOnTop: boolean;
  /** The creature is stunned (hostile friends only). */
  stunned: boolean;
}

export function touchEffect(target: CreatureKind, ctx: TouchContext): TouchEffect {
  if (target === 'enemy') {
    // During the friend/foe swap, enemies are harmless and can be bounced on.
    if (ctx.friendsHostile) return ctx.landingOnTop ? 'bounce' : 'none';
    return 'hurtHero';
  }
  if (ctx.friendsHostile) return ctx.stunned ? 'none' : 'hurtHero';
  // A friendly bounce mushroom launches the hero when landed on.
  return ctx.landingOnTop ? 'spring' : 'none';
}
