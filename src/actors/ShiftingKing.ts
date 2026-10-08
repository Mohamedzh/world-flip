// The final boss (spec). He wears a shield of four pieces; each piece breaks only with its own
// element. Every world flip regrows any broken pieces, so all four must break within one flip
// window. With the shield down, weapons hurt him. His attack changes with each flip:
// ground slams in low gravity, ceiling dives upside-down, summoned friends during friend/foe.
import Phaser from 'phaser';
import { BOSS } from '../config';
import { POWER_ICONS } from '../gfx/placeholderTextures';
import { LOOKS } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import type { FlipState } from '../systems/flips';
import { ELEMENTS, type Element } from '../systems/powers';
import type { ActorWorld } from './ActorWorld';
import { onFloor } from './gravity';
import { Walker } from './Walker';

/** What the boss needs from the level beyond what every creature gets. */
export interface BossWorld extends ActorWorld {
  spawnShockwave(x: number, floorY: number, dir: 1 | -1): void;
  summonMinions(near: Point, count: number): void;
}

/** The shield pieces' colors, matching the power icons. */
const SHIELD_COLORS: Record<Element, number> = { fire: 0xff7043, water: 0x4fc3f7, snow: 0xf5fbff, wind: 0x80deea };

type Mode = 'walk' | 'telegraph' | 'attack';

export class ShiftingKing extends Walker {
  readonly displayName = 'The Shifting King';
  /** Shield pieces still standing. */
  private readonly shield = new Set<Element>(ELEMENTS);
  private readonly shieldOrbs = new Map<Element, Phaser.GameObjects.Container>();
  private flipState: FlipState = 'normal';
  private mode: Mode = 'walk';
  private modeUntil: number;
  /** Set while airborne from a slam jump, so landing makes the shockwaves. */
  private slamming = false;
  private orbitAngle = 0;

  constructor(
    scene: Phaser.Scene,
    at: Point,
    private readonly bossWorld: BossWorld,
  ) {
    super(scene, at, bossWorld, {
      look: LOOKS.king,
      health: BOSS.health,
      speed: BOSS.walkSpeed,
      body: { width: 20, height: 20, offsetX: 2, offsetY: 4 },
      tint: 0xb388ff,
      scale: 2,
    });
    this.modeUntil = scene.time.now + BOSS.attackEveryMs;
    for (const e of ELEMENTS) {
      const orb = scene.add.container(this.x, this.y, [
        scene.add.circle(0, 0, 8, 0x10141c, 0.85).setStrokeStyle(2, SHIELD_COLORS[e]),
        scene.add.image(0, 0, POWER_ICONS[e]),
      ]);
      orb.setDepth(4);
      this.shieldOrbs.set(e, orb);
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.shieldOrbs.forEach((o) => o.destroy()));
  }

  get shieldPieces(): Element[] {
    return ELEMENTS.filter((e) => this.shield.has(e));
  }

  get shieldDown(): boolean {
    return this.shield.size === 0;
  }

  /** He never turns calm (during the friend/foe swap he summons friends instead). */
  setCalm(): void {}

  /** He can't be frozen, slowed or pushed: only his shield reacts to powers. */
  freeze(): void {}
  slow(): void {}
  push(): void {}

  /** An element touches the shield. Returns true if that piece broke just now. */
  breakPiece(e: Element): boolean {
    if (!this.shield.delete(e)) return false;
    const orb = this.shieldOrbs.get(e)!;
    this.scene.tweens.add({ targets: orb, scale: 1.8, alpha: 0, duration: 250 });
    return true;
  }

  /** Weapons only hurt him once the shield is down. */
  takeHit(damage: number, fromX: number, now: number): boolean {
    if (!this.shieldDown) return false;
    return super.takeHit(damage, fromX, now);
  }

  /** A flip regrows the whole shield (spec) and changes his attack. */
  onFlip(state: FlipState, now: number): void {
    this.flipState = state;
    for (const e of ELEMENTS) {
      if (this.shield.has(e)) continue;
      this.shield.add(e);
      const orb = this.shieldOrbs.get(e)!;
      orb.setScale(0.2).setAlpha(1);
      this.scene.tweens.add({ targets: orb, scale: 1, duration: 300, ease: 'Back.out' });
    }
    this.mode = 'walk';
    this.slamming = false;
    this.modeUntil = now + BOSS.attackEveryMs * 0.6;
    if (state === 'friendFoe') this.bossWorld.summonMinions({ x: this.x, y: this.y }, BOSS.minions);
  }

  update(time: number): void {
    if (this.isDefeated) return;
    this.updateOrbs(time);
    if (time < this.stunnedUntil) return;
    if (this.slamming && onFloor(this.body, this.gravityDir)) this.landSlam();
    if (time >= this.modeUntil) this.nextMode(time);
    if (this.mode === 'walk') this.walkTowardHero();
    else if (this.mode === 'telegraph') {
      this.body.setVelocityX(0);
      this.setX(this.x + (Math.floor(time / 40) % 2 ? 0.8 : -0.8));
    }
  }

  private walkTowardHero(): void {
    if (!onFloor(this.body, this.gravityDir)) return;
    const toward = this.world.heroPosition().x > this.x ? 1 : -1;
    if (toward !== this.dir) this.turn();
    this.body.setVelocityX(this.dir * BOSS.walkSpeed);
  }

  private nextMode(time: number): void {
    if (this.mode === 'walk') {
      this.mode = 'telegraph';
      this.modeUntil = time + BOSS.telegraphMs;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(120, () => this.active && this.restoreTint());
    } else if (this.mode === 'telegraph') {
      this.mode = 'attack';
      this.attack();
      this.modeUntil = time + 1_200;
    } else {
      this.mode = 'walk';
      this.modeUntil = time + BOSS.attackEveryMs;
    }
  }

  /** The attack depends on the world's current flip. */
  private attack(): void {
    const hero = this.world.heroPosition();
    const toward = hero.x > this.x ? 1 : -1;
    if (toward !== this.dir) this.turn();
    const g = this.gravityDir;
    switch (this.flipState) {
      case 'lowGravity':
        // Ground slam: a big leap, and shockwaves when he lands.
        this.body.setVelocity(toward * 40, -g * BOSS.slamJumpVelocity);
        this.slamming = true;
        break;
      case 'upsideDown':
        // Ceiling dive: push off the ceiling toward the floor (against gravity); gravity pulls him back.
        this.body.setVelocity(toward * 120, -g * BOSS.diveVelocity);
        break;
      default:
        // A hop at the hero.
        this.body.setVelocity(toward * BOSS.hopVelocityX, -g * BOSS.hopVelocityY);
    }
  }

  private landSlam(): void {
    this.slamming = false;
    const floorY = this.gravityDir > 0 ? this.body.bottom : this.body.top;
    this.bossWorld.spawnShockwave(this.x - 14, floorY, -1);
    this.bossWorld.spawnShockwave(this.x + 14, floorY, 1);
    this.scene.cameras.main.shake(200, 0.008);
  }

  /** The shield pieces circle around him. */
  private updateOrbs(time: number): void {
    this.orbitAngle = (time / 900) % (Math.PI * 2);
    const c = this.body.center;
    ELEMENTS.forEach((e, i) => {
      const a = this.orbitAngle + (i * Math.PI) / 2;
      this.shieldOrbs.get(e)!.setPosition(c.x + Math.cos(a) * 26, c.y + Math.sin(a) * 22);
    });
  }
}
