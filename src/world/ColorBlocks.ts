// The orange and blue block layers. Normal: orange solid, blue ghosts. Color swap: the reverse.
import Phaser from 'phaser';
import { COLORS } from '../config';

export class ColorBlocks {
  private swapped = false;

  constructor(
    private readonly orange: Phaser.Tilemaps.TilemapLayer,
    private readonly blue: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.apply(false);
  }

  get layers(): Phaser.Tilemaps.TilemapLayer[] {
    return [this.orange, this.blue];
  }

  get isSwapped(): boolean {
    return this.swapped;
  }

  /** Sets which color is solid. Returns true if anything changed. */
  apply(swapped: boolean): boolean {
    const changed = swapped !== this.swapped;
    this.swapped = swapped;
    const [solid, ghost] = swapped ? [this.blue, this.orange] : [this.orange, this.blue];
    solid.setCollisionByExclusion([-1], true).setAlpha(1);
    ghost.setCollisionByExclusion([-1], false).setAlpha(COLORS.ghostAlpha);
    return changed;
  }

  isSolidTile(col: number, row: number): boolean {
    return (this.swapped ? this.blue : this.orange).hasTileAt(col, row);
  }
}
