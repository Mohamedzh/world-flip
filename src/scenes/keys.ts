// Names used to look up scenes and loaded assets, kept in one place so scenes don't import each other.

export const SCENES = {
  boot: 'Boot',
  select: 'Select',
  game: 'Game',
  hud: 'Hud',
} as const;

export const ASSETS = {
  tiles: 'placeholder-tiles',
  testLevel: 'test-level',
} as const;
