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
  /** Hitbox in pixels: narrower than a tile so the hero fits through 1-tile-wide gaps. */
  width: 12,
  height: 22,
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
  /** Push-back when hurt; steering is locked for a moment so the push is felt. */
  hurtKnockbackX: 150,
  hurtKnockbackY: 170,
  knockbackLockMs: 220,
  /** How far (px) the hero's feet may sink into a creature and still count as landing on top of it. */
  stompTolerance: 6,
} as const;

export const FLIPS = {
  /**
   * The world flips every 10 s, with a 3 s warning first. The spec said 50 s; play-testing showed
   * that was too long, and quick flips are more exciting.
   */
  intervalMs: 10_000,
  warningMs: 3_000,
  /** Low gravity is 30% of normal: jumps go about 3x higher. */
  lowGravityScale: 0.3,
  lowGravityMaxFallSpeed: 200,
  /** How long the flip's name and tip stay on screen. */
  bannerMs: 2_800,
} as const;

export const SWORD = {
  damage: 2,
  cooldownMs: 350,
  /** About 1.5 tiles in front of the hero. */
  reach: TILE * 1.5,
  height: 26,
  /** How long the swing's arc stays visible. */
  showMs: 120,
} as const;

export const BOW = {
  damage: 1,
  cooldownMs: 500,
  /** Hold attack this long for a charged shot. */
  chargeMs: 800,
  chargedDamage: 2,
  /** A charged arrow passes through this many enemies before stopping. */
  chargedPierce: 1,
  speed: 320,
  /** Arrows fly straight for about 12 tiles, then gravity starts pulling them down. */
  straightRange: TILE * 12,
  maxLifetimeMs: 4_000,
} as const;

/** Power cooldowns from the spec. Charging a weapon uses the same cooldown as casting. */
export const POWERS = {
  cooldownMs: { fire: 3_000, water: 4_000, snow: 5_000, wind: 4_000 },
} as const;

export const FIRE = {
  /** Fireball damage (spec: 3). */
  damage: 3,
  speed: 200,
  /** Fireballs bounce along the floor this high, a few times, then fizzle. */
  bounceVelocity: 230,
  maxBounces: 3,
  lifetimeMs: 2_500,
  /** Knight's flaming swing does this much extra damage (spec: +1). */
  swingBonusDamage: 1,
  /** Delay between neighboring crates catching fire, so the burn visibly spreads. */
  burnSpreadMs: 70,
} as const;

export const WATER = {
  /** The wave rolls forward this fast, for this long (about 10 tiles). */
  speed: 220,
  lifetimeMs: 820,
  /** A wave also waters seed pods up to this far below it, e.g. when cast from a leaf platform. */
  podReachBelow: TILE * 3,
  /** Enemies hit are pushed back about 3 tiles (spec): this speed for this long. */
  pushSpeed: 170,
  pushMs: 380,
  /** Water left across a gap by a wave (the Water-then-Snow combo) dries up after this. */
  puddleMs: 3_000,
} as const;

export const SNOW = {
  /** Snowballs fly straight for about 4 tiles (hitting enemies ahead), then drop, so they can land in water. */
  speed: 200,
  straightRange: TILE * 4,
  lifetimeMs: 2_500,
  /** A frozen enemy is an ice block you can stand on (spec: 4 s). */
  freezeMs: 4_000,
  /** An ice bridge on water lasts 8 s (spec); it blinks for the last part as a warning. */
  iceBridgeMs: 8_000,
  iceWarningMs: 1_500,
  /** Knight's frost swing slows enemies to this fraction of their speed. */
  slowFactor: 0.4,
  slowMs: 3_000,
} as const;

export const WIND = {
  /** The gust's reach in front of the hero, and how hard it throws enemies (off ledges). */
  gustWidth: TILE * 5,
  gustHeight: TILE * 2.5,
  gustPushX: 260,
  gustPushY: 160,
  gustPushMs: 600,
  /** Wind's movement gift (spec): a double jump, then holding jump glides for up to 2 s. */
  doubleJumpVelocity: 300,
  glideMs: 2_000,
  glideFallSpeed: 45,
} as const;

/** Fire walls, put out by Water. They reach from the floor up to the ceiling (at most this many tiles). */
export const FIRE_WALL = {
  maxHeightTiles: 10,
} as const;

export const THROWER = {
  speed: 18,
  /** Throws a pellet this often when the hero is within range and in front. */
  throwEveryMs: 2_400,
  rangeTiles: 11,
  pelletSpeed: 120,
  pelletLifetimeMs: 3_500,
  /** A pellet knocked back by the Knight's swing flies this much faster and hurts enemies. */
  deflectSpeedFactor: 1.6,
  deflectDamage: 2,
} as const;

export const GUARDIAN = {
  /** The Ember Beetle, World 1's guardian. */
  emberBeetle: {
    health: 8,
    walkSpeed: 40,
    chargeSpeed: 170,
    /** Time between charges, the warning shake before one, and how long a charge lasts. */
    chargeEveryMs: 3_200,
    telegraphMs: 650,
    chargeMs: 1_100,
  },
  /** World 2's guardian: crouches as a warning, then leaps at the hero. */
  tideFrog: {
    health: 10,
    walkSpeed: 30,
    hopEveryMs: 2_400,
    telegraphMs: 550,
    hopVelocityY: 360,
    hopVelocityX: 150,
  },
  /** World 3's guardian: flies back and forth, then swoops down at the hero. */
  frostOwl: {
    health: 12,
    cruiseSpeed: 55,
    swoopEveryMs: 3_000,
    telegraphMs: 600,
    swoopSpeed: 190,
    swoopMs: 900,
  },
  /** World 4's guardian: like the owl, but faster and more often. */
  stormHawk: {
    health: 14,
    cruiseSpeed: 80,
    swoopEveryMs: 2_300,
    telegraphMs: 450,
    swoopSpeed: 250,
    swoopMs: 800,
  },
  /** The guardian's health bar shows when the hero is this close. */
  showBarRange: TILE * 16,
} as const;

/** The Shifting King, the final boss (spec). */
export const BOSS = {
  /** Once the shield is down: 10 Knight hits (2 damage) or 20 arrows (1 damage) (spec). */
  health: 20,
  walkSpeed: 45,
  /** An attack every few seconds, always after a warning shake. */
  attackEveryMs: 2_600,
  telegraphMs: 600,
  /** Normal / color swap: a hop toward the hero. */
  hopVelocityX: 140,
  hopVelocityY: 300,
  /** Low gravity: a big jump, then a slam that sends shockwaves along the floor both ways. */
  slamJumpVelocity: 380,
  shockwaveSpeed: 170,
  shockwaveLifetimeMs: 2_200,
  /** Upside-down: he hangs from the ceiling and dives at the hero. */
  diveVelocity: 420,
  /** Friend/foe swap: he summons two hostile mushrooms (they vanish at the next flip). */
  minions: 2,
  /** Contact and shockwaves cost this many hearts. */
  touchDamage: 1,
} as const;

export const SAVE = {
  storageKey: 'world-flip-save-v1',
} as const;

export const ENEMY = {
  /** Health points. A sword hit (2) defeats a basic enemy, an arrow (1) takes two. */
  walkerHealth: 2,
  walkerSpeed: 35,
  hitKnockback: 90,
  hitFlashMs: 90,
  /** Bounce when landing on a harmless enemy during the friend/foe swap. */
  calmBounceVelocity: 260,
} as const;

export const FRIEND = {
  /** A friendly mushroom launches the hero about 8 tiles up. */
  mushroomBounceVelocity: 520,
  hostileHopVelocity: 200,
  hostileHopIntervalMs: 1_100,
  /** Hostile friends can only be stunned, never defeated (spec). */
  stunMs: 3_000,
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
  enemy: 0xe04848,
  enemyCalm: 0xc58bd6,
  friend: 0xffd23f,
  friendHostile: 0xff8a3d,
  stunned: 0x9a9a9a,
  arrow: 0x7a5230,
  /** Tint for a checkpoint flag not yet reached. */
  checkpointOff: 0x8a8a8a,
  crown: 0xffd23f,
  heart: 0xe8384f,
  /** Opacity of blocks that are currently ghosts (not solid). */
  ghostAlpha: 0.35,
} as const;

export const DEBUG = {
  /** Debug keys (F flip now, G physics outlines, N next checkpoint, H hurt self, P get Fire) work only in `npm run dev`. */
  enabled: import.meta.env.DEV,
} as const;
