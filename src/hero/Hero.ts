// The hero's movement, powers and weapon slot, shared by both heroes. Only the weapon differs.
// Movement works with gravity pulling down or up (the upside-down flip).
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { onFloor, orientToGravity } from '../actors/gravity';
import { HERO, PHYSICS, WIND } from '../config';
import { HERO_ATTACK_FPS, type HeroLook } from '../gfx/sprites';
import type { PlayerInput } from '../input/Controls';
import type { Point } from '../systems/CheckpointTracker';
import type { GravityDir } from '../systems/flips';
import { approach } from '../systems/math';
import { PowerTrigger, type PowerSystem } from '../systems/powers';
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
  /** Wind: glide time left after a double jump (spec: 2 s). */
  private glideMs = 0;
  private gravityDir: GravityDir = 1;
  private readonly powerTrigger = new PowerTrigger();
  /** Where the body sits in the frame in normal gravity: centered, feet on the frame bottom. */
  private readonly bodyOffsetY: number;
  /** The attack animation plays until this time; other animation waits for it. */
  private attackUntil = 0;
  /** The Ranger holds the drawn-bow pose while charging a shot. */
  private drawingBow = false;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    private readonly look: HeroLook,
    protected readonly world: CombatWorld,
    readonly powers: PowerSystem,
  ) {
    super(scene, at.x, at.y, look.sheet, look.idle);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Position is the hero's feet, matching where level objects mark the floor.
    this.setOrigin(0.5, 1);
    this.setDepth(2);
    // The body sits at the bottom middle of the frame (the art is drawn centered on the body).
    this.bodyOffsetY = this.frame.realHeight - HERO.height;
    this.body.setSize(HERO.width, HERO.height, false).setOffset((this.frame.realWidth - HERO.width) / 2, this.bodyOffsetY);
    this.setCollideWorldBounds(true);
  }

  get onGround(): boolean {
    return onFloor(this.body, this.gravityDir);
  }

  /** 1 when facing right, -1 when facing left. */
  get facing(): 1 | -1 {
    return this.flipX ? -1 : 1;
  }

  /** Velocity toward the floor: positive while falling, whichever way gravity points. */
  private get fallSpeed(): number {
    return this.body.velocity.y * this.gravityDir;
  }

  private setFallSpeed(v: number): void {
    this.body.setVelocityY(v * this.gravityDir);
  }

  setGravityDir(dir: GravityDir): void {
    this.gravityDir = dir;
    orientToGravity(this, dir, this.bodyOffsetY);
  }

  update(input: PlayerInput, deltaMs: number, now: number): void {
    this.move(input, deltaMs, now);
    this.animate(now);

    // Tap K to cast; hold K and press J to charge the weapon instead (both use the power's cooldown).
    let attack = input;
    const action = this.powerTrigger.update(input.powerHeld, input.attackPressed);
    const active = this.powers.active;
    if (action === 'chargeWeapon' && active && this.powers.ready(active, now) && this.weapon.ready(now)) {
      this.powers.useActive(now);
      this.weapon.charge(active, now);
      attack = { ...input, attackPressed: false };
    } else if (action === 'cast') {
      const element = this.powers.useActive(now);
      if (element) this.world.castPower(element, this);
    }
    this.weapon.update(attack, now);
  }

  private move(input: PlayerInput, deltaMs: number, now: number): void {
    const dt = deltaMs / 1000;
    const grounded = this.onGround;

    this.coyoteMs = grounded ? HERO.coyoteMs : this.coyoteMs - deltaMs;
    this.jumpBufferMs = input.jumpPressed ? HERO.jumpBufferMs : this.jumpBufferMs - deltaMs;
    if (grounded) this.glideMs = 0;

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
        this.setFallSpeed(-HERO.jumpVelocity);
        sfx.jump();
        this.jumpBufferMs = 0;
        this.coyoteMs = 0;
        this.rising = true;
      } else if (input.jumpPressed && !grounded && this.powers.active === 'wind' && this.powers.useActive(now)) {
        // Wind: a second jump in mid-air (it uses Wind's cooldown), then holding jump glides.
        this.setFallSpeed(-WIND.doubleJumpVelocity);
        sfx.doubleJump();
        this.jumpBufferMs = 0;
        this.rising = true;
        this.glideMs = WIND.glideMs;
      }
    }

    // Short hop: letting go of jump early cuts the rise.
    if (this.rising && !input.jumpHeld && this.fallSpeed < 0) {
      this.setFallSpeed(this.fallSpeed * HERO.jumpCutMultiplier);
      this.rising = false;
    }
    if (this.fallSpeed >= 0) this.rising = false;

    // Glide: falling slowly while jump is held, for a limited time.
    if (this.glideMs > 0 && input.jumpHeld && this.fallSpeed > WIND.glideFallSpeed) {
      this.setFallSpeed(WIND.glideFallSpeed);
      this.glideMs -= deltaMs;
    }
    if (this.fallSpeed > this.maxFallSpeed) this.setFallSpeed(this.maxFallSpeed);
  }

  get isGliding(): boolean {
    return this.glideMs > 0 && !this.onGround && this.fallSpeed > 0;
  }

  /**
   * Walking on the ground, a jump pose while rising and a fall pose while dropping, standing still
   * otherwise. An attack plays to the end first; a bow being charged holds its drawn pose.
   */
  private animate(now: number): void {
    if (now < this.attackUntil) return;
    if (this.drawingBow) {
      this.stop();
      this.setFrame(this.look.attack[0]);
    } else if (this.onGround && Math.abs(this.body.velocity.x) > 10) {
      this.play(this.look.walkAnim, true);
    } else {
      this.stop();
      this.setFrame(this.onGround ? this.look.idle : this.fallSpeed < 0 ? this.look.jump : this.look.fall);
    }
  }

  /** Plays the weapon's attack animation (sword lunge, bow release). */
  playAttack(now: number): void {
    this.drawingBow = false;
    this.play(this.look.attackAnim);
    this.attackUntil = now + (this.look.attack.length / HERO_ATTACK_FPS) * 1000;
  }

  setMaxFallSpeed(speed: number): void {
    this.maxFallSpeed = speed;
  }

  /** Launches the hero away from the floor at full strength (mushroom spring, bouncing on an enemy). */
  bounce(velocity: number): void {
    this.setFallSpeed(-velocity);
    this.rising = false;
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
  }

  /** Pushes the hero away from a hit. `dir` is the direction to be pushed in. */
  knockback(dir: number): void {
    this.body.setVelocityX((dir || 1) * HERO.hurtKnockbackX);
    this.setFallSpeed(-HERO.hurtKnockbackY);
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
    this.drawingBow = progress > 0;
    if (progress <= 0) this.clearTint();
    else if (progress < 1) this.setTint(0xfffde7);
    else this.setTint(Math.floor(now / 80) % 2 ? 0xfff176 : 0xffffff);
  }

  freeze(): void {
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.weapon.reset();
    this.powerTrigger.reset();
  }

  respawnAt(at: Point): void {
    this.body.enable = true;
    // Respawn points mark the floor; upside-down, the hero then falls up to the ceiling.
    this.setGravityDir(1);
    this.body.reset(at.x, at.y);
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
    this.rising = false;
    this.controlLockMs = 0;
    this.glideMs = 0;
    this.weapon.reset();
    this.powerTrigger.reset();
    this.attackUntil = 0;
    this.drawingBow = false;
    this.clearTint();
    this.setFlipX(false);
  }
}
