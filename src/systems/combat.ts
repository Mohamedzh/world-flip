// Who can hurt whom, and what weapons do to creatures. Plain TypeScript so the rules can be unit tested.

export type CreatureKind = 'enemy' | 'friend';

export type HitEffect =
  | { kind: 'damage'; amount: number }
  | { kind: 'shatter'; amount: number }
  | { kind: 'stun' }
  | { kind: 'none' };

export interface HitContext {
  friendsHostile: boolean;
  /** The target enemy is frozen in a block of ice (Snow). */
  frozen?: boolean;
  /** The hit carries Fire (fireball, flaming swing, fire arrow). */
  fire?: boolean;
}

/**
 * What a weapon hit does. Enemies always take damage; Fire on a frozen enemy shatters the ice for
 * double damage (spec combo: Snow then Fire). Weapons never hurt friends (spec):
 * a friendly creature is unaffected, a hostile one (friend/foe swap) is only stunned.
 */
export function weaponHitEffect(target: CreatureKind, damage: number, ctx: HitContext): HitEffect {
  if (target === 'enemy') {
    if (ctx.frozen && ctx.fire) return { kind: 'shatter', amount: damage * 2 };
    return { kind: 'damage', amount: damage };
  }
  return ctx.friendsHostile ? { kind: 'stun' } : { kind: 'none' };
}

/** What happens when the hero touches a creature. */
/** stomp: landed on a normal enemy's head, Mario-style: the hero bounces and the enemy takes 1 damage. */
export type TouchEffect = 'hurtHero' | 'bounce' | 'stomp' | 'spring' | 'none';

export interface TouchContext {
  friendsHostile: boolean;
  /** The hero is falling onto the creature from above. */
  landingOnTop: boolean;
  /** The creature is stunned (hostile friends only). */
  stunned: boolean;
  /** The enemy is frozen into an ice block: harmless, and solid to stand on. */
  frozen?: boolean;
  /** The boss is dizzy (shield broken): harmless, and can be stomped. */
  dizzy?: boolean;
}

export function touchEffect(target: CreatureKind, ctx: TouchContext): TouchEffect {
  if (target === 'enemy') {
    if (ctx.frozen) return 'none';
    if (ctx.dizzy) return ctx.landingOnTop ? 'stomp' : 'none';
    // During the friend/foe swap, enemies are harmless and can be bounced on.
    if (ctx.friendsHostile) return ctx.landingOnTop ? 'bounce' : 'none';
    // Kids expect to jump on enemies (play-testing): from above it's a stomp, from the side it hurts.
    return ctx.landingOnTop ? 'stomp' : 'hurtHero';
  }
  if (ctx.friendsHostile) return ctx.stunned ? 'none' : 'hurtHero';
  // A friendly bounce mushroom launches the hero when landed on.
  return ctx.landingOnTop ? 'spring' : 'none';
}
