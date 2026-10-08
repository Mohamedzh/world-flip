// The two heroes. They share movement, health and powers; only the weapon differs (spec).
import type Phaser from 'phaser';
import { LOOKS, type Look } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { PowerSystem } from '../systems/powers';
import { Bow } from '../weapons/Bow';
import { Sword } from '../weapons/Sword';
import type { CombatWorld, Weapon } from '../weapons/Weapon';
import { Hero, type HeroKind } from './Hero';

export class Knight extends Hero {
  readonly kind = 'knight';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld, powers: PowerSystem) {
    super(scene, at, LOOKS.knight, world, powers);
    this.weapon = new Sword(this, world);
  }
}

export class Ranger extends Hero {
  readonly kind = 'ranger';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld, powers: PowerSystem) {
    super(scene, at, LOOKS.ranger, world, powers);
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
export const HERO_INFO: Record<HeroKind, { name: string; look: Look; lines: string[] }> = {
  knight: {
    name: 'Knight',
    look: LOOKS.knight,
    lines: ['Sword', 'Close and brave', 'Strong hits up close'],
  },
  ranger: {
    name: 'Ranger',
    look: LOOKS.ranger,
    lines: ['Bow and arrows', 'Safe from far away', 'Hold J to charge'],
  },
};

/** How the active power works with each hero's weapon, shown when a power is earned. */
export const POWER_HINT: Record<HeroKind, string> = {
  knight: 'Tap K: fireball\nHold K + press J: flaming swing',
  ranger: 'Tap K: fireball\nHold K + press J: fire arrow',
};
