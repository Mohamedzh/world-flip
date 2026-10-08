// The hero's movement, health effects and weapon slot, shared by both heroes. Only the weapon differs.
import Phaser from 'phaser';
import { HERO, PHYSICS } from '../config';
import type { PlayerInput } from '../input/Controls';
import type { Point } from '../systems/CheckpointTracker';
import { approach } from '../systems/math';
import type { CombatWorld, Weapon } from '../weapons/Weapon';

export type HeroKind = 'knight' | 'ranger';

export abstract class Hero extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  abstract readonly kind: HeroKind;
  protected abstract readonly weapon: Weapon;

  /** Time left in which a jump still counts after leaving the ground. */
  private coyoteMs = 0;
  /** Time left in which an early jump press will still fire on landing. */
  private jumpBufferMs = 0;
  /** True from takeoff until the jump peaks, so releasing the key can cut the jump short. */
  private rising = false;
  /** Steering is ignored while this runs, so a knockback isn't instantly cancelled. */
  private controlLockMs = 0;
  /** Only falling is capped; upward speed (jumps, springs) never is. */
  private maxFallSpeed: number = PHYSICS.maxFallSpeed;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    texture: string,
    protected readonly world: CombatWorld,
  ) {
    super(scene, at.x, at.y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Position is the hero's feet, matching where level objects mark the floor.
    this.setOrigin(0.5, 1);
    this.setDepth(2);
    this.body.setSize(HERO.width, HERO.height);
    this.setCollideWorldBounds(true);
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  /** 1 when facing right, -1 when facing left. */
  get facing(): 1 | -1 {
    return this.flipX ? -1 : 1;
  }

  update(input: PlayerInput, deltaMs: number, now: number): void {
    this.move(input, deltaMs);
    this.weapon.update(input, now);
  }

  private move(input: PlayerInput, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const grounded = this.onGround;

    this.coyoteMs = grounded ? HERO.coyoteMs : this.coyoteMs - deltaMs;
    this.jumpBufferMs = input.jumpPressed ? HERO.jumpBufferMs : this.jumpBufferMs - deltaMs;

    if (this.controlLockMs > 0) {
      this.controlLockMs -= deltaMs;
    } else {
      // Run: ease toward the target speed so movement feels weighty but responsive.
      const dir = Number(input.right) - Number(input.left);
      const accel =
        dir === 0 ? (grounded ? HERO.groundDecel : HERO.airAccel) : grounded ? HERO.groundAccel : HERO.airAccel;
      this.body.setVelocityX(approach(this.body.velocity.x, dir * HERO.runSpeed, accel * dt));
      if (dir !== 0) this.setFlipX(dir < 0);

      // Jump, using coyote time and the jump buffer so near-misses still count.
      if (this.jumpBufferMs > 0 && this.coyoteMs > 0) {
        this.body.setVelocityY(-HERO.jumpVelocity);
        this.jumpBufferMs = 0;
        this.coyoteMs = 0;
        this.rising = true;
      }
    }

    // Short hop: letting go of jump early cuts the rise.
    if (this.rising && !input.jumpHeld && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * HERO.jumpCutMultiplier);
      this.rising = false;
    }
    if (this.body.velocity.y >= 0) this.rising = false;
    if (this.body.velocity.y > this.maxFallSpeed) this.body.setVelocityY(this.maxFallSpeed);
  }

  setMaxFallSpeed(speed: number): void {
    this.maxFallSpeed = speed;
  }

  /** Launches the hero upward at full strength (mushroom spring, bouncing on an enemy). */
  bounce(velocity: number): void {
    this.body.setVelocityY(-velocity);
    this.rising = false;
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
  }

  /** Pushes the hero away from a hit. `dir` is the direction to be pushed in. */
  knockback(dir: number): void {
    this.body.setVelocity((dir || 1) * HERO.hurtKnockbackX, -HERO.hurtKnockbackY);
    this.controlLockMs = HERO.knockbackLockMs;
    this.rising = false;
  }

  /** Blinks while invulnerable. */
  showInvulnerable(invulnerable: boolean, now: number): void {
    const hidden = invulnerable && Math.floor(now / HERO.blinkIntervalMs) % 2 === 0;
    this.setAlpha(hidden ? 0.2 : 1);
  }

  /** Glows while a weapon charges; flashes when the charge is ready. */
  showCharge(progress: number, now: number): void {
    if (progress <= 0) this.clearTint();
    else if (progress < 1) this.setTint(0xfffde7);
    else this.setTint(Math.floor(now / 80) % 2 ? 0xfff176 : 0xffffff);
  }

  freeze(): void {
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.weapon.reset();
  }

  respawnAt(at: Point): void {
    this.body.enable = true;
    this.body.reset(at.x, at.y);
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
    this.rising = false;
    this.controlLockMs = 0;
    this.weapon.reset();
    this.clearTint();
    this.setFlipX(false);
  }
}
