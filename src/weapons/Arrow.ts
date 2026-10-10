// An arrow flies straight for about 12 tiles, then gravity pulls it down. It follows whatever gravity
// the world has at that moment, so arrows in flight obey a flip (spec).
// Charged with a power (spec): fire arrows light crates, water arrows grow seed pods (and put out
// fire walls), ice arrows freeze an enemy, wind arrows pass through every enemy in line.
import Phaser from 'phaser';
import { BOW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Element } from '../systems/powers';

const ARROW_TINT: Record<Element, number> = { fire: 0xff7043, water: 0x4fc3f7, snow: 0xe1f5fe, wind: 0xb2ebf2 };

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
    /** A plain arrow's damage; later worlds have tougher enemies, so arrows hit harder there. */
    baseDamage: number = BOW.damage,
  ) {
    super(scene, x, y, TEXTURES.arrow);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.damage = charged ? baseDamage + BOW.chargedBonus : baseDamage;
    this.piercesLeft = charged ? BOW.chargedPierce : 0;
    this.startX = x;
    this.bornAt = scene.time.now;
    this.body.setSize(6, 3);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(dir * BOW.speed);
    this.setRotation(dir > 0 ? 0 : Math.PI);
    if (charged) this.setTint(0xfff59d).setScale(1.25);
    if (element) this.setTint(ARROW_TINT[element]).setScale(1.25);
    if (element === 'wind') this.piercesLeft = Infinity;
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
