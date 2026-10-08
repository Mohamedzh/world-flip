// A tougher enemy from World 3 on (spec: later enemies throw projectiles). It ambles slowly and,
// when the hero is in front of it and in range, throws a slow pellet. The Knight's swing knocks
// pellets back.
import type Phaser from 'phaser';
import { THROWER, TILE } from '../config';
import { LOOKS } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { ActorWorld } from './ActorWorld';
import { Walker, type WalkerStyle } from './Walker';

export class Thrower extends Walker {
  private nextThrowAt: number;

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld, health: number) {
    const style: WalkerStyle = {
      look: LOOKS.thrower,
      health,
      speed: THROWER.speed,
      body: { width: 14, height: 16, offsetX: 5, offsetY: 8 },
      tint: 0xffffff,
    };
    super(scene, at, world, style);
    this.nextThrowAt = scene.time.now + THROWER.throwEveryMs;
  }

  update(time: number): void {
    super.update(time);
    if (this.isDefeated || this.calm || this.isFrozen(time) || time < this.nextThrowAt) return;
    const hero = this.world.heroPosition();
    const dx = hero.x - this.x;
    const inRange = Math.abs(dx) < THROWER.rangeTiles * TILE && Math.abs(hero.y - this.y) < TILE * 3;
    if (!inRange) return;
    // Turn to face the hero, then throw.
    const toward = dx > 0 ? 1 : -1;
    if (toward !== this.dir) this.turn();
    this.world.throwPellet(this.x + toward * 8, this.body.center.y, toward);
    this.nextThrowAt = time + THROWER.throwEveryMs;
  }
}
