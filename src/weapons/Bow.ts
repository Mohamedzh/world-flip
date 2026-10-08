// The Ranger's bow: tap to shoot, hold 0.8 s for a charged shot that does 2 damage and pierces one enemy.
// Charged with a power it shoots that element's arrow: fire lights crates, water grows seed pods
// from afar, ice freezes one enemy, wind passes through every enemy in line (spec).
import { sfx } from '../audio/sfx';
import { BOW } from '../config';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import type { Element } from '../systems/powers';
import { ChargeTrigger, Cooldown } from '../systems/triggers';
import type { CombatWorld, Weapon } from './Weapon';

export class Bow implements Weapon {
  private readonly trigger = new ChargeTrigger(BOW.chargeMs, BOW.cooldownMs);
  /** Powered shots have their own cooldown, the same length as a normal shot's. */
  private readonly poweredCooldown = new Cooldown(BOW.cooldownMs);
  /** After a powered shot, ignore the attack key until it is let go, so it doesn't also fire normally. */
  private ignoreUntilRelease = false;

  constructor(
    private readonly hero: Hero,
    private readonly world: CombatWorld,
  ) {}

  update(input: AttackInput, now: number): void {
    if (this.ignoreUntilRelease) {
      if (!input.attackHeld) this.ignoreUntilRelease = false;
      this.hero.showCharge(0, now);
      return;
    }
    const shot = this.trigger.update(now, input.attackHeld);
    if (shot !== 'none') this.shoot(shot === 'charged', null);
    this.hero.showCharge(this.trigger.progress(now), now);
  }

  ready(now: number): boolean {
    return this.poweredCooldown.ready(now);
  }

  charge(element: Element, now: number): void {
    if (!this.poweredCooldown.tryUse(now)) return;
    this.trigger.cancel();
    this.ignoreUntilRelease = true;
    this.shoot(false, element);
  }

  reset(): void {
    this.trigger.cancel();
    this.ignoreUntilRelease = false;
  }

  private shoot(charged: boolean, element: Element | null): void {
    const dir = this.hero.facing;
    this.world.fireArrow(this.hero.x + dir * 6, this.hero.body.center.y - 1, dir, charged, element);
    sfx.shoot();
    this.hero.playAttack(this.hero.scene.time.now);
  }
}
