// Each hero has one unlimited weapon, so there is always a way to attack (spec).
// The active power can also charge the weapon: charge(element) does one powered attack.
import type Phaser from 'phaser';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import type { Element } from '../systems/powers';

/** What weapons and powers can do to the level. The Game scene implements it. */
export interface CombatWorld {
  /** Hits every creature overlapping `area` once. `fromX` is where the hit came from, for knockback. */
  strike(area: Phaser.Geom.Rectangle, damage: number, fromX: number): void;
  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean, element: Element | null): void;
  /** Casts a power (key K), e.g. throws a fireball. */
  castPower(element: Element, hero: Hero): void;
}

export interface Weapon {
  update(input: AttackInput, now: number): void;
  /** Whether a powered attack can happen right now (the weapon's own cooldown has passed). */
  ready(now: number): boolean;
  /** One attack charged with an element: Knight's flaming swing, Ranger's fire arrow, and so on. */
  charge(element: Element, now: number): void;
  /** Drops any half-finished attack, e.g. a charge held while the hero died. */
  reset(): void;
}
