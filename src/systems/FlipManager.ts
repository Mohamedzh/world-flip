// Owns the flip timer and order, and announces flips. Nothing else in the game decides when the world flips.
// Plain TypeScript so the timing rules can be unit tested.
import type { FlipState } from './flips';

export interface FlipTiming {
  intervalMs: number;
  warningMs: number;
}

export interface FlipWarning {
  next: FlipState;
}

export interface FlipChange {
  from: FlipState;
  to: FlipState;
}

/**
 * fixed: the flips follow the list in order and loop (levels 1-3).
 * random: each flip is picked at random from the list, never the same as the current state (level 4).
 */
export type FlipMode = 'fixed' | 'random';

type Listener<T> = (event: T) => void;

export class FlipManager {
  private stateValue: FlipState = 'normal';
  /** Position in the flip order (fixed mode); -1 until the first flip. */
  private orderIndex = -1;
  /** The flip that comes next, decided early so the warning can show it. */
  private upcoming: FlipState;
  /** Time since the last flip (or the level start). */
  private sinceFlipMs = 0;
  /** Total time this manager has been updated, used for holds. */
  private clockMs = 0;
  private holdUntilMs = 0;
  private warned = false;
  private readonly warningListeners: Listener<FlipWarning>[] = [];
  private readonly changeListeners: Listener<FlipChange>[] = [];

  /** Every level starts Normal, then follows `order`. `random` returns a number in [0, 1), like Math.random. */
  constructor(
    private readonly order: readonly FlipState[],
    private readonly timing: FlipTiming,
    private readonly mode: FlipMode = 'fixed',
    private readonly random: () => number = Math.random,
  ) {
    if (order.length === 0) throw new Error('Flip order must not be empty');
    this.upcoming = this.pickNext();
  }

  get state(): FlipState {
    return this.stateValue;
  }

  get next(): FlipState {
    return this.upcoming;
  }

  get warningActive(): boolean {
    return this.warned;
  }

  get msUntilFlip(): number {
    return Math.max(0, this.timing.intervalMs - this.sinceFlipMs);
  }

  onWarning(fn: Listener<FlipWarning>): void {
    this.warningListeners.push(fn);
  }

  onChanged(fn: Listener<FlipChange>): void {
    this.changeListeners.push(fn);
  }

  /**
   * Advances the timer. Only call this while the level is being played: not while paused,
   * during a cutscene, or while the hero is dying, so no flip can fire at those times.
   */
  update(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.sinceFlipMs += deltaMs;
    if (!this.warned && this.sinceFlipMs >= this.timing.intervalMs - this.timing.warningMs) {
      this.warned = true;
      for (const fn of this.warningListeners) fn({ next: this.upcoming });
    }
    if (this.sinceFlipMs >= this.timing.intervalMs && this.clockMs >= this.holdUntilMs) this.flip();
  }

  /** Delays any flip for the next `ms` of play, e.g. the 2 s after a respawn. A due flip fires right after. */
  holdFor(ms: number): void {
    this.holdUntilMs = Math.max(this.holdUntilMs, this.clockMs + ms);
  }

  /** Flips immediately (debug key). */
  forceFlip(): void {
    this.flip();
  }

  private flip(): void {
    const from = this.stateValue;
    this.stateValue = this.upcoming;
    if (this.mode === 'fixed') this.orderIndex = (this.orderIndex + 1) % this.order.length;
    this.upcoming = this.pickNext();
    this.sinceFlipMs = 0;
    this.warned = false;
    for (const fn of this.changeListeners) fn({ from, to: this.stateValue });
  }

  private pickNext(): FlipState {
    if (this.mode === 'fixed') return this.order[(this.orderIndex + 1) % this.order.length];
    // Random: never repeat the current state (a "flip" to the same rules would change nothing).
    const choices = this.order.filter((s) => s !== this.stateValue);
    const pool = choices.length > 0 ? choices : this.order;
    return pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))];
  }
}
