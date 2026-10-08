// Every tuning number for World Flip lives here. Change values here, not in game code.
// Units: pixels, pixels per second, pixels per second squared, milliseconds.

/** Size of one tile in pixels. Matches the Kenney Pixel Platformer art planned for milestone 3. */
export const TILE = 18;

/** The game draws at this size, then scales up to fill the window with crisp pixels. */
export const VIEW = {
  width: 480,
  height: 270,
} as const;

export const PHYSICS = {
  /** Normal downward gravity. A jump peaks at jumpVelocity^2 / (2 * gravity), about 3.4 tiles. */
  gravity: 900,
  /** Fastest the hero can fall, so long falls stay readable and tunneling through tiles can't happen. */
  maxFallSpeed: 420,
} as const;

export const HERO = {
  /** Body size in pixels: narrower than a tile so the hero fits through 1-tile gaps. */
  width: 12,
  height: 16,
  runSpeed: 110,
  /** How fast the hero reaches full speed on the ground and in the air. */
  groundAccel: 1400,
  airAccel: 900,
  /** How fast the hero stops on the ground when no direction is held. */
  groundDecel: 1600,
  jumpVelocity: 330,
  /** Releasing jump early multiplies upward speed by this, giving short hops. */
  jumpCutMultiplier: 0.45,
  /** A jump still works this long after running off a ledge. */
  coyoteMs: 100,
  /** A jump pressed this long before landing still happens on landing. */
  jumpBufferMs: 120,
  maxHearts: 5,
  /** Blinking invulnerability after taking a hit. */
  invulnerableMs: 1500,
  blinkIntervalMs: 100,
} as const;

export const LIVES = {
  /** Lives per attempt at a level. Losing the last one restarts the level, never the whole game. */
  perLevel: 3,
} as const;

export const RESPAWN = {
  /** Pause after dying before the screen fades. */
  deathPauseMs: 450,
  fadeMs: 250,
  /** Protection after a respawn; no world flip may fire during it either (spec: 2 s). */
  graceMs: 2000,
} as const;

export const LEVEL = {
  /** Falling this far below the bottom of the map counts as falling into a pit. */
  fallDeathMargin: TILE * 2,
} as const;

export const CAMERA = {
  lerp: 0.12,
  deadzoneWidth: 60,
  deadzoneHeight: 40,
} as const;

export const COLORS = {
  sky: 0x8fd3ff,
  knight: 0x9aa3ad,
  ranger: 0x4caf50,
  checkpointOff: 0x8a8a8a,
  checkpointOn: 0x7be05a,
  crown: 0xffd23f,
  heart: 0xe8384f,
  heartEmpty: 0x4a2a33,
  /** Opacity of blocks that are currently ghosts (not solid). */
  ghostAlpha: 0.35,
} as const;

export const DEBUG = {
  /** Debug keys (G = physics outlines, N = next checkpoint, H = hurt self) work only in `npm run dev`. */
  enabled: import.meta.env.DEV,
} as const;
