// Wooden crates that Fire burns away (spec: "burns vines and wooden barriers").
// Setting one crate alight burns every crate touching it, spreading outward.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FIRE, TILE } from '../config';
import { sparks } from '../weapons/Fireball';

export class Burnables {
  /** Crates already burning, so a crate is never lit twice. */
  private readonly burning = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    readonly layer: Phaser.Tilemaps.TilemapLayer,
  ) {
    layer.setCollisionByExclusion([-1]);
  }

  isSolidTile(col: number, row: number): boolean {
    return this.layer.hasTileAt(col, row);
  }

  /** Lights the crate at (col, row). Returns false if there is no crate there. */
  ignite(col: number, row: number): boolean {
    if (!this.layer.hasTileAt(col, row) || this.burning.has(`${col},${row}`)) return false;
    sfx.crateBurn();
    // Breadth-first over touching crates; each one burns a little after the one before it.
    const queue: [number, number, number][] = [[col, row, 0]];
    this.burning.add(`${col},${row}`);
    while (queue.length > 0) {
      const [c, r, step] = queue.shift()!;
      this.scene.time.delayedCall(step * FIRE.burnSpreadMs, () => this.burnTile(c, r));
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${c + dc},${r + dr}`;
        if (this.layer.hasTileAt(c + dc, r + dr) && !this.burning.has(key)) {
          this.burning.add(key);
          queue.push([c + dc, r + dr, step + 1]);
        }
      }
    }
    return true;
  }

  private burnTile(col: number, row: number): void {
    this.layer.removeTileAt(col, row);
    this.burning.delete(`${col},${row}`);
    sparks(this.scene, col * TILE + TILE / 2, row * TILE + TILE / 2, 5);
  }
}
