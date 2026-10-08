// Hearts, lives and invulnerability. Plain TypeScript (no Phaser) so the rules can be unit tested.

export interface VitalsConfig {
  maxHearts: number;
  lives: number;
  invulnerableMs: number;
}

/** What a hit did: blocked by invulnerability, cost a heart, or emptied the hearts. */
export type HitResult = 'ignored' | 'hurt' | 'dead';

/** After a life is lost: respawn at the checkpoint, or restart the level when no lives are left. */
export type LifeLossResult = 'respawn' | 'restartLevel';

export class HeroVitals {
  hearts: number;
  lives: number;
  private invulnerableUntil = 0;

  constructor(private readonly cfg: VitalsConfig) {
    this.hearts = cfg.maxHearts;
    this.lives = cfg.lives;
  }

  get maxHearts(): number {
    return this.cfg.maxHearts;
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  takeHit(now: number, amount = 1): HitResult {
    if (this.hearts === 0 || this.isInvulnerable(now)) return 'ignored';
    this.hearts = Math.max(0, this.hearts - amount);
    if (this.hearts === 0) return 'dead';
    this.invulnerableUntil = now + this.cfg.invulnerableMs;
    return 'hurt';
  }

  /** Spends one life and refills hearts. With no lives left, the level restarts with full lives. */
  loseLife(): LifeLossResult {
    this.lives = Math.max(0, this.lives - 1);
    this.hearts = this.cfg.maxHearts;
    if (this.lives > 0) return 'respawn';
    this.resetLevel();
    return 'restartLevel';
  }

  grantInvulnerability(now: number, ms: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, now + ms);
  }

  resetLevel(): void {
    this.hearts = this.cfg.maxHearts;
    this.lives = this.cfg.lives;
    this.invulnerableUntil = 0;
  }
}
