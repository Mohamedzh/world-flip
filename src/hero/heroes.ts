// The two heroes. They share movement, health and powers; only the weapon differs (spec).
import type Phaser from 'phaser';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';
import { Bow } from '../weapons/Bow';
import { Sword } from '../weapons/Sword';
import type { CombatWorld, Weapon } from '../weapons/Weapon';
import { Hero, type HeroKind } from './Hero';

export class Knight extends Hero {
  readonly kind = 'knight';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld) {
    super(scene, at, TEXTURES.knight, world);
    this.weapon = new Sword(this, world);
  }
}

export class Ranger extends Hero {
  readonly kind = 'ranger';
  protected readonly weapon: Weapon;

  constructor(scene: Phaser.Scene, at: Point, world: CombatWorld) {
    super(scene, at, TEXTURES.ranger, world);
    this.weapon = new Bow(this, world);
  }
}

export function createHero(kind: HeroKind, scene: Phaser.Scene, at: Point, world: CombatWorld): Hero {
  return kind === 'knight' ? new Knight(scene, at, world) : new Ranger(scene, at, world);
}

/** Shown on the hero select screen. */
export const HERO_INFO: Record<HeroKind, { name: string; texture: string; lines: string[] }> = {
  knight: {
    name: 'Knight',
    texture: TEXTURES.knight,
    lines: ['Sword', 'Close and brave', 'Strong hits up close'],
  },
  ranger: {
    name: 'Ranger',
    texture: TEXTURES.ranger,
    lines: ['Bow and arrows', 'Safe from far away', 'Hold J to charge'],
  },
};
