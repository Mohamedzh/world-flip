// Elemental powers: which ones the hero owns, which is active, and their cooldowns.
// Plain TypeScript so the rules can be unit tested.

export const ELEMENTS = ['fire', 'water', 'snow', 'wind'] as const;
export type Element = (typeof ELEMENTS)[number];

export function isElement(value: string): value is Element {
  return (ELEMENTS as readonly string[]).includes(value);
}

export const ELEMENT_INFO: Record<Element, { label: string }> = {
  fire: { label: 'Fire' },
  water: { label: 'Water' },
  snow: { label: 'Snow' },
  wind: { label: 'Wind' },
};

export class PowerSystem {
  private readonly owned: Element[] = [];
  private activeValue: Element | null = null;
  private readonly readyAt = new Map<Element, number>();

  constructor(
    private readonly cooldownMs: Record<Element, number>,
    owned: readonly Element[] = [],
  ) {
    for (const e of owned) this.grant(e);
  }

  get active(): Element | null {
    return this.activeValue;
  }

  /** Owned powers in the fixed order fire, water, snow, wind. */
  get ownedPowers(): Element[] {
    return ELEMENTS.filter((e) => this.owned.includes(e));
  }

  has(e: Element): boolean {
    return this.owned.includes(e);
  }

  /** Earns a power forever. A newly earned power becomes the active one. Returns false if already owned. */
  grant(e: Element): boolean {
    if (this.has(e)) return false;
    this.owned.push(e);
    this.activeValue = e;
    return true;
  }

  /** Makes an owned power active (keys 1-4). */
  select(e: Element): boolean {
    if (!this.has(e)) return false;
    this.activeValue = e;
    return true;
  }

  /** Switches to the next owned power (key L). */
  cycle(): void {
    const list = this.ownedPowers;
    if (list.length === 0) return;
    const i = this.activeValue ? list.indexOf(this.activeValue) : -1;
    this.activeValue = list[(i + 1) % list.length];
  }

  ready(e: Element, now: number): boolean {
    return this.has(e) && now >= (this.readyAt.get(e) ?? 0);
  }

  /** Uses the active power if it's ready (casting or charging the weapon). Returns the element used. */
  useActive(now: number): Element | null {
    const e = this.activeValue;
    if (!e || !this.ready(e, now)) return null;
    this.readyAt.set(e, now + this.cooldownMs[e]);
    return e;
  }

  /** 0 = just used, 1 = ready. */
  readiness(e: Element, now: number): number {
    const at = this.readyAt.get(e) ?? 0;
    if (now >= at) return 1;
    return 1 - (at - now) / this.cooldownMs[e];
  }
}

export type PowerAction = 'none' | 'cast' | 'chargeWeapon';

/**
 * Reads the power key together with the attack key:
 * tap K alone to cast; hold K and press J to charge the weapon with the power instead.
 * The cast happens when K is released, and only if J wasn't used during that hold.
 */
export class PowerTrigger {
  private holding = false;
  private usedForWeapon = false;

  update(powerHeld: boolean, attackPressed: boolean): PowerAction {
    if (powerHeld) {
      if (!this.holding) {
        this.holding = true;
        this.usedForWeapon = false;
      }
      if (attackPressed && !this.usedForWeapon) {
        this.usedForWeapon = true;
        return 'chargeWeapon';
      }
      return 'none';
    }
    if (!this.holding) return 'none';
    this.holding = false;
    return this.usedForWeapon ? 'none' : 'cast';
  }

  reset(): void {
    this.holding = false;
    this.usedForWeapon = false;
  }
}
