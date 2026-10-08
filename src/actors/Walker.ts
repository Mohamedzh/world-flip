// The basic enemy: a red square that patrols back and forth, turning at walls and ledges.
// During the friend/foe swap it turns calm: harmless, and the hero can bounce on it.
import Phaser from 'phaser';
import { ENEMY } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';

/** Whether the world point (x, y) is inside a solid tile right now. */
export type SolidAtPoint = (x: number, y: number) => boolean;

export class Walker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind = 'enemy';
  private health: number = ENEMY.walkerHealth;
  private dir: 1 | -1 = -1;
  private calm = false;
  private defeated = false;
  /** Patrolling pauses while a hit's knockback plays out. */
  private stunnedUntil = 0;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    private readonly isSolidAt: SolidAtPoint,
  ) {
    super(scene, at.x, at.y, TEXTURES.enemy);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
  }

  get isCalm(): boolean {
    return this.calm;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  setCalm(calm: boolean): void {
    this.calm = calm;
    this.setTexture(calm ? TEXTURES.enemyCalm : TEXTURES.enemy);
  }

  /** Called every frame by the enemies group. */
  update(time: number): void {
    if (this.defeated || time < this.stunnedUntil) return;
    const b = this.body;
    if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)) {
      this.dir = this.dir > 0 ? -1 : 1;
    } else if (b.blocked.down) {
      // Turn at a ledge instead of walking off it.
      const aheadX = this.dir > 0 ? b.right + 1 : b.left - 1;
      if (!this.isSolidAt(aheadX, b.bottom + 2)) this.dir = this.dir > 0 ? -1 : 1;
    }
    b.setVelocityX(this.dir * ENEMY.walkerSpeed);
  }

  /** Takes weapon damage. Returns true if this defeated the enemy. */
  takeHit(damage: number, fromX: number, now: number): boolean {
    if (this.defeated) return false;
    this.health -= damage;
    const push = Math.sign(this.x - fromX) || 1;
    this.body.setVelocity(push * ENEMY.hitKnockback, -80);
    this.stunnedUntil = now + 250;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(ENEMY.hitFlashMs, () => this.active && this.clearTint());
    if (this.health > 0) return false;
    this.defeat();
    return true;
  }

  /** Removes the enemy with a little poof. */
  defeat(): void {
    this.defeated = true;
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.5,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }
}
