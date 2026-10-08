// The hero's movement, shared by both heroes. Knight and Ranger subclasses (weapons) come in milestone 2.
import Phaser from 'phaser';
import { HERO, PHYSICS } from '../config';
import type { MoveInput } from '../input/Controls';
import type { Point } from '../systems/CheckpointTracker';
import { approach } from '../systems/math';

export class Hero extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  /** Time left in which a jump still counts after leaving the ground. */
  private coyoteMs = 0;
  /** Time left in which an early jump press will still fire on landing. */
  private jumpBufferMs = 0;
  /** True from takeoff until the jump peaks, so releasing the key can cut the jump short. */
  private rising = false;

  constructor(scene: Phaser.Scene, at: Point, texture: string) {
    super(scene, at.x, at.y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Position is the hero's feet, matching where level objects mark the floor.
    this.setOrigin(0.5, 1);
    this.body.setSize(HERO.width, HERO.height);
    this.body.setMaxVelocity(10_000, PHYSICS.maxFallSpeed);
    this.setCollideWorldBounds(true);
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  move(input: MoveInput, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const grounded = this.onGround;

    this.coyoteMs = grounded ? HERO.coyoteMs : this.coyoteMs - deltaMs;
    this.jumpBufferMs = input.jumpPressed ? HERO.jumpBufferMs : this.jumpBufferMs - deltaMs;

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

    // Short hop: letting go of jump early cuts the rise.
    if (this.rising && !input.jumpHeld && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * HERO.jumpCutMultiplier);
      this.rising = false;
    }
    if (this.body.velocity.y >= 0) this.rising = false;
  }

  /** Blinks while invulnerable. */
  showInvulnerable(invulnerable: boolean, now: number): void {
    const hidden = invulnerable && Math.floor(now / HERO.blinkIntervalMs) % 2 === 0;
    this.setAlpha(hidden ? 0.2 : 1);
  }

  freeze(): void {
    this.body.setVelocity(0, 0);
    this.body.enable = false;
  }

  respawnAt(at: Point): void {
    this.body.enable = true;
    this.body.reset(at.x, at.y);
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
    this.rising = false;
    this.clearTint();
    this.setFlipX(false);
  }
}
