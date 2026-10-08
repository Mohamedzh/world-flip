// The basic enemy: patrols back and forth, turning at walls and ledges.
// During the friend/foe swap it turns calm: harmless, and the hero can bounce on it.
// Snow can freeze it into an ice block (stand on it) or slow it; Water and Wind push it.
import Phaser from 'phaser';
import { COLORS, ENEMY, SNOW } from '../config';
import { LOOKS, type Look } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { GravityDir } from '../systems/flips';
import type { ActorWorld } from './ActorWorld';
import { feetY, onFloor, orientToGravity } from './gravity';

export interface WalkerStyle {
  look: Look;
  health: number;
  speed: number;
  /** Body size and its offset inside the 24 x 24 frame, so the feet line up with the art. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  /** Tint for the creature's normal state (white = the art's own colors). */
  tint: number;
  scale?: number;
}

export const BASIC_WALKER: WalkerStyle = {
  look: LOOKS.walker,
  health: ENEMY.walkerHealth,
  speed: ENEMY.walkerSpeed,
  body: { width: 14, height: 11, offsetX: 5, offsetY: 13 },
  tint: 0xffffff,
};

/** Frozen enemies look like blocks of white ice. */
const ICE_TINT = 0xeaf6ff;

export class Walker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind = 'enemy';
  protected health: number;
  protected readonly maxHealth: number;
  protected dir: 1 | -1 = -1;
  protected calm = false;
  protected gravityDir: GravityDir = 1;
  private defeated = false;
  /** Patrolling pauses while a hit's knockback or a push plays out. */
  protected stunnedUntil = 0;
  private frozenUntil = 0;
  private slowedUntil = 0;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    protected readonly world: ActorWorld,
    protected readonly style: WalkerStyle = BASIC_WALKER,
  ) {
    super(scene, at.x, at.y, style.look.sheet, style.look.frames[0]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    if (style.scale) this.setScale(style.scale);
    const b = style.body;
    this.body.setSize(b.width, b.height, false).setOffset(b.offsetX, b.offsetY);
    this.setCollideWorldBounds(true);
    this.health = style.health;
    this.maxHealth = style.health;
    this.restoreTint();
    this.play(style.look.walkAnim);
  }

  get isCalm(): boolean {
    return this.calm;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  get healthFraction(): number {
    return Math.max(0, this.health) / this.maxHealth;
  }

  isFrozen(now: number): boolean {
    return now < this.frozenUntil;
  }

  setCalm(calm: boolean): void {
    this.calm = calm;
    this.restoreTint();
  }

  setGravityDir(dir: GravityDir): void {
    this.gravityDir = dir;
    orientToGravity(this, dir, this.style.body.offsetY);
  }

  /** Called every frame by the enemies group. */
  update(time: number): void {
    if (this.defeated || this.updateFrozen(time) || time < this.stunnedUntil) return;
    this.patrol(this.currentSpeed(time, this.style.speed));
  }

  /** Handles the frozen state. Returns true while still frozen (nothing else should move it). */
  protected updateFrozen(time: number): boolean {
    if (this.frozenUntil === 0) return false;
    if (time < this.frozenUntil) {
      this.body.setVelocityX(0);
      return true;
    }
    this.thaw();
    return false;
  }

  protected currentSpeed(time: number, speed: number): number {
    return time < this.slowedUntil ? speed * SNOW.slowFactor : speed;
  }

  protected patrol(speed: number): void {
    const b = this.body;
    if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)) {
      this.turn();
    } else if (onFloor(b, this.gravityDir)) {
      // Turn at a ledge instead of walking off it.
      const aheadX = this.dir > 0 ? b.right + 1 : b.left - 1;
      if (!this.world.isSolidAt(aheadX, feetY(b, this.gravityDir) + this.gravityDir * 2)) this.turn();
    }
    b.setVelocityX(this.dir * speed);
  }

  protected turn(): void {
    this.dir = this.dir > 0 ? -1 : 1;
    // The Kenney creatures face left in the art.
    this.setFlipX(this.dir > 0);
  }

  /** Takes weapon damage. Returns true if this defeated the enemy. */
  takeHit(damage: number, fromX: number, now: number): boolean {
    if (this.defeated) return false;
    this.health -= damage;
    if (!this.isFrozen(now)) {
      const push = Math.sign(this.x - fromX) || 1;
      this.body.setVelocity(push * ENEMY.hitKnockback, -80 * this.gravityDir);
      this.stunnedUntil = now + 250;
    }
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(ENEMY.hitFlashMs, () => this.active && this.restoreTint());
    if (this.health > 0) return false;
    this.defeat();
    return true;
  }

  /** Shoved by Water or Wind: slides without patrolling, so it can go over a ledge. */
  push(velocityX: number, velocityY: number, ms: number, now: number): void {
    if (this.defeated || this.isFrozen(now)) return;
    this.body.setVelocity(velocityX, velocityY);
    this.stunnedUntil = now + ms;
  }

  /** Snow: frozen into a block of ice the hero can stand on. */
  freeze(now: number): void {
    if (this.defeated) return;
    this.frozenUntil = now + SNOW.freezeMs;
    this.body.setVelocity(0, 0);
    this.body.pushable = false;
    this.anims.pause();
    this.restoreTint();
  }

  /** Snow on the Knight's sword: moves slowly for a while. */
  slow(now: number): void {
    this.slowedUntil = now + SNOW.slowMs;
    this.restoreTint();
  }

  thaw(): void {
    if (this.frozenUntil === 0) return;
    this.frozenUntil = 0;
    this.body.pushable = true;
    this.anims.resume();
    this.restoreTint();
  }

  /** Removes the enemy with a little poof. */
  defeat(): void {
    this.defeated = true;
    this.body.enable = false;
    this.stop();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: (this.style.scale ?? 1) * 1.5,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }

  protected restoreTint(): void {
    const now = this.scene.time.now;
    // Frozen: a solid icy-white shape, like a block of ice (a tint alone can't lighten the art).
    if (this.isFrozen(now)) {
      this.setTintFill(ICE_TINT);
      return;
    }
    const tint = this.calm
        ? COLORS.enemyCalm
        : now < this.slowedUntil
          ? 0xc8ecff
          : this.style.tint;
    if (tint === 0xffffff) this.clearTint();
    else this.setTint(tint);
  }
}
