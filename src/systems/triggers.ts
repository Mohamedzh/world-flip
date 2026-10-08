// Timing helpers for attacks (and, from milestone 3, powers). Plain TypeScript so they can be unit tested.

/** Allows an action at most once per `cooldownMs`. */
export class Cooldown {
  private readyAt = 0;

  constructor(private readonly cooldownMs: number) {}

  ready(now: number): boolean {
    return now >= this.readyAt;
  }

  /** Uses the action if it's ready. Returns whether it was used. */
  tryUse(now: number): boolean {
    if (!this.ready(now)) return false;
    this.readyAt = now + this.cooldownMs;
    return true;
  }
}

export type ChargeShot = 'none' | 'normal' | 'charged';

/**
 * Hold-to-charge attack (the Ranger's bow): the shot fires when the key is released,
 * charged if it was held at least `chargeMs`. Holding during the cooldown starts charging once it ends.
 */
export class ChargeTrigger {
  private holdStart: number | null = null;
  private readonly cooldown: Cooldown;

  constructor(
    private readonly chargeMs: number,
    cooldownMs: number,
  ) {
    this.cooldown = new Cooldown(cooldownMs);
  }

  update(now: number, held: boolean): ChargeShot {
    if (held) {
      if (this.holdStart === null && this.cooldown.ready(now)) this.holdStart = now;
      return 'none';
    }
    if (this.holdStart === null) return 'none';
    const charged = now - this.holdStart >= this.chargeMs;
    this.holdStart = null;
    this.cooldown.tryUse(now);
    return charged ? 'charged' : 'normal';
  }

  /** 0 when not charging, rising to 1 when a charged shot is ready. */
  progress(now: number): number {
    if (this.holdStart === null) return 0;
    return Math.min(1, (now - this.holdStart) / this.chargeMs);
  }

  cancel(): void {
    this.holdStart = null;
  }
}
