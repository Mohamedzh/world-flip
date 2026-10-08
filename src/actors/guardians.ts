// The four guardians, one per world. Each drops its world's power when defeated (spec).
// All of them warn before they attack (a shake or flash), so attacks are always fair.
import Phaser from 'phaser';
import { GUARDIAN, TILE } from '../config';
import { LOOKS } from '../gfx/sprites';
import { GUARDIANS, type GuardianKind } from '../level/LevelData';
import type { Point } from '../systems/CheckpointTracker';
import type { ActorWorld } from './ActorWorld';
import { onFloor } from './gravity';
import { Walker, type WalkerStyle } from './Walker';

type Mode = 'walk' | 'telegraph' | 'attack';

export abstract class Guardian extends Walker {
  abstract readonly guardianKind: GuardianKind;
  protected mode: Mode = 'walk';
  protected modeUntil: number;
  /** Where it last stood on solid ground, so a power can drop at a pit's edge (spec). */
  private lastGround: Point;

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld, style: WalkerStyle, firstAttackMs: number) {
    super(scene, at, world, style);
    this.lastGround = { ...at };
    this.modeUntil = scene.time.now + firstAttackMs;
  }

  get displayName(): string {
    return GUARDIANS[this.guardianKind].name;
  }

  get pitEdge(): Point {
    return this.lastGround;
  }

  update(time: number): void {
    if (this.isDefeated) return;
    if (onFloor(this.body, this.gravityDir)) this.lastGround = { x: this.x, y: this.body.bottom };
    if (this.updateFrozen(time) || time < this.stunnedUntil) return;
    // A calm guardian (friend/foe swap) just wanders.
    if (this.calm) {
      this.mode = 'walk';
      this.wander(time);
      return;
    }
    if (time >= this.modeUntil) this.nextMode(time);
    if (this.mode === 'walk') this.wander(time);
    else if (this.mode === 'telegraph') this.telegraph(time);
    else this.attack(time);
  }

  /** Moving around between attacks. */
  protected wander(time: number): void {
    this.patrol(this.currentSpeed(time, this.style.speed));
  }

  /** The warning before an attack: stand still and shake. */
  protected telegraph(time: number): void {
    this.body.setVelocityX(0);
    this.setX(this.x + (Math.floor(time / 40) % 2 ? 0.6 : -0.6));
  }

  protected abstract attack(time: number): void;
  protected abstract startAttack(time: number): number;
  protected abstract readonly timing: { everyMs: number; telegraphMs: number };

  private nextMode(time: number): void {
    if (this.mode === 'walk') {
      this.mode = 'telegraph';
      this.modeUntil = time + this.timing.telegraphMs;
      this.anims.pause();
    } else if (this.mode === 'telegraph') {
      this.mode = 'attack';
      this.anims.resume();
      this.modeUntil = time + this.startAttack(time);
    } else {
      this.endAttack();
      this.mode = 'walk';
      this.modeUntil = time + this.timing.everyMs;
    }
  }

  protected endAttack(): void {
    this.anims.timeScale = 1;
  }

  protected faceHero(): 1 | -1 {
    const toward = this.world.heroPosition().x > this.x ? 1 : -1;
    if (toward !== this.dir) this.turn();
    return toward;
  }
}

const BEETLE = GUARDIAN.emberBeetle;

/** World 1: patrols its arena, shakes, then charges. A charge can carry it into a pit. */
export class EmberBeetle extends Guardian {
  readonly guardianKind = 'emberBeetle';
  protected readonly timing = { everyMs: BEETLE.chargeEveryMs, telegraphMs: BEETLE.telegraphMs };

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld) {
    super(
      scene,
      at,
      world,
      {
        look: LOOKS.emberBeetle,
        health: BEETLE.health,
        speed: BEETLE.walkSpeed,
        body: { width: 20, height: 16, offsetX: 2, offsetY: 8 },
        tint: 0xff8a50,
      },
      BEETLE.chargeEveryMs,
    );
  }

  protected startAttack(): number {
    this.faceHero();
    this.anims.timeScale = 3;
    return BEETLE.chargeMs;
  }

  protected attack(time: number): void {
    // A charge doesn't stop at ledges; it does stop at walls.
    if ((this.dir < 0 && this.body.blocked.left) || (this.dir > 0 && this.body.blocked.right)) {
      this.modeUntil = time;
      this.turn();
    }
    this.body.setVelocityX(this.dir * BEETLE.chargeSpeed);
  }
}

const FROG = GUARDIAN.tideFrog;

/** World 2: crouches, then leaps at the hero. */
export class TideFrog extends Guardian {
  readonly guardianKind = 'tideFrog';
  protected readonly timing = { everyMs: FROG.hopEveryMs, telegraphMs: FROG.telegraphMs };

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld) {
    super(
      scene,
      at,
      world,
      {
        look: LOOKS.tideFrog,
        health: FROG.health,
        speed: FROG.walkSpeed,
        body: { width: 14, height: 14, offsetX: 5, offsetY: 10 },
        tint: 0x4dd0c8,
        scale: 1.5,
      },
      FROG.hopEveryMs,
    );
  }

  protected telegraph(time: number): void {
    super.telegraph(time);
    this.setScale(1.65, 1.3); // crouch
  }

  protected startAttack(): number {
    this.setScale(1.5);
    const dir = this.faceHero();
    this.body.setVelocity(dir * FROG.hopVelocityX, -this.gravityDir * FROG.hopVelocityY);
    return 1_200;
  }

  protected attack(time: number): void {
    // The leap is over once it lands again.
    if (time > this.modeUntil - 1_000 && onFloor(this.body, this.gravityDir)) this.modeUntil = time;
  }
}

/** Shared behavior of the two flying guardians: cruise back and forth, then swoop at the hero. */
abstract class Flyer extends Guardian {
  private readonly home: Point;
  private swoopVelocity = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    at: Point,
    world: ActorWorld,
    style: WalkerStyle,
    private readonly stats: { cruiseSpeed: number; swoopSpeed: number; swoopMs: number; swoopEveryMs: number },
  ) {
    super(scene, at, world, style, stats.swoopEveryMs);
    this.home = { ...at };
    // Flyers ignore gravity, including the upside-down flip.
    this.body.setAllowGravity(false);
  }

  setGravityDir(): void {}

  protected wander(): void {
    // Cruise between 6 tiles either side of home, drifting back to home height.
    const range = TILE * 6;
    if (this.x < this.home.x - range && this.dir < 0) this.turn();
    if (this.x > this.home.x + range && this.dir > 0) this.turn();
    if (this.body.blocked.left || this.body.blocked.right) this.turn();
    const dy = this.home.y - this.y;
    this.body.setVelocity(this.dir * this.stats.cruiseSpeed, Phaser.Math.Clamp(dy * 2, -80, 80));
  }

  protected telegraph(time: number): void {
    this.body.setVelocity(0, 0);
    this.setAlpha(Math.floor(time / 80) % 2 ? 0.5 : 1);
  }

  protected startAttack(): number {
    this.setAlpha(1);
    this.faceHero();
    const hero = this.world.heroPosition();
    this.swoopVelocity
      .set(hero.x - this.x, hero.y - this.y)
      .normalize()
      .scale(this.stats.swoopSpeed);
    return this.stats.swoopMs;
  }

  protected attack(): void {
    this.body.setVelocity(this.swoopVelocity.x, this.swoopVelocity.y);
  }

  protected endAttack(): void {
    super.endAttack();
    this.setAlpha(1);
  }
}

/** World 3. */
export class FrostOwl extends Flyer {
  readonly guardianKind = 'frostOwl';
  protected readonly timing = { everyMs: GUARDIAN.frostOwl.swoopEveryMs, telegraphMs: GUARDIAN.frostOwl.telegraphMs };

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld) {
    super(
      scene,
      at,
      world,
      {
        look: LOOKS.flyer,
        health: GUARDIAN.frostOwl.health,
        speed: GUARDIAN.frostOwl.cruiseSpeed,
        body: { width: 16, height: 14, offsetX: 4, offsetY: 6 },
        tint: 0xb3e5fc,
        scale: 1.4,
      },
      GUARDIAN.frostOwl,
    );
  }
}

/** World 4. */
export class StormHawk extends Flyer {
  readonly guardianKind = 'stormHawk';
  protected readonly timing = { everyMs: GUARDIAN.stormHawk.swoopEveryMs, telegraphMs: GUARDIAN.stormHawk.telegraphMs };

  constructor(scene: Phaser.Scene, at: Point, world: ActorWorld) {
    super(
      scene,
      at,
      world,
      {
        look: LOOKS.flyer,
        health: GUARDIAN.stormHawk.health,
        speed: GUARDIAN.stormHawk.cruiseSpeed,
        body: { width: 16, height: 14, offsetX: 4, offsetY: 6 },
        tint: 0xffe082,
        scale: 1.6,
      },
      GUARDIAN.stormHawk,
    );
  }
}

export function createGuardian(kind: GuardianKind, scene: Phaser.Scene, at: Point, world: ActorWorld): Guardian {
  switch (kind) {
    case 'emberBeetle':
      return new EmberBeetle(scene, at, world);
    case 'tideFrog':
      return new TideFrog(scene, at, world);
    case 'frostOwl':
      return new FrostOwl(scene, at, world);
    case 'stormHawk':
      return new StormHawk(scene, at, world);
  }
}
