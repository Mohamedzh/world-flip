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

type Listener<T> = (event: T) => void;

export class FlipManager {
  private stateValue: FlipState = 'normal';
  /** Position in the flip order; -1 until the first flip. */
  private orderIndex = -1;
  /** Time since the last flip (or the level start). */
  private sinceFlipMs = 0;
  /** Total time this manager has been updated, used for holds. */
  private clockMs = 0;
  private holdUntilMs = 0;
  private warned = false;
  private readonly warningListeners: Listener<FlipWarning>[] = [];
  private readonly changeListeners: Listener<FlipChange>[] = [];

  /** Every level starts Normal, then follows `order`, looping back to the start of the list. */
  constructor(
    private readonly order: readonly FlipState[],
    private readonly timing: FlipTiming,
  ) {
    if (order.length === 0) throw new Error('Flip order must not be empty');
  }

  get state(): FlipState {
    return this.stateValue;
  }

  get next(): FlipState {
    return this.order[(this.orderIndex + 1) % this.order.length];
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
      for (const fn of this.warningListeners) fn({ next: this.next });
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
    this.orderIndex = (this.orderIndex + 1) % this.order.length;
    this.stateValue = this.order[this.orderIndex];
    this.sinceFlipMs = 0;
    this.warned = false;
    for (const fn of this.changeListeners) fn({ from, to: this.stateValue });
  }
}
