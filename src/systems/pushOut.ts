// Spec: "A hero inside a block that turns solid is pushed to the nearest free tile, never crushed."
// Plain TypeScript so it can be unit tested.

/** Axis-aligned box, top-left corner plus size, in pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Whether the tile at (col, row) is solid. The caller decides what counts outside the map. */
export type SolidAt = (col: number, row: number) => boolean;

export function overlapsSolid(rect: Rect, tile: number, isSolid: SolidAt): boolean {
  // The small epsilon stops a box that only touches a tile edge from counting as inside it.
  const eps = 0.001;
  const c0 = Math.floor(rect.x / tile);
  const c1 = Math.floor((rect.x + rect.width - eps) / tile);
  const r0 = Math.floor(rect.y / tile);
  const r1 = Math.floor((rect.y + rect.height - eps) / tile);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) if (isSolid(c, r)) return true;
  }
  return false;
}

/**
 * Finds the nearest spot where `rect` overlaps nothing solid, trying a position standing on the
 * floor of each nearby tile. Returns the new top-left corner, or null if nothing is free in range.
 * A spot with nothing solid underfoot counts as one tile further away, so the hero is put on solid
 * footing rather than over a pit, unless a mid-air spot is much closer. Ties go to the spot higher up.
 * With gravity -1 (upside-down) "floor", "underfoot" and "up" are all mirrored.
 */
export function findFreeSpot(
  rect: Rect,
  tile: number,
  isSolid: SolidAt,
  maxRadius = 4,
  gravity: 1 | -1 = 1,
): { x: number; y: number } | null {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const col = Math.floor(cx / tile);
  const row = Math.floor(cy / tile);
  let best: { x: number; y: number; dist: number } | null = null;

  for (let dr = -maxRadius; dr <= maxRadius; dr++) {
    for (let dc = -maxRadius; dc <= maxRadius; dc++) {
      const x = (col + dc) * tile + (tile - rect.width) / 2;
      // Stand on the bottom of the tile, or hang from its top when gravity is reversed.
      const y = gravity > 0 ? (row + dr + 1) * tile - rect.height : (row + dr) * tile;
      if (overlapsSolid({ x, y, width: rect.width, height: rect.height }, tile, isSolid)) continue;
      const supported = isSolid(col + dc, row + dr + gravity);
      const dist = Math.hypot(x + rect.width / 2 - cx, y + rect.height / 2 - cy) + (supported ? 0 : tile);
      const higherUp = best !== null && (gravity > 0 ? y < best.y : y > best.y);
      if (!best || dist < best.dist - 0.001 || (Math.abs(dist - best.dist) <= 0.001 && higherUp)) {
        best = { x, y, dist };
      }
    }
  }
  return best && { x: best.x, y: best.y };
}
