// The final boss (spec). He wears a shield of four pieces; each piece breaks only with its own
// element, and broken pieces stay broken. Breaking the last one costs him a third of his health and
// leaves him dizzy for a few seconds: harmless, and weapons hurt him. Then the whole shield grows back.
// His attack changes with each flip (ground slams in low gravity, ceiling dives upside-down, summoned
// friends during friend/foe), and before each attack he stops and glows that attack's color.
import Phaser from 'phaser';
import { BOSS } from '../config';
import { POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
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

/** The glow before each attack: orange for the slam, purple for the ceiling dive, yellow for a hop. */
const TELEGRAPH_COLORS: Partial<Record<FlipState, number>> = { lowGravity: 0xff7043, upsideDown: 0xb388ff };
const HOP_COLOR = 0xfff176;

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
  /** While dizzy (shield broken): no attacks, harmless, and weapons hurt him. 0 = not dizzy. */
  private dizzyUntil = 0;
  private readonly dizzyStars: Phaser.GameObjects.Image[];

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
    this.dizzyStars = [0, 1, 2].map(() => scene.add.image(this.x, this.y, TEXTURES.starFull).setDepth(4).setVisible(false));
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.shieldOrbs.forEach((o) => o.destroy());
      this.dizzyStars.forEach((st) => st.destroy());
    });
  }

  get shieldPieces(): Element[] {
    return ELEMENTS.filter((e) => this.shield.has(e));
  }

  get shieldDown(): boolean {
    return this.shield.size === 0;
  }

  isDizzy(now: number): boolean {
    return now < this.dizzyUntil;
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

  /**
   * The last shield piece broke: he loses a third of his health and goes dizzy.
   * Returns true if that defeated him.
   */
  stagger(now: number): boolean {
    this.health -= BOSS.shieldBreakDamage;
    if (this.health <= 0) {
      this.defeat();
      return true;
    }
    this.dizzyUntil = now + BOSS.dizzyMs;
    this.mode = 'walk';
    this.slamming = false;
    this.body.setVelocityX(0);
    this.restoreTint();
    this.dizzyStars.forEach((st) => st.setVisible(true));
    return false;
  }

  /** Weapons only hurt him while he's dizzy. */
  takeHit(damage: number, fromX: number, now: number): boolean {
    if (!this.isDizzy(now)) return false;
    return super.takeHit(damage, fromX, now);
  }

  /** A flip changes his attack (broken shield pieces stay broken). */
  onFlip(state: FlipState, now: number): void {
    this.flipState = state;
    if (this.isDizzy(now)) return;
    this.mode = 'walk';
    this.slamming = false;
    this.modeUntil = now + BOSS.attackEveryMs * 0.6;
    if (state === 'friendFoe') this.bossWorld.summonMinions({ x: this.x, y: this.y }, BOSS.minions);
  }

  update(time: number): void {
    if (this.isDefeated) return;
    this.updateOrbs(time);
    if (this.dizzyUntil > 0) {
      if (time < this.dizzyUntil) {
        this.updateDizzy(time);
        return;
      }
      this.recover(time);
    }
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

  /** Sways in place with stars circling his head. */
  private updateDizzy(time: number): void {
    this.body.setVelocityX(0);
    this.setAngle(Math.sin(time / 120) * 8);
    const c = this.body.center;
    const top = this.gravityDir > 0 ? this.body.top - 8 : this.body.bottom + 8;
    this.dizzyStars.forEach((st, i) => {
      const a = time / 250 + (i * Math.PI * 2) / 3;
      st.setPosition(c.x + Math.cos(a) * 14, top + Math.sin(a) * 4).setScale(0.6);
    });
  }

  /** Dizziness wears off: the whole shield grows back. */
  private recover(time: number): void {
    this.dizzyUntil = 0;
    this.setAngle(0);
    this.dizzyStars.forEach((st) => st.setVisible(false));
    for (const e of ELEMENTS) {
      this.shield.add(e);
      const orb = this.shieldOrbs.get(e)!;
      orb.setScale(0.2).setAlpha(1);
      this.scene.tweens.add({ targets: orb, scale: 1, duration: 300, ease: 'Back.out' });
    }
    this.mode = 'walk';
    this.modeUntil = time + BOSS.attackEveryMs * 0.6;
  }

  private nextMode(time: number): void {
    if (this.mode === 'walk') {
      this.mode = 'telegraph';
      this.modeUntil = time + BOSS.telegraphMs;
      // Glow (blinking) in the color of the coming attack.
      const color = TELEGRAPH_COLORS[this.flipState] ?? HOP_COLOR;
      for (let i = 0; i < BOSS.telegraphMs / 200; i++) {
        this.scene.time.delayedCall(i * 200, () => this.active && this.mode === 'telegraph' && this.setTintFill(color));
        this.scene.time.delayedCall(i * 200 + 120, () => this.active && this.restoreTint());
      }
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
