// The world states and the rules each one sets. Plain TypeScript so it can be unit tested.

export const FLIP_STATES = ['normal', 'lowGravity', 'colorSwap', 'friendFoe', 'upsideDown'] as const;
export type FlipState = (typeof FLIP_STATES)[number];

export function isFlipState(value: string): value is FlipState {
  return (FLIP_STATES as readonly string[]).includes(value);
}

/** Names and one-line tips shown to the player when a flip happens. */
export const FLIP_INFO: Record<FlipState, { label: string; tip: string }> = {
  normal: { label: 'Normal', tip: 'Everything is back to normal' },
  lowGravity: { label: 'Low gravity', tip: 'Jump super high!' },
  colorSwap: { label: 'Color swap', tip: 'Blue is solid, orange is a ghost!' },
  friendFoe: { label: 'Friend/foe swap', tip: 'Enemies are harmless, mushrooms bite!' },
  upsideDown: { label: 'Upside-down', tip: 'Walk on the ceiling!' },
};

/** 1 = gravity pulls down, -1 = gravity pulls up (upside-down flip). */
export type GravityDir = 1 | -1;

/** Everything a world state changes. Only one flip is active at a time, so each state sets all of them. */
export interface WorldRules {
  gravityScale: number;
  gravityDir: GravityDir;
  /** Normal: orange blocks solid, blue blocks ghosts. Swapped: the reverse. */
  colorsSwapped: boolean;
  /** Friend/foe swap: friends hostile, enemies harmless. */
  friendsHostile: boolean;
}

export function rulesFor(state: FlipState, lowGravityScale: number): WorldRules {
  return {
    gravityScale: state === 'lowGravity' ? lowGravityScale : 1,
    gravityDir: state === 'upsideDown' ? -1 : 1,
    colorsSwapped: state === 'colorSwap',
    friendsHostile: state === 'friendFoe',
  };
}
