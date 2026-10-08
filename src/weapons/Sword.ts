// The Knight's sword: a short arc in front of the hero, about 1.5 tiles.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { SWORD } from '../config';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import { Cooldown } from '../systems/triggers';
import type { CombatWorld, Weapon } from './Weapon';

export class Sword implements Weapon {
  private readonly cooldown = new Cooldown(SWORD.cooldownMs);

  constructor(
    private readonly hero: Hero,
    private readonly world: CombatWorld,
  ) {}

  update(input: AttackInput, now: number): void {
    if (!input.attackPressed || !this.cooldown.tryUse(now)) return;
    const b = this.hero.body;
    const dir = this.hero.facing;
    const x = dir > 0 ? b.right : b.left - SWORD.reach;
    const area = new Phaser.Geom.Rectangle(x, b.center.y - SWORD.height / 2, SWORD.reach, SWORD.height);
    this.world.strike(area, SWORD.damage, this.hero.x);
    this.showArc(dir);
    sfx.swing();
  }

  reset(): void {}

  private showArc(dir: 1 | -1): void {
    const scene = this.hero.scene;
    const { x, y } = this.hero.body.center;
    const facingAngle = dir > 0 ? 0 : Math.PI;
    const g = scene.add.graphics().setDepth(5);
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.arc(x, y, SWORD.reach - 2, facingAngle - Math.PI / 3, facingAngle + Math.PI / 3);
    g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: SWORD.showMs, onComplete: () => g.destroy() });
  }
}
