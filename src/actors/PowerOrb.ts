// The glowing orb a guardian drops. Touching it earns its power forever.
import Phaser from 'phaser';
import { POWER_ICONS } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';
import type { Element } from '../systems/powers';

export class PowerOrb extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    readonly element: Element,
  ) {
    // Floats a little above the floor point it was dropped at.
    super(scene, at.x, at.y - 14, POWER_ICONS[element]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setScale(1.6).setDepth(3);
    const glow = scene.add.circle(this.x, this.y, 11, 0xffffff, 0.25).setDepth(2);
    scene.tweens.add({ targets: [this, glow], y: this.y - 4, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: glow, scale: 1.3, alpha: 0.1, yoyo: true, repeat: -1, duration: 500 });
    this.once(Phaser.GameObjects.Events.DESTROY, () => glow.destroy());
  }
}
