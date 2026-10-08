// One playable level: tiles, hero, creatures, checkpoints, pits, the crown, world flips and combat.
import Phaser from 'phaser';
import { Mushroom } from '../actors/Mushroom';
import { Walker } from '../actors/Walker';
import { sfx } from '../audio/sfx';
import { CAMERA, COLORS, DEBUG, ENEMY, FLIPS, FRIEND, HERO, LEVEL, LIVES, PHYSICS, RESPAWN, TILE } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { Hero, HeroKind } from '../hero/Hero';
import { createHero } from '../hero/heroes';
import { Controls } from '../input/Controls';
import { parseLevel, TILE_LAYERS, TILESET_NAME, type LevelData, type TiledMap } from '../level/LevelData';
import { CheckpointTracker, type Point } from '../systems/CheckpointTracker';
import { touchEffect, weaponHitEffect, type HitEffect } from '../systems/combat';
import { FlipManager } from '../systems/FlipManager';
import { FLIP_INFO, rulesFor, type FlipState, type WorldRules } from '../systems/flips';
import { HeroVitals } from '../systems/HeroVitals';
import { formatTime } from '../systems/math';
import { findFreeSpot, overlapsSolid } from '../systems/pushOut';
import { Arrow } from '../weapons/Arrow';
import type { CombatWorld } from '../weapons/Weapon';
import { ColorBlocks } from '../world/ColorBlocks';
import { ASSETS, SCENES } from './keys';

export type PlayState = 'playing' | 'paused' | 'dying' | 'won';

type Creature = Walker | Mushroom;

export interface GameSceneData {
  hero?: HeroKind;
  /** A message to show as the level starts, e.g. after running out of lives. */
  banner?: string;
}

/** Everything the HUD shows, read by the HUD every frame. */
export interface HudState {
  heroKind: HeroKind;
  hearts: number;
  maxHearts: number;
  lives: number;
  elapsedMs: number;
  playState: PlayState;
  banner: string | null;
  flip: { state: FlipState; next: FlipState; msUntilFlip: number; warning: boolean };
}

export class GameScene extends Phaser.Scene implements CombatWorld {
  private heroKind: HeroKind = 'knight';
  private hero!: Hero;
  private controls!: Controls;
  private vitals!: HeroVitals;
  private checkpoints!: CheckpointTracker;
  private flips!: FlipManager;
  private rules!: WorldRules;
  private level!: LevelData;
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private colorBlocks!: ColorBlocks;
  private enemies!: Phaser.Physics.Arcade.Group;
  private mushrooms!: Phaser.Physics.Arcade.Group;
  private arrows!: Phaser.Physics.Arcade.Group;
  private checkpointFlags: Phaser.Physics.Arcade.Image[] = [];
  private mapCols = 0;
  private mapRows = 0;
  private playState: PlayState = 'playing';
  private elapsedMs = 0;
  private banner: { text: string; untilMs: number } | null = null;

  constructor() {
    super(SCENES.game);
  }

  get hudState(): HudState {
    const showBanner = this.banner && this.time.now < this.banner.untilMs;
    return {
      heroKind: this.heroKind,
      hearts: this.vitals.hearts,
      maxHearts: this.vitals.maxHearts,
      lives: this.vitals.lives,
      elapsedMs: this.elapsedMs,
      playState: this.playState,
      banner: showBanner ? this.banner!.text : null,
      flip: {
        state: this.flips.state,
        next: this.flips.next,
        msUntilFlip: this.flips.msUntilFlip,
        warning: this.flips.warningActive,
      },
    };
  }

  create(data: GameSceneData): void {
    this.heroKind = data.hero ?? this.heroKind;
    this.playState = 'playing';
    this.elapsedMs = 0;
    this.banner = null;
    this.checkpointFlags = [];
    // The physics world survives a scene restart, so undo anything a previous run left behind.
    this.physics.resume();

    this.buildLevel();
    this.vitals = new HeroVitals({ maxHearts: HERO.maxHearts, lives: LIVES.perLevel, invulnerableMs: HERO.invulnerableMs });
    this.checkpoints = new CheckpointTracker(this.level.spawn, this.level.checkpoints);
    this.hero = createHero(this.heroKind, this, this.level.spawn, this);
    this.controls = new Controls(this);
    this.spawnCreatures();
    this.arrows = this.memberGroup();
    this.addColliders();
    this.setUpCamera();

    this.flips = new FlipManager(this.level.flipOrder, FLIPS);
    this.flips.onWarning(() => sfx.warningChime());
    this.flips.onChanged(({ to }) => this.onFlip(to));
    this.applyRules('normal');

    this.setUpKeys();
    this.vitals.grantInvulnerability(this.time.now, RESPAWN.graceMs);
    if (data.banner) this.showBanner(data.banner, 2500);
    if (!this.scene.isActive(SCENES.hud)) this.scene.launch(SCENES.hud);
  }

  update(_time: number, delta: number): void {
    if (this.playState !== 'playing') return;
    const now = this.time.now;
    this.elapsedMs += delta;
    this.flips.update(delta);
    if (this.playState !== 'playing') return;
    this.hero.update(this.controls.read(), delta, now);
    this.hero.showInvulnerable(this.vitals.isInvulnerable(now), now);
    this.removeFallenCreatures();
    if (this.hero.y > this.mapRows * TILE + LEVEL.fallDeathMargin) this.die();
  }

  // ---- CombatWorld: used by the heroes' weapons ----

  strike(area: Phaser.Geom.Rectangle, damage: number, fromX: number): void {
    for (const c of this.creatures()) {
      const b = c.body;
      if (!b.enable) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) {
        this.weaponHit(c, damage, fromX);
      }
    }
  }

  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean): void {
    this.arrows.add(new Arrow(this, x, y, dir, charged));
  }

  /** Costs hearts, e.g. from a creature's touch. */
  hurtHero(amount = 1, fromX?: number): void {
    if (this.playState !== 'playing') return;
    const result = this.vitals.takeHit(this.time.now, amount);
    if (result === 'ignored') return;
    sfx.hurt();
    if (fromX !== undefined) this.hero.knockback(Math.sign(this.hero.x - fromX));
    if (result === 'dead') this.die();
  }

  // ---- Level setup ----

  private buildLevel(): void {
    // The raw Tiled JSON gives the objects and flip order; Phaser builds the tile layers.
    this.level = parseLevel(this.cache.tilemap.get(ASSETS.testLevel).data as TiledMap);
    const map = this.make.tilemap({ key: ASSETS.testLevel });
    const tiles = map.addTilesetImage(TILESET_NAME, ASSETS.tiles);
    if (!tiles) throw new Error(`Tileset "${TILESET_NAME}" not found in the level file`);
    const blue = map.createLayer(TILE_LAYERS.blue, tiles)!;
    this.ground = map.createLayer(TILE_LAYERS.ground, tiles)!;
    const orange = map.createLayer(TILE_LAYERS.orange, tiles)!;
    this.ground.setCollisionByExclusion([-1]);
    this.colorBlocks = new ColorBlocks(orange, blue);
    this.mapCols = map.width;
    this.mapRows = map.height;

    // Closed at the top (low-gravity jumps bump the ceiling), open at the bottom so pits work.
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels + LEVEL.fallDeathMargin * 4);
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.checkpointFlags = this.level.checkpoints.map((p) => this.staticSprite(p, TEXTURES.checkpointOff));
  }

  private spawnCreatures(): void {
    this.enemies = this.memberGroup();
    this.mushrooms = this.memberGroup();
    const solidAt = (x: number, y: number) => this.isSolidAt(x, y);
    for (const p of this.level.enemies) this.enemies.add(new Walker(this, p, solidAt));
    for (const p of this.level.mushrooms) this.mushrooms.add(new Mushroom(this, p));
  }

  /** A physics group whose members set up their own bodies and get update() called every frame. */
  private memberGroup(): Phaser.Physics.Arcade.Group {
    const group = this.physics.add.group({ runChildUpdate: true });
    // Without this, adding a member would reset its body (velocity, gravity, bounds) to the group defaults.
    group.defaults = {} as Phaser.Types.Physics.Arcade.PhysicsGroupDefaults;
    return group;
  }

  private addColliders(): void {
    const solids = [this.ground, ...this.colorBlocks.layers];
    this.physics.add.collider(this.hero, solids);
    this.physics.add.collider([this.enemies, this.mushrooms], solids);
    // Arrows stop on solid blocks and fly through ghost blocks, since ghosts have no collision.
    this.physics.add.collider(this.arrows, solids, (arrow) => (arrow as Arrow).destroy());

    this.physics.add.overlap(this.hero, [this.enemies, this.mushrooms], (_h, c) => this.heroTouches(c as Creature));
    this.physics.add.overlap(this.arrows, [this.enemies, this.mushrooms], (a, c) =>
      this.arrowHits(a as Arrow, c as Creature),
    );

    this.checkpointFlags.forEach((flag, i) => this.physics.add.overlap(this.hero, flag, () => this.touchCheckpoint(i)));
    const crown = this.staticSprite(this.level.crown, TEXTURES.crown);
    this.tweens.add({ targets: crown, y: crown.y - 3, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.physics.add.overlap(this.hero, crown, () => this.reachCrown());
  }

  private setUpCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(COLORS.sky);
    cam.setBounds(0, 0, this.mapCols * TILE, this.mapRows * TILE);
    cam.startFollow(this.hero, true, CAMERA.lerp, CAMERA.lerp);
    cam.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);
  }

  private setUpKeys(): void {
    const kb = this.input.keyboard!;
    // Listeners would pile up across restarts otherwise.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-ENTER', () => {
      if (this.playState !== 'won') return;
      this.scene.stop(SCENES.hud);
      this.scene.start(SCENES.select);
    });
    if (DEBUG.enabled) this.addDebugKeys(kb);
  }

  private staticSprite(at: Point, texture: string): Phaser.Physics.Arcade.Image {
    // Origin at the bottom so the sprite stands on the floor point; the static body must be refreshed after.
    return this.physics.add.staticImage(at.x, at.y, texture).setOrigin(0.5, 1).refreshBody();
  }

  // ---- World flips ----

  private onFlip(to: FlipState): void {
    this.applyRules(to);
    this.cameras.main.flash(250, 255, 255, 255);
    sfx.flip();
    const info = FLIP_INFO[to];
    this.showBanner(`${info.label}!\n${info.tip}`, FLIPS.bannerMs);
  }

  /** The only place world rules change. A flip keeps everyone's velocity; only the physics changes. */
  private applyRules(state: FlipState): void {
    this.rules = rulesFor(state, FLIPS.lowGravityScale);
    this.physics.world.gravity.y = PHYSICS.gravity * this.rules.gravityScale;
    this.hero.setMaxFallSpeed(this.rules.gravityScale < 1 ? FLIPS.lowGravityMaxFallSpeed : PHYSICS.maxFallSpeed);
    if (this.colorBlocks.apply(this.rules.colorsSwapped)) this.pushOutOfSolids();
    const now = this.time.now;
    for (const e of this.walkers()) e.setCalm(this.rules.friendsHostile);
    for (const m of this.mushroomList()) {
      if (m.isHostile !== this.rules.friendsHostile) m.setHostile(this.rules.friendsHostile, now);
    }
  }

  /** Anyone inside a block that just turned solid is moved to the nearest free tile, never crushed. */
  private pushOutOfSolids(): void {
    const solid = (col: number, row: number) =>
      col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows || this.isSolidTile(col, row);
    const bodies = [this.hero, ...this.creatures()].filter((s) => s.body.enable);
    for (const s of bodies) {
      const b = s.body;
      const rect = { x: b.x, y: b.y, width: b.width, height: b.height };
      if (!overlapsSolid(rect, TILE, solid)) continue;
      const spot = findFreeSpot(rect, TILE, solid);
      if (spot) b.reset(s.x + spot.x - b.x, s.y + spot.y - b.y);
    }
    for (const a of this.arrows.getChildren() as Arrow[]) {
      if (overlapsSolid({ x: a.body.x, y: a.body.y, width: a.body.width, height: a.body.height }, TILE, solid)) {
        a.destroy();
      }
    }
  }

  private isSolidTile(col: number, row: number): boolean {
    return this.ground.hasTileAt(col, row) || this.colorBlocks.isSolidTile(col, row);
  }

  /** Solid check for creatures looking ahead: the map's sides count as walls, below the map is a pit. */
  private isSolidAt(x: number, y: number): boolean {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= this.mapCols) return true;
    if (row < 0 || row >= this.mapRows) return row < 0;
    return this.isSolidTile(col, row);
  }

  // ---- Creatures and combat ----

  private walkers(): Walker[] {
    return this.enemies.getChildren() as Walker[];
  }

  private mushroomList(): Mushroom[] {
    return this.mushrooms.getChildren() as Mushroom[];
  }

  private creatures(): Creature[] {
    return [...this.walkers(), ...this.mushroomList()];
  }

  private heroTouches(c: Creature): void {
    if (this.playState !== 'playing') return;
    const now = this.time.now;
    const hb = this.hero.body;
    const cb = c.body;
    // Feet at or just inside the creature's top while falling counts as landing on it.
    const landingOnTop =
      hb.velocity.y > 0 && hb.bottom - Math.max(0, hb.deltaY()) <= cb.top + HERO.stompTolerance;
    const effect = touchEffect(c.kind, {
      friendsHostile: this.rules.friendsHostile,
      landingOnTop,
      stunned: c instanceof Mushroom && c.isStunned(now),
    });
    switch (effect) {
      case 'hurtHero':
        this.hurtHero(1, c.x);
        break;
      case 'bounce':
        this.hero.bounce(ENEMY.calmBounceVelocity);
        sfx.bounce();
        break;
      case 'spring':
        this.hero.bounce(FRIEND.mushroomBounceVelocity);
        if (c instanceof Mushroom) c.squash();
        sfx.bounce();
        break;
      case 'none':
        break;
    }
  }

  private weaponHit(c: Creature, damage: number, fromX: number): HitEffect {
    const effect = weaponHitEffect(c.kind, damage, this.rules.friendsHostile);
    const now = this.time.now;
    if (effect.kind === 'damage' && c instanceof Walker) {
      c.takeHit(effect.amount, fromX, now);
      sfx.hit();
    } else if (effect.kind === 'stun' && c instanceof Mushroom) {
      c.stun(now);
      sfx.hit();
    }
    return effect;
  }

  private arrowHits(arrow: Arrow, c: Creature): void {
    if (!arrow.active || arrow.hitTargets.has(c)) return;
    const effect = this.weaponHit(c, arrow.damage, arrow.x);
    // Friendly creatures don't stop arrows; weapons never affect them.
    if (effect.kind === 'none') return;
    arrow.hitTargets.add(c);
    if (effect.kind === 'damage' && arrow.piercesLeft > 0) arrow.piercesLeft--;
    else arrow.destroy();
  }

  private removeFallenCreatures(): void {
    const bottom = this.mapRows * TILE + LEVEL.fallDeathMargin;
    for (const c of this.creatures()) if (c.y > bottom) c.destroy();
  }

  // ---- Progress, death and respawn ----

  private touchCheckpoint(index: number): void {
    if (this.playState !== 'playing' || !this.checkpoints.activate(index)) return;
    this.checkpointFlags[index].setTexture(TEXTURES.checkpointOn);
    this.showBanner('Checkpoint!', 1200);
  }

  private reachCrown(): void {
    if (this.playState !== 'playing') return;
    this.playState = 'won';
    this.physics.pause();
    this.hero.setAlpha(1);
    this.showBanner(`You found the crown!\nTime ${formatTime(this.elapsedMs)}\n\nPress Enter to continue`);
  }

  private die(): void {
    if (this.playState !== 'playing') return;
    this.playState = 'dying';
    this.hero.freeze();
    this.hero.setAlpha(1).setTint(0xff6666);
    const cam = this.cameras.main;
    this.time.delayedCall(RESPAWN.deathPauseMs, () => {
      cam.fadeOut(RESPAWN.fadeMs, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (this.vitals.loseLife() === 'restartLevel') {
          // Out of lives: restart the whole level (but never the whole game).
          this.scene.restart({ hero: this.heroKind, banner: 'Out of lives!\nStarting the level again' });
          return;
        }
        this.respawn();
        cam.fadeIn(RESPAWN.fadeMs);
      });
    });
  }

  private respawn(): void {
    const at = this.checkpoints.respawnPoint;
    this.hero.respawnAt(at);
    this.cameras.main.centerOn(at.x, at.y);
    this.vitals.grantInvulnerability(this.time.now, RESPAWN.graceMs);
    // Spec: no flip fires in the 2 seconds after a respawn.
    this.flips.holdFor(RESPAWN.graceMs);
    this.controls.reset();
    this.playState = 'playing';
  }

  private togglePause(): void {
    if (this.playState === 'playing') {
      this.playState = 'paused';
      this.physics.pause();
    } else if (this.playState === 'paused') {
      this.playState = 'playing';
      this.physics.resume();
      this.controls.reset();
    }
  }

  private showBanner(text: string, durationMs = Infinity): void {
    this.banner = { text, untilMs: this.time.now + durationMs };
  }

  /** Dev-only shortcuts for play-testing: F flip now, G physics outlines, N next checkpoint, H hurt self. */
  private addDebugKeys(kb: Phaser.Input.Keyboard.KeyboardPlugin): void {
    const world = this.physics.world;
    world.drawDebug = false;
    world.debugGraphic?.clear();
    kb.on('keydown-F', () => {
      if (this.playState === 'playing') this.flips.forceFlip();
    });
    kb.on('keydown-G', () => {
      world.drawDebug = !world.drawDebug;
      world.debugGraphic?.clear();
    });
    kb.on('keydown-N', () => {
      if (this.playState !== 'playing') return;
      const targets = [...this.level.checkpoints, this.level.crown];
      const next = targets[this.checkpoints.activeIndex + 1];
      // Land a few tiles short of the crown rather than on it.
      this.hero.respawnAt(next === this.level.crown ? { x: next.x - 60, y: next.y } : next);
    });
    kb.on('keydown-H', () => this.hurtHero());
  }
}
