// An arrow flies straight for about 12 tiles, then gravity pulls it down. It follows whatever gravity
// the world has at that moment, so arrows in flight obey a flip (spec).
// A fire arrow (bow charged with Fire) lights crates it hits.
import Phaser from 'phaser';
import { BOW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Element } from '../systems/powers';

export class Arrow extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  readonly damage: number;
  /** How many more enemies this arrow passes through before stopping. */
  piercesLeft: number;
  /** Creatures already hit, so a piercing arrow never hits the same one twice. */
  readonly hitTargets = new Set<Phaser.GameObjects.GameObject>();
  private readonly startX: number;
  private readonly bornAt: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dir: 1 | -1,
    charged: boolean,
    readonly element: Element | null = null,
  ) {
    super(scene, x, y, TEXTURES.arrow);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.damage = charged ? BOW.chargedDamage : BOW.damage;
    this.piercesLeft = charged ? BOW.chargedPierce : 0;
    this.startX = x;
    this.bornAt = scene.time.now;
    this.body.setSize(6, 3);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(dir * BOW.speed);
    this.setRotation(dir > 0 ? 0 : Math.PI);
    if (charged) this.setTint(0xfff59d).setScale(1.25);
    if (element === 'fire') this.setTint(0xff7043).setScale(1.25);
  }

  /** Called every frame by the arrows group. */
  update(time: number): void {
    if (!this.body.allowGravity && Math.abs(this.x - this.startX) >= BOW.straightRange) {
      this.body.setAllowGravity(true);
    }
    this.setRotation(Math.atan2(this.body.velocity.y, this.body.velocity.x));
    if (time - this.bornAt > BOW.maxLifetimeMs) this.destroy();
  }
}
