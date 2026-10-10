// The friend creature: a bounce mushroom that launches the hero high when landed on.
// During the friend/foe swap it turns hostile: it turns red, hops in place and hurts on touch.
// Weapons can only stun it for 3 s, never defeat it (spec).
import Phaser from 'phaser';
import { COLORS, FRIEND } from '../config';
import { SHEETS, TILE_FRAMES } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { GravityDir } from '../systems/flips';
import { onFloor, orientToGravity } from './gravity';
import { StatusMarker } from './StatusMarker';
import { TEXTURES } from '../gfx/placeholderTextures';

const BODY_OFFSET_Y = 7;

export class Mushroom extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly kind = 'friend';
  private hostile = false;
  private stunnedUntil = 0;
  private nextHopAt = 0;
  private gravityDir: GravityDir = 1;
  /** An angry mark while hostile. */
  private readonly angry: StatusMarker;

  constructor(scene: Phaser.Scene, at: Point) {
    super(scene, at.x, at.y, SHEETS.tiles, TILE_FRAMES.mushroom);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(12, 11, false).setOffset(3, BODY_OFFSET_Y);
    this.angry = new StatusMarker(this, TEXTURES.markAngry, () => this.gravityDir);
  }

  get isHostile(): boolean {
    return this.hostile;
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  setHostile(hostile: boolean, now: number): void {
    this.hostile = hostile;
    this.angry.visible = hostile;
    this.stunnedUntil = 0;
    this.restoreTint();
    this.nextHopAt = now + 400;
  }

  setGravityDir(dir: GravityDir): void {
    this.gravityDir = dir;
    orientToGravity(this, dir, BODY_OFFSET_Y);
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
      this.restoreTint();
    }
    if (this.hostile && !this.isStunned(time) && onFloor(this.body, this.gravityDir) && time >= this.nextHopAt) {
      this.body.setVelocityY(-this.gravityDir * FRIEND.hostileHopVelocity);
      this.nextHopAt = time + FRIEND.hostileHopIntervalMs;
    }
  }

  private restoreTint(): void {
    if (this.hostile) this.setTint(COLORS.friendHostile);
    else this.clearTint();
  }
}
