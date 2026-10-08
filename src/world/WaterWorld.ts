// Water in the level: deadly to fall into, frozen into ice bridges by Snow (spec: 8 s), and the
// puddles a Water wave leaves across a gap, which Snow can also freeze (the Water-then-Snow combo).
import Phaser from 'phaser';
import { SNOW, TILE, WATER } from '../config';
import { TILE_FRAMES } from '../gfx/sprites';

/** Tile index of our ice block in the blocks tileset (its 5th tile). */
const ICE_TILE_OFFSET = 4;

export class WaterWorld {
  private readonly ice: Phaser.Tilemaps.TilemapLayer;
  private readonly puddles: Phaser.Tilemaps.TilemapLayer;
  private readonly iceTile: number;
  private readonly puddleTile: number;

  constructor(
    private readonly scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    private readonly water: Phaser.Tilemaps.TilemapLayer,
    tilesets: { kenney: Phaser.Tilemaps.Tileset; blocks: Phaser.Tilemaps.Tileset },
    /** Whether a tile is solid ground or blocks (puddles are only left in empty space). */
    private readonly isSolidTile: (col: number, row: number) => boolean,
  ) {
    water.setAlpha(0.85).setDepth(3);
    this.puddles = map.createBlankLayer('puddles', [tilesets.kenney, tilesets.blocks])!.setAlpha(0.8).setDepth(3);
    // Ice sits above the water (which is drawn over everything else), so a frozen surface looks frozen.
    this.ice = map.createBlankLayer('ice', [tilesets.kenney, tilesets.blocks])!.setDepth(3.5);
    this.iceTile = tilesets.blocks.firstgid + ICE_TILE_OFFSET;
    this.puddleTile = tilesets.kenney.firstgid + TILE_FRAMES.waterTop;
  }

  /** The ice layer is solid where it has tiles; heroes and creatures collide with it. */
  get iceLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.ice;
  }

  isIce(col: number, row: number): boolean {
    return this.ice.hasTileAt(col, row);
  }

  /** Deadly water at this tile (not frozen over). Puddles over gaps aren't deadly; you just fall through. */
  isWater(col: number, row: number): boolean {
    return this.water.hasTileAt(col, row) && !this.ice.hasTileAt(col, row);
  }

  /** Whether any part of the box is in deadly water. */
  inWater(x: number, y: number, width: number, height: number): boolean {
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + width - 1) / TILE);
    // Only the lower half counts, so brushing the surface isn't fatal.
    const r0 = Math.floor((y + height / 2) / TILE);
    const r1 = Math.floor((y + height - 1) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.isWater(c, r)) return true;
    return false;
  }

  /** A Water wave crossing an empty gap leaves a puddle sheet there for a few seconds. */
  leavePuddle(col: number, row: number): void {
    if (this.isSolidTile(col, row) || this.water.hasTileAt(col, row) || this.puddles.hasTileAt(col, row)) return;
    this.puddles.putTileAt(this.puddleTile, col, row);
    this.scene.time.delayedCall(WATER.puddleMs, () => {
      if (!this.ice.hasTileAt(col, row)) this.puddles.removeTileAt(col, row);
    });
  }

  /**
   * Snow touching water or a puddle at (col, row): freezes the whole surface row it belongs to
   * into an ice bridge for 8 s. Returns false if there is nothing to freeze there.
   */
  freezeAt(col: number, row: number): boolean {
    const surface = this.surfaceRow(col, row);
    if (surface === null) return false;
    const cells: number[] = [];
    for (const step of [-1, 1]) {
      for (let c = step < 0 ? col : col + 1; this.isFreezable(c, surface); c += step) cells.push(c);
    }
    if (cells.length === 0) return false;
    const tiles = cells.map((c) => {
      const tile = this.ice.putTileAt(this.iceTile, c, surface);
      tile.setCollision(true);
      return tile;
    });
    // Blink near the end as a warning, then melt; anyone standing on it falls normally (spec).
    const warnAt = SNOW.iceBridgeMs - SNOW.iceWarningMs;
    this.scene.time.delayedCall(warnAt, () => {
      this.scene.tweens.add({ targets: tiles, alpha: 0.3, yoyo: true, repeat: 4, duration: SNOW.iceWarningMs / 10 });
    });
    this.scene.time.delayedCall(SNOW.iceBridgeMs, () => {
      for (const c of cells) {
        this.ice.removeTileAt(c, surface);
        this.puddles.removeTileAt(c, surface);
      }
    });
    return true;
  }

  private isFreezable(col: number, row: number): boolean {
    return (this.water.hasTileAt(col, row) || this.puddles.hasTileAt(col, row)) && !this.ice.hasTileAt(col, row);
  }

  /** The top row of the water at (col, row), or the puddle row; null if there's no water there. */
  private surfaceRow(col: number, row: number): number | null {
    if (this.puddles.hasTileAt(col, row)) return row;
    // A snowball can touch the surface from just above it.
    for (const r of [row, row + 1]) {
      if (this.water.hasTileAt(col, r)) {
        let top = r;
        while (this.water.hasTileAt(col, top - 1)) top--;
        return top;
      }
    }
    return null;
  }
}
