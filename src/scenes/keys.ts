// Names used to look up scenes and loaded assets, kept in one place so scenes don't import each other.

export const SCENES = {
  boot: 'Boot',
  map: 'Map',
  select: 'Select',
  game: 'Game',
  hud: 'Hud',
} as const;

export const ASSETS = {
  /** Our own orange/blue block tiles (Kenney sheets are in gfx/sprites.ts; levels load under their id). */
  blockTiles: 'placeholder-tiles',
} as const;
