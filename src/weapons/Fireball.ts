// The Fire power's fireball: it bounces along the floor a few times, burns crates and does 3 damage.
// It falls with the world's current gravity, so a flip changes its flight (spec).
import Phaser from 'phaser';
import { FIRE } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';

export class Fireball extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  readonly damage = FIRE.damage;
  private bounces = 0;
  private readonly bornAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1) {
    super(scene, x, y, TEXTURES.fireball);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4);
    this.bornAt = scene.time.now;
    this.body.setSize(6, 6);
    this.body.setVelocity(dir * FIRE.speed, -60);
  }

  /** Called when it lands on a floor: hop again, or fizzle out after a few bounces. */
  bounce(): void {
    this.bounces++;
    if (this.bounces > FIRE.maxBounces) this.burnOut();
    else this.body.setVelocityY(-FIRE.bounceVelocity);
  }

  /** Called every frame by the fireballs group. */
  update(time: number): void {
    this.rotation += 0.3;
    if (time - this.bornAt > FIRE.lifetimeMs) this.burnOut();
  }

  /** Ends with a small burst of sparks. */
  burnOut(): void {
    if (!this.active) return;
    sparks(this.scene, this.x, this.y);
    this.destroy();
  }
}

/** A quick burst of orange sparks, used for fireballs and burning crates. */
export function sparks(scene: Phaser.Scene, x: number, y: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const s = scene.add
      .image(x, y, TEXTURES.pixel)
      .setScale(2)
      .setTint(i % 2 ? 0xffca28 : 0xff7043)
      .setDepth(6);
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(angle) * 12,
      y: y + Math.sin(angle) * 12 - 6,
      alpha: 0,
      duration: 300,
      onComplete: () => s.destroy(),
    });
  }
}
