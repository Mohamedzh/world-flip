// The glowing orb a guardian drops. Touching it earns its power forever. It sits on a dark disc
// with a ring in the power's color, so it shows up against any background (white snow and wind
// icons were invisible on the pale Mountain and Sky).
import Phaser from 'phaser';
import { POWER_ICONS } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';
import type { Element } from '../systems/powers';

const ORB_RING: Record<Element, number> = { fire: 0xff7043, water: 0x4fc3f7, snow: 0x90caf9, wind: 0x4dd0e1 };

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
    this.setScale(1.6).setDepth(4);
    const ring = ORB_RING[element];
    const glow = scene.add.circle(this.x, this.y, 15, ring, 0.35).setDepth(2);
    const disc = scene.add.circle(this.x, this.y, 11, 0x10141c, 0.9).setStrokeStyle(2, ring).setDepth(3);
    scene.tweens.add({ targets: [this, glow, disc], y: this.y - 4, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: glow, scale: 1.35, alpha: 0.12, yoyo: true, repeat: -1, duration: 500 });
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      glow.destroy();
      disc.destroy();
    });
  }
}
