// Each hero has one unlimited weapon, so there is always a way to attack (spec).
// Weapon charging with elements (charge(element)) arrives with the powers in milestone 3.
import type Phaser from 'phaser';
import type { AttackInput } from '../input/Controls';

/** What weapons can do to the level. The Game scene implements it. */
export interface CombatWorld {
  /** Hits every creature overlapping `area` once. `fromX` is where the hit came from, for knockback. */
  strike(area: Phaser.Geom.Rectangle, damage: number, fromX: number): void;
  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean): void;
}

export interface Weapon {
  update(input: AttackInput, now: number): void;
  /** Drops any half-finished attack, e.g. a charge held while the hero died. */
  reset(): void;
}
