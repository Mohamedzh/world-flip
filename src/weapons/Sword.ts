// The Knight's sword: a short arc in front of the hero, about 1.5 tiles. It also knocks back
// enemy pellets. Charged with a power (spec): Fire = flaming swing (+1 damage), Water = wave slash
// (pushes enemies), Snow = frost swing (slows enemies), Wind = spin attack (hits both sides).
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FIRE, SWORD } from '../config';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import type { Element } from '../systems/powers';
import { Cooldown } from '../systems/triggers';
import type { CombatWorld, Weapon } from './Weapon';

/** Arc color for each power's charged swing. */
const ARC_COLOR: Record<Element | 'none', number> = {
  none: 0xffffff,
  fire: 0xff7043,
  water: 0x4fc3f7,
  snow: 0xe1f5fe,
  wind: 0xb2ebf2,
};

export class Sword implements Weapon {
  private readonly cooldown = new Cooldown(SWORD.cooldownMs);

  constructor(
    private readonly hero: Hero,
    private readonly world: CombatWorld,
  ) {}

  update(input: AttackInput, now: number): void {
    if (input.attackPressed && this.cooldown.tryUse(now)) this.swing(null);
  }

  ready(now: number): boolean {
    return this.cooldown.ready(now);
  }

  charge(element: Element, now: number): void {
    if (this.cooldown.tryUse(now)) this.swing(element);
  }

  reset(): void {}

  private swing(element: Element | null): void {
    const damage = SWORD.damage + (element === 'fire' ? FIRE.swingBonusDamage : 0);
    const hit = { damage, fromX: this.hero.x, element };
    // The wind spin attack hits both sides at once.
    const sides: (1 | -1)[] = element === 'wind' ? [1, -1] : [this.hero.facing];
    for (const dir of sides) {
      this.world.strike(this.area(dir), hit);
      this.showArc(dir, ARC_COLOR[element ?? 'none'], element ? 5 : 3);
    }
    sfx.swing();
    this.hero.playAttack(this.hero.scene.time.now);
  }

  private area(dir: 1 | -1): Phaser.Geom.Rectangle {
    const b = this.hero.body;
    const x = dir > 0 ? b.right : b.left - SWORD.reach;
    return new Phaser.Geom.Rectangle(x, b.center.y - SWORD.height / 2, SWORD.reach, SWORD.height);
  }

  private showArc(dir: 1 | -1, color: number, thickness: number): void {
    const scene = this.hero.scene;
    const { x, y } = this.hero.body.center;
    const facingAngle = dir > 0 ? 0 : Math.PI;
    const g = scene.add.graphics().setDepth(5);
    g.lineStyle(thickness, color, 0.9);
    g.beginPath();
    g.arc(x, y, SWORD.reach - 2, facingAngle - Math.PI / 3, facingAngle + Math.PI / 3);
    g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: SWORD.showMs, onComplete: () => g.destroy() });
  }
}
