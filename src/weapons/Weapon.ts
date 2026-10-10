// Each hero has one unlimited weapon, so there is always a way to attack (spec).
// The active power can also charge the weapon: charge(element) does one powered attack.
import type Phaser from 'phaser';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import type { Element } from '../systems/powers';

/** What one hit does to the creatures (and things) it touches. */
export interface Hit {
  damage: number;
  /** Where the hit came from, for knockback direction. */
  fromX: number;
  /** The element riding on the hit, if any: fire burns and shatters ice, water pushes and grows pods, snow slows. */
  element: Element | null;
  /** Snow that freezes (snowball, ice arrow) rather than slows (frost swing). */
  freezes?: boolean;
}

/** What weapons and powers can do to the level. The Game scene implements it. */
export interface CombatWorld {
  /** A melee hit on every creature overlapping `area` (and on pellets, pods and fire walls there). */
  strike(area: Phaser.Geom.Rectangle, hit: Hit): void;
  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean, element: Element | null): void;
  /** Casts a power (key K): fireball, water wave, snowball or gust. */
  castPower(element: Element, hero: Hero): void;
  /** At the boss: the powers that still break a piece of his shield (null anywhere else). */
  wantedElements(): readonly Element[] | null;
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
