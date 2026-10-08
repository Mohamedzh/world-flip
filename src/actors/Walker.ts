// The basic enemy: patrols back and forth, turning at walls and ledges.
// During the friend/foe swap it turns calm: harmless, and the hero can bounce on it.
import Phaser from 'phaser';
import { COLORS, ENEMY } from '../config';
import { LOOKS, type Look } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';

/** Whether the world point (x, y) is inside a solid tile right now. */
export type SolidAtPoint = (x: number, y: number) => boolean;

export interface WalkerStyle {
  look: Look;
  health: number;
  speed: number;
  /** Body size and its offset inside the 24 x 24 frame, so the feet line up with the art. */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  /** Tint for the creature's normal state (white = the art's own colors). */
  tint: number;
}

const BASIC_WALKER: WalkerStyle = {
  look: LOOKS.walker,
  health: ENEMY.walkerHealth,
  speed: ENEMY.walkerSpeed,
  body: { width: 14, height: 11, offsetX: 5, offsetY: 13 },
  tint: 0xffffff,
};

export class Walker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind = 'enemy';
  protected health: number;
  protected readonly maxHealth: number;
  protected dir: 1 | -1 = -1;
  protected calm = false;
  private defeated = false;
  /** Patrolling pauses while a hit's knockback plays out. */
  protected stunnedUntil = 0;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    protected readonly isSolidAt: SolidAtPoint,
    protected readonly style: WalkerStyle = BASIC_WALKER,
  ) {
    super(scene, at.x, at.y, style.look.sheet, style.look.frames[0]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
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

  setCalm(calm: boolean): void {
    this.calm = calm;
    this.restoreTint();
  }

  /** Called every frame by the enemies group. */
  update(time: number): void {
    if (this.defeated || time < this.stunnedUntil) return;
    this.patrol(this.style.speed);
  }

  protected patrol(speed: number): void {
    const b = this.body;
    if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)) {
      this.turn();
    } else if (b.blocked.down) {
      // Turn at a ledge instead of walking off it.
      const aheadX = this.dir > 0 ? b.right + 1 : b.left - 1;
      if (!this.isSolidAt(aheadX, b.bottom + 2)) this.turn();
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
    const push = Math.sign(this.x - fromX) || 1;
    this.body.setVelocity(push * ENEMY.hitKnockback, -80);
    this.stunnedUntil = now + 250;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(ENEMY.hitFlashMs, () => this.active && this.restoreTint());
    if (this.health > 0) return false;
    this.defeat();
    return true;
  }

  /** Removes the enemy with a little poof. */
  defeat(): void {
    this.defeated = true;
    this.body.enable = false;
    this.stop();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.5,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }

  protected restoreTint(): void {
    const tint = this.calm ? COLORS.enemyCalm : this.style.tint;
    if (tint === 0xffffff) this.clearTint();
    else this.setTint(tint);
  }
}
