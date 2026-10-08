// The friend creature: a bounce mushroom that launches the hero high when landed on.
// During the friend/foe swap it turns hostile: it hops in place and hurts on touch.
// Weapons can only stun it for 3 s, never defeat it (spec).
import Phaser from 'phaser';
import { COLORS, FRIEND } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';

export class Mushroom extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind = 'friend';
  private hostile = false;
  private stunnedUntil = 0;
  private nextHopAt = 0;

  constructor(scene: Phaser.Scene, at: Point) {
    super(scene, at.x, at.y, TEXTURES.mushroom);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(14, 13);
  }

  get isHostile(): boolean {
    return this.hostile;
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  setHostile(hostile: boolean, now: number): void {
    this.hostile = hostile;
    this.stunnedUntil = 0;
    this.clearTint();
    this.setTexture(hostile ? TEXTURES.mushroomHostile : TEXTURES.mushroom);
    this.nextHopAt = now + 400;
  }

  stun(now: number): void {
    this.stunnedUntil = now + FRIEND.stunMs;
    this.setTint(COLORS.stunned);
  }

  /** Squashes like a spring when the hero bounces on it. */
  squash(): void {
    this.scene.tweens.add({ targets: this, scaleY: 0.6, scaleX: 1.2, duration: 70, yoyo: true });
  }

  /** Called every frame by the mushrooms group. */
  update(time: number): void {
    this.body.setVelocityX(0);
    if (this.stunnedUntil > 0 && time >= this.stunnedUntil) {
      this.stunnedUntil = 0;
      this.clearTint();
    }
    if (this.hostile && !this.isStunned(time) && this.body.blocked.down && time >= this.nextHopAt) {
      this.body.setVelocityY(-FRIEND.hostileHopVelocity);
      this.nextHopAt = time + FRIEND.hostileHopIntervalMs;
    }
  }
}
