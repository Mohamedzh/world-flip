// Helpers so heroes and creatures work with gravity pulling down (1) or up (-1, the upside-down flip).
import type Phaser from 'phaser';
import type { GravityDir } from '../systems/flips';

/**
 * Standing on something in the direction gravity pulls. Standing on another body (a frozen enemy)
 * only registers every other frame in Arcade Physics, so last frame's touch counts too.
 */
export function onFloor(body: Phaser.Physics.Arcade.Body, dir: GravityDir): boolean {
  return dir > 0
    ? body.blocked.down || body.touching.down || body.wasTouching.down
    : body.blocked.up || body.touching.up || body.wasTouching.up;
}

/** The side of the body that touches the floor: the bottom normally, the top when upside-down. */
export function feetY(body: Phaser.Physics.Arcade.Body, dir: GravityDir): number {
  return dir > 0 ? body.bottom : body.top;
}

/**
 * Flips a sprite's art for the gravity direction and moves its body to the feet side of the frame,
 * without moving the body in the world (so a flip never pushes anyone into a wall).
 * `offsetY` is the body's offset in normal gravity.
 */
export function orientToGravity(sprite: Phaser.Physics.Arcade.Sprite, dir: GravityDir, offsetY: number): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  // Offsets are in the frame's own pixels; Phaser scales them (and the body) by the sprite's scale.
  const target = dir > 0 ? offsetY : sprite.frame.realHeight - offsetY - body.height / sprite.scaleY;
  const shift = target - body.offset.y;
  if (shift !== 0) {
    body.setOffset(body.offset.x, target);
    sprite.y -= shift * sprite.scaleY;
  }
  sprite.setFlipY(dir < 0);
}
