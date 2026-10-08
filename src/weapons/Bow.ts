// The Ranger's bow: tap to shoot, hold 0.8 s for a charged shot that does 2 damage and pierces one enemy.
import { sfx } from '../audio/sfx';
import { BOW } from '../config';
import type { Hero } from '../hero/Hero';
import type { AttackInput } from '../input/Controls';
import { ChargeTrigger } from '../systems/triggers';
import type { CombatWorld, Weapon } from './Weapon';

export class Bow implements Weapon {
  private readonly trigger = new ChargeTrigger(BOW.chargeMs, BOW.cooldownMs);

  constructor(
    private readonly hero: Hero,
    private readonly world: CombatWorld,
  ) {}

  update(input: AttackInput, now: number): void {
    const shot = this.trigger.update(now, input.attackHeld);
    if (shot !== 'none') {
      const dir = this.hero.facing;
      this.world.fireArrow(this.hero.x + dir * 6, this.hero.body.center.y - 1, dir, shot === 'charged');
      sfx.shoot();
    }
    this.hero.showCharge(this.trigger.progress(now), now);
  }

  reset(): void {
    this.trigger.cancel();
  }
}
