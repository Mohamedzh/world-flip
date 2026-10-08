// World 1's guardian. It patrols its arena, and every few seconds shakes as a warning, then charges
// at the hero. Defeating it drops the Fire power. If it falls into a pit, the power still drops
// at the pit's edge (spec).
import Phaser from 'phaser';
import { GUARDIAN } from '../config';
import { LOOKS } from '../gfx/sprites';
import { GUARDIANS } from '../level/LevelData';
import type { Point } from '../systems/CheckpointTracker';
import { Walker, type SolidAtPoint } from './Walker';

type Mode = 'walk' | 'telegraph' | 'charge';

const STATS = GUARDIAN.emberBeetle;

export class EmberBeetle extends Walker {
  readonly guardianKind = 'emberBeetle';
  readonly displayName = GUARDIANS.emberBeetle.name;
  private mode: Mode = 'walk';
  private modeUntil = 0;
  /** Where the beetle last stood on solid ground, for the pit-edge power drop. */
  private lastGround: Point;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    isSolidAt: SolidAtPoint,
    private readonly target: () => Point,
  ) {
    super(scene, at, isSolidAt, {
      look: LOOKS.emberBeetle,
      health: STATS.health,
      speed: STATS.walkSpeed,
      body: { width: 20, height: 16, offsetX: 2, offsetY: 8 },
      tint: 0xff8a50,
    });
    this.lastGround = { ...at };
    this.modeUntil = scene.time.now + STATS.chargeEveryMs;
  }

  /** Where to drop the power if the beetle fell into a pit. */
  get pitEdge(): Point {
    return this.lastGround;
  }

  update(time: number): void {
    if (this.isDefeated) return;
    if (this.body.blocked.down) this.lastGround = { x: this.x, y: this.body.bottom };
    if (time < this.stunnedUntil) return;

    // A calm guardian (friend/foe swap) just wanders.
    if (this.calm) {
      this.mode = 'walk';
      this.patrol(STATS.walkSpeed);
      return;
    }
    if (time >= this.modeUntil) this.nextMode(time);

    switch (this.mode) {
      case 'walk':
        this.patrol(STATS.walkSpeed);
        break;
      case 'telegraph':
        // Stands still and shakes: the warning that a charge is coming.
        this.body.setVelocityX(0);
        this.setX(this.x + (Math.floor(time / 40) % 2 ? 0.6 : -0.6));
        break;
      case 'charge':
        // A charge doesn't stop at ledges, so the beetle can fall into a pit; it does stop at walls.
        if ((this.dir < 0 && this.body.blocked.left) || (this.dir > 0 && this.body.blocked.right)) {
          this.mode = 'walk';
          this.modeUntil = time + STATS.chargeEveryMs;
          this.turn();
        }
        this.body.setVelocityX(this.dir * STATS.chargeSpeed);
        break;
    }
  }

  private nextMode(time: number): void {
    if (this.mode === 'walk') {
      this.mode = 'telegraph';
      this.modeUntil = time + STATS.telegraphMs;
      this.anims.pause();
    } else if (this.mode === 'telegraph') {
      this.mode = 'charge';
      this.modeUntil = time + STATS.chargeMs;
      const towardHero = this.target().x > this.x ? 1 : -1;
      if (towardHero !== this.dir) this.turn();
      this.anims.resume();
      this.anims.timeScale = 3;
    } else {
      this.mode = 'walk';
      this.modeUntil = time + STATS.chargeEveryMs;
      this.anims.timeScale = 1;
    }
  }
}
