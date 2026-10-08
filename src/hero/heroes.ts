// The two heroes. They share movement, health and powers; only the weapon differs (spec).
import type Phaser from 'phaser';
import { HERO_LOOKS, type HeroLook } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { Element, PowerSystem } from '../systems/powers';
import { Bow } from '../weapons/Bow';
import { Sword } from '../weapons/Sword';
import type { CombatWorld, Weapon } from '../weapons/Weapon';
import { Hero, type HeroKind } from './Hero';

export class Knight extends Hero {
  readonly kind = 'knight';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld, powers: PowerSystem) {
    super(scene, at, HERO_LOOKS.knight, world, powers);
    this.weapon = new Sword(this, world);
  }
}

export class Ranger extends Hero {
  readonly kind = 'ranger';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld, powers: PowerSystem) {
    super(scene, at, HERO_LOOKS.ranger, world, powers);
    this.weapon = new Bow(this, world);
  }
}

export function createHero(
  kind: HeroKind,
  scene: Phaser.Scene,
  at: Point,
  world: CombatWorld,
  powers: PowerSystem,
): Hero {
  return kind === 'knight' ? new Knight(scene, at, world, powers) : new Ranger(scene, at, world, powers);
}

/** Shown on the hero select screen. */
export const HERO_INFO: Record<HeroKind, { name: string; look: HeroLook; lines: string[] }> = {
  knight: {
    name: 'Knight',
    look: HERO_LOOKS.knight,
    lines: ['Sword', 'Close and brave', 'Strong hits up close'],
  },
  ranger: {
    name: 'Ranger',
    look: HERO_LOOKS.ranger,
    lines: ['Bow and arrows', 'Safe from far away', 'Hold J to charge'],
  },
};

/** How each power works, and with each hero's weapon, shown when the power is earned. */
export const POWER_HINT: Record<Element, Record<HeroKind, string>> = {
  fire: {
    knight: 'Tap K: fireball\nHold K + press J: flaming swing',
    ranger: 'Tap K: fireball\nHold K + press J: fire arrow',
  },
  water: {
    knight: 'Tap K: water wave\n(pushes, grows seed pods, puts out fire)\nHold K + press J: wave slash',
    ranger: 'Tap K: water wave\n(pushes, grows seed pods, puts out fire)\nHold K + press J: water arrow',
  },
  snow: {
    knight: 'Tap K: snowball\n(freezes enemies and water)\nHold K + press J: frost swing',
    ranger: 'Tap K: snowball\n(freezes enemies and water)\nHold K + press J: ice arrow',
  },
  wind: {
    knight: 'Tap K: gust\nJump in the air: double jump, hold to glide\nHold K + press J: spin attack',
    ranger: 'Tap K: gust\nJump in the air: double jump, hold to glide\nHold K + press J: wind arrow',
  },
};
