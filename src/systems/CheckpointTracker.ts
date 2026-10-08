// Remembers which checkpoint the hero respawns at. Plain TypeScript so it can be unit tested.

export interface Point {
  x: number;
  y: number;
}

export class CheckpointTracker {
  /** Index of the furthest checkpoint reached; -1 means the level's spawn point. */
  private active = -1;

  /** Checkpoints must be in level order (left to right). */
  constructor(
    private readonly spawn: Point,
    private readonly checkpoints: readonly Point[],
  ) {}

  get activeIndex(): number {
    return this.active;
  }

  get respawnPoint(): Point {
    return this.active < 0 ? this.spawn : this.checkpoints[this.active];
  }

  /**
   * Called when the hero touches checkpoint `index`. Returns true if it became the new respawn point.
   * Touching an earlier checkpoint again never moves the respawn point backwards.
   */
  activate(index: number): boolean {
    if (index < 0 || index >= this.checkpoints.length || index <= this.active) return false;
    this.active = index;
    return true;
  }

  reset(): void {
    this.active = -1;
  }
}
