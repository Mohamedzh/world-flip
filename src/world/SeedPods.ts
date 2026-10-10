// Seed pods: Water grows each one into a trunk topped by a solid leaf platform (spec).
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { TILE } from '../config';
import { SHEETS, TILE_FRAMES } from '../gfx/sprites';
import type { SeedPodSpawn } from '../level/LevelData';
import { StatusMarker } from '../actors/StatusMarker';
import { TEXTURES } from '../gfx/placeholderTextures';

/** Leaf platforms are this many tiles wide, centered on the pod. */
const LEAF_WIDTH = 5;

export class SeedPod extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  grown = false;
  /** A water drop over the pod: a hint that Water makes it grow. */
  readonly marker: StatusMarker;

  constructor(
    scene: Phaser.Scene,
    readonly spawn: SeedPodSpawn,
  ) {
    super(scene, spawn.x, spawn.y, SHEETS.tiles, TILE_FRAMES.seedPod);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setOrigin(0.5, 1);
    (this.body as unknown as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    this.marker = new StatusMarker(this, TEXTURES.markDrop);
    this.marker.visible = true;
    // A gentle wobble so kids notice it.
    scene.tweens.add({ targets: this, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 700 });
  }
}

export class SeedPods {
  readonly group: Phaser.Physics.Arcade.StaticGroup;
  private readonly trunks: Phaser.Tilemaps.TilemapLayer;
  private readonly leaves: Phaser.Tilemaps.TilemapLayer;
  private readonly kenneyGid: number;

  constructor(
    private readonly scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    tilesets: Phaser.Tilemaps.Tileset[],
    spawns: SeedPodSpawn[],
    /** Whether a tile is already solid, so growth never fills a wall. */
    private readonly isOtherSolid: (col: number, row: number) => boolean,
    /** Called after a pod grows, e.g. to push anyone out of the new platform. */
    private readonly onGrow: () => void,
  ) {
    this.trunks = map.createBlankLayer('trunks', tilesets)!.setDepth(-1);
    this.leaves = map.createBlankLayer('leaves', tilesets)!;
    this.kenneyGid = tilesets[0].firstgid;
    this.group = scene.physics.add.staticGroup();
    for (const s of spawns) this.group.add(new SeedPod(scene, s));
  }

  /** The leaf platforms are solid; colliders use this layer. */
  get leafLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.leaves;
  }

  isSolidTile(col: number, row: number): boolean {
    return this.leaves.hasTileAt(col, row);
  }

  /** Grows every pod overlapping the box. */
  waterArea(area: Phaser.Geom.Rectangle): void {
    for (const pod of this.group.getChildren() as SeedPod[]) {
      if (!pod.grown && Phaser.Geom.Intersects.RectangleToRectangle(area, pod.getBounds())) this.grow(pod);
    }
  }

  /** Grows every pod in the column band x1..x2 whose base is between top and bottom (world pixels). */
  waterColumn(x1: number, x2: number, top: number, bottom: number): void {
    for (const pod of this.group.getChildren() as SeedPod[]) {
      if (!pod.grown && pod.x >= x1 && pod.x <= x2 && pod.y >= top && pod.y <= bottom) this.grow(pod);
    }
  }

  grow(pod: SeedPod): void {
    if (pod.grown) return;
    pod.grown = true;
    pod.marker.visible = false;
    sfx.grow();
    const col = Math.floor(pod.spawn.x / TILE);
    const baseRow = Math.round(pod.spawn.y / TILE) - 1; // the tile the pod sits in
    const topRow = baseRow - (pod.spawn.height - 1);
    const k = (frame: number) => this.kenneyGid + frame;
    // The trunk rises one tile at a time, then the leaves open on top.
    for (let r = baseRow; r > topRow; r--) {
      const step = baseRow - r;
      this.scene.time.delayedCall(step * 90, () => {
        if (!this.isOtherSolid(col, r)) this.trunks.putTileAt(k(TILE_FRAMES.trunk), col, r);
      });
    }
    this.scene.time.delayedCall((baseRow - topRow) * 90, () => {
      const half = Math.floor(LEAF_WIDTH / 2);
      for (let dc = -half; dc <= half; dc++) {
        const c = col + dc;
        if (this.isOtherSolid(c, topRow)) continue;
        const frame = dc === -half ? TILE_FRAMES.leafLeft : dc === half ? TILE_FRAMES.leafRight : TILE_FRAMES.leaf;
        this.leaves.putTileAt(k(frame), c, topRow).setCollision(true);
      }
      this.onGrow();
    });
    this.scene.tweens.add({ targets: pod, scale: 1.4, alpha: 0, duration: 300, onComplete: () => pod.destroy() });
  }
}
