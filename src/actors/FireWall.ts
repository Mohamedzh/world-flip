// A wall of fire from the floor up to the ceiling. It burns on touch and blocks the way;
// only Water puts it out (spec).
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FIRE_WALL, TILE } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Point } from '../systems/CheckpointTracker';
import { puff } from '../weapons/projectiles';

export class FireWall extends Phaser.GameObjects.Zone {
  declare body: Phaser.Physics.Arcade.StaticBody;
  private readonly flames: Phaser.GameObjects.Image[] = [];
  private flickerTimer: Phaser.Time.TimerEvent;

  /** `isSolidAt(x, y)` finds the ceiling the wall reaches up to. */
  constructor(scene: Phaser.Scene, at: Point, isSolidAt: (x: number, y: number) => boolean) {
    let tiles = 1;
    while (tiles < FIRE_WALL.maxHeightTiles && !isSolidAt(at.x, at.y - (tiles + 0.5) * TILE)) tiles++;
    const height = tiles * TILE;
    super(scene, at.x, at.y - height / 2, TILE - 4, height);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    for (let i = 0; i < tiles; i++) {
      this.flames.push(
        scene.add.image(at.x, at.y - (i + 0.5) * TILE, i % 2 ? TEXTURES.flameB : TEXTURES.flameA).setDepth(3),
      );
    }
    this.flickerTimer = scene.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => this.flames.forEach((f) => f.setTexture(f.texture.key === TEXTURES.flameA ? TEXTURES.flameB : TEXTURES.flameA)),
    });
  }

  /** Water puts it out in a cloud of steam. */
  extinguish(): void {
    if (!this.active) return;
    sfx.steam();
    this.flickerTimer.remove();
    for (const f of this.flames) {
      puff(this.scene, f.x, f.y, 0xeceff1, 5);
      f.destroy();
    }
    this.destroy();
  }
}
