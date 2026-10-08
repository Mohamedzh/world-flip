// Projectiles from the Water and Snow powers and from throwers.
import Phaser from 'phaser';
import { SNOW, THROWER, TILE, WATER } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { GravityDir } from '../systems/flips';

/**
 * Water: a wave that rolls straight ahead along the floor (over water and gaps too), pushing
 * enemies back about 3 tiles, growing seed pods and putting out fire walls (spec).
 */
export class WaterWave extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  /** Creatures already pushed, so each is pushed once per wave. */
  readonly hitTargets = new Set<Phaser.GameObjects.GameObject>();
  private readonly bornAt: number;

  /** `floorRow` is the tile row the hero stood on: across a gap, the wave leaves water there. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    feetY: number,
    readonly dir: 1 | -1,
    readonly floorRow: number,
    gravityDir: GravityDir,
  ) {
    super(scene, x, feetY, TEXTURES.wave);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, gravityDir > 0 ? 1 : 0).setFlipX(dir < 0).setFlipY(gravityDir < 0).setDepth(4).setAlpha(0.9);
    this.bornAt = scene.time.now;
    this.body.setAllowGravity(false);
    this.body.setVelocityX(dir * WATER.speed);
  }

  /** The tile column under the wave's front edge. */
  get frontCol(): number {
    return Math.floor((this.x + this.dir * 6) / TILE);
  }

  update(time: number): void {
    const age = time - this.bornAt;
    this.setAlpha(0.9 * (1 - age / WATER.lifetimeMs) + 0.1);
    if (age > WATER.lifetimeMs) this.destroy();
  }
}

/** Snow: a snowball that flies straight, then drops. It freezes enemies and water (spec). */
export class Snowball extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  private readonly bornAt: number;
  private readonly startX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1) {
    super(scene, x, y, TEXTURES.snowball);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    this.bornAt = scene.time.now;
    this.startX = x;
    this.body.setSize(6, 6);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(dir * SNOW.speed);
  }

  update(time: number): void {
    this.rotation += 0.2;
    if (!this.body.allowGravity && Math.abs(this.x - this.startX) >= SNOW.straightRange) this.body.setAllowGravity(true);
    if (time - this.bornAt > SNOW.lifetimeMs) this.destroy();
  }

  /** Breaks apart in a puff of white. */
  burst(): void {
    if (!this.active) return;
    puff(this.scene, this.x, this.y, 0xe1f5fe);
    this.destroy();
  }
}

/**
 * A thrower's pellet: slow and straight. The Knight's swing knocks it back (spec: the swing
 * deflects enemy projectiles), and then it hurts enemies instead of the hero.
 */
export class Pellet extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  private deflectedValue = false;
  private readonly bornAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1) {
    super(scene, x, y, TEXTURES.pellet);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    this.bornAt = scene.time.now;
    this.body.setSize(6, 6);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(dir * THROWER.pelletSpeed);
  }

  get deflected(): boolean {
    return this.deflectedValue;
  }

  deflect(): void {
    if (this.deflectedValue) return;
    this.deflectedValue = true;
    this.body.setVelocityX(-this.body.velocity.x * THROWER.deflectSpeedFactor);
    this.setTint(0xfff176);
  }

  update(time: number): void {
    this.rotation += 0.15;
    if (time - this.bornAt > THROWER.pelletLifetimeMs) this.destroy();
  }

  burst(): void {
    if (!this.active) return;
    puff(this.scene, this.x, this.y, 0xce93d8);
    this.destroy();
  }
}

/** A small puff of particles in one color. */
export function puff(scene: Phaser.Scene, x: number, y: number, color: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const p = scene.add.image(x, y, TEXTURES.pixel).setScale(2).setTint(color).setDepth(6);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * 10,
      y: y + Math.sin(angle) * 10,
      alpha: 0,
      duration: 280,
      onComplete: () => p.destroy(),
    });
  }
}
