// What creatures need to know about the level. The Game scene implements it.
import type { Point } from '../systems/CheckpointTracker';
import type { GravityDir } from '../systems/flips';

export interface ActorWorld {
  /** Whether the world point (x, y) is inside a solid tile right now. */
  isSolidAt(x: number, y: number): boolean;
  readonly gravityDir: GravityDir;
  heroPosition(): Point;
  /** A thrower's pellet, flying straight in `dir`. */
  throwPellet(x: number, y: number, dir: 1 | -1): void;
}
