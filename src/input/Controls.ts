// Keyboard controls from the spec. Use power (K) and switch power (L, 1-4) arrive with the powers in milestone 3.
import Phaser from 'phaser';

export interface MoveInput {
  left: boolean;
  right: boolean;
  /** Jump key is being held this frame. */
  jumpHeld: boolean;
  /** Jump key went down this frame. */
  jumpPressed: boolean;
}

export interface AttackInput {
  /** Attack key is being held this frame. */
  attackHeld: boolean;
  /** Attack key went down this frame. */
  attackPressed: boolean;
}

export type PlayerInput = MoveInput & AttackInput;

export class Controls {
  private readonly left: Phaser.Input.Keyboard.Key[];
  private readonly right: Phaser.Input.Keyboard.Key[];
  private readonly jump: Phaser.Input.Keyboard.Key[];
  private readonly attack: Phaser.Input.Keyboard.Key[];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const keys = (...codes: number[]) => codes.map((c) => kb.addKey(c));
    this.left = keys(K.LEFT, K.A);
    this.right = keys(K.RIGHT, K.D);
    // Spec: Space or W. Up arrow is added because players using the arrow keys reach for it.
    this.jump = keys(K.SPACE, K.W, K.UP);
    this.attack = keys(K.J);
  }

  read(): PlayerInput {
    return {
      left: this.left.some((k) => k.isDown),
      right: this.right.some((k) => k.isDown),
      jumpHeld: this.jump.some((k) => k.isDown),
      jumpPressed: justDown(this.jump),
      attackHeld: this.attack.some((k) => k.isDown),
      attackPressed: justDown(this.attack),
    };
  }

  /** Forgets keys held during a pause or respawn, so the hero doesn't act the moment play resumes. */
  reset(): void {
    for (const k of [...this.left, ...this.right, ...this.jump, ...this.attack]) k.reset();
  }
}

/** JustDown is checked on every key (no short-circuit) so each key's pressed flag is consumed. */
function justDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.map((k) => Phaser.Input.Keyboard.JustDown(k)).some(Boolean);
}
