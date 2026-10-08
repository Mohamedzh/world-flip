// One playable level: tiles, hero, creatures, guardian, checkpoints, pits, the crown,
// world flips, combat, powers, stars and saving.
import Phaser from 'phaser';
import { EmberBeetle } from '../actors/EmberBeetle';
import { Mushroom } from '../actors/Mushroom';
import { PowerOrb } from '../actors/PowerOrb';
import { Walker } from '../actors/Walker';
import { sfx } from '../audio/sfx';
import {
  CAMERA,
  COLORS,
  DEBUG,
  ENEMY,
  FLIPS,
  FRIEND,
  GUARDIAN,
  HERO,
  LEVEL,
  LIVES,
  PHYSICS,
  POWERS,
  RESPAWN,
  TILE,
} from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { FLAG_ANIM, MEADOW_BACKGROUND, SHEETS, TILE_FRAMES } from '../gfx/sprites';
import type { Hero, HeroKind } from '../hero/Hero';
import { createHero, POWER_HINT } from '../hero/heroes';
import { Controls } from '../input/Controls';
import {
  DECOR_LAYER,
  GUARDIANS,
  parseLevel,
  TILE_LAYERS,
  TILESETS,
  type LevelData,
  type TiledMap,
} from '../level/LevelData';
import { FIRST_LEVEL, nextLevelId } from '../level/levels';
import { saveGame } from '../saveGame';
import { CheckpointTracker, type Point } from '../systems/CheckpointTracker';
import { touchEffect, weaponHitEffect, type HitEffect } from '../systems/combat';
import { FlipManager } from '../systems/FlipManager';
import { FLIP_INFO, rulesFor, type FlipState, type WorldRules } from '../systems/flips';
import { HeroVitals } from '../systems/HeroVitals';
import { ELEMENT_INFO, ELEMENTS, PowerSystem, type Element } from '../systems/powers';
import { recordLevel, starsFor, withPower } from '../systems/progress';
import { findFreeSpot, overlapsSolid } from '../systems/pushOut';
import { Arrow } from '../weapons/Arrow';
import { Fireball } from '../weapons/Fireball';
import type { CombatWorld } from '../weapons/Weapon';
import { Burnables } from '../world/Burnables';
import { ColorBlocks } from '../world/ColorBlocks';
import { ASSETS, SCENES } from './keys';

export type PlayState = 'playing' | 'paused' | 'dying' | 'won';

type Creature = Walker | Mushroom;

export interface GameSceneData {
  hero?: HeroKind;
  levelId?: string;
  /** A message to show as the level starts, e.g. after running out of lives. */
  banner?: string;
}

export interface LevelResult {
  stars: number;
  timeMs: number;
  parMs: number;
  heartsLost: boolean;
  bestStars: number;
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
  /** The active power and how recharged it is (1 = ready); null before any power is earned. */
  power: { element: Element; readiness: number; owned: Element[] } | null;
  /** The guardian's health bar, while the hero is near it. */
  guardian: { name: string; health: number } | null;
  result: LevelResult | null;
}

export class GameScene extends Phaser.Scene implements CombatWorld {
  private heroKind: HeroKind = 'knight';
  private levelId = FIRST_LEVEL;
  private hero!: Hero;
  private controls!: Controls;
  private vitals!: HeroVitals;
  private powers!: PowerSystem;
  private checkpoints!: CheckpointTracker;
  private flips!: FlipManager;
  private rules!: WorldRules;
  private level!: LevelData;
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private colorBlocks!: ColorBlocks;
  private burnables!: Burnables;
  private enemies!: Phaser.Physics.Arcade.Group;
  private mushrooms!: Phaser.Physics.Arcade.Group;
  private arrows!: Phaser.Physics.Arcade.Group;
  private fireballs!: Phaser.Physics.Arcade.Group;
  private orbs!: Phaser.Physics.Arcade.Group;
  private guardians: EmberBeetle[] = [];
  private checkpointFlags: Phaser.Physics.Arcade.Sprite[] = [];
  private background: Phaser.GameObjects.TileSprite[] = [];
  private mapCols = 0;
  private mapRows = 0;
  private playState: PlayState = 'playing';
  private elapsedMs = 0;
  /** Any damage or death this attempt; a 3-star finish needs none (spec). */
  private heartsLost = false;
  private result: LevelResult | null = null;
  private banner: { text: string; untilMs: number } | null = null;

  constructor() {
    super(SCENES.game);
  }

  get hudState(): HudState {
    const now = this.time.now;
    const showBanner = this.banner && now < this.banner.untilMs;
    const active = this.powers.active;
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
      power: active
        ? { element: active, readiness: this.powers.readiness(active, now), owned: this.powers.ownedPowers }
        : null,
      guardian: this.nearbyGuardian(),
      result: this.result,
    };
  }

  create(data: GameSceneData): void {
    // The scene clock only catches up with the game on the next frame; anything timed during
    // create (banner, start protection, the guardian's first charge) needs the real time now.
    // (loop.now is the frame timestamp that scene clocks use; loop.time counts from game start instead.)
    this.time.now = this.game.loop.now;
    this.heroKind = data.hero ?? this.heroKind;
    this.levelId = data.levelId ?? this.levelId;
    this.playState = 'playing';
    this.elapsedMs = 0;
    this.heartsLost = false;
    this.result = null;
    this.banner = null;
    this.guardians = [];
    // The physics world survives a scene restart, so undo anything a previous run left behind.
    this.physics.resume();

    this.buildLevel();
    this.vitals = new HeroVitals({ maxHearts: HERO.maxHearts, lives: LIVES.perLevel, invulnerableMs: HERO.invulnerableMs });
    this.powers = new PowerSystem(POWERS.cooldownMs, saveGame.current.powers);
    this.checkpoints = new CheckpointTracker(this.level.spawn, this.level.checkpoints);
    this.hero = createHero(this.heroKind, this, this.level.spawn, this, this.powers);
    this.controls = new Controls(this);
    this.arrows = this.memberGroup();
    this.fireballs = this.memberGroup();
    this.orbs = this.memberGroup();
    this.spawnCreatures();
    this.addColliders();
    this.setUpCamera();

    this.flips = new FlipManager(this.level.flipOrder, FLIPS);
    this.flips.onWarning(() => sfx.warningChime());
    this.flips.onChanged(({ to }) => this.onFlip(to));
    this.applyRules('normal');

    this.setUpKeys();
    this.vitals.grantInvulnerability(this.time.now, RESPAWN.graceMs);
    this.showBanner(data.banner ?? this.level.name, 2500);
    if (!this.scene.isActive(SCENES.hud)) this.scene.launch(SCENES.hud);
  }

  update(_time: number, delta: number): void {
    this.scrollBackground();
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

  // ---- CombatWorld: used by the heroes' weapons and powers ----

  strike(area: Phaser.Geom.Rectangle, damage: number, fromX: number): void {
    for (const c of this.creatures()) {
      const b = c.body;
      if (!b.enable) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) {
        this.weaponHit(c, damage, fromX);
      }
    }
  }

  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean, element: Element | null): void {
    this.arrows.add(new Arrow(this, x, y, dir, charged, element));
  }

  castPower(element: Element, hero: Hero): void {
    if (element === 'fire') {
      this.fireballs.add(new Fireball(this, hero.x + hero.facing * 8, hero.body.center.y - 2, hero.facing));
      sfx.shoot();
    }
    // Water, snow and wind arrive in milestone 4.
  }

  /** Costs hearts, e.g. from a creature's touch. */
  hurtHero(amount = 1, fromX?: number): void {
    if (this.playState !== 'playing') return;
    const result = this.vitals.takeHit(this.time.now, amount);
    if (result === 'ignored') return;
    this.heartsLost = true;
    sfx.hurt();
    if (fromX !== undefined) this.hero.knockback(Math.sign(this.hero.x - fromX));
    if (result === 'dead') this.die();
  }

  // ---- Level setup ----

  private buildLevel(): void {
    // The raw Tiled JSON gives the objects, flip order and par time; Phaser builds the tile layers.
    this.level = parseLevel(this.cache.tilemap.get(this.levelId).data as TiledMap);
    this.createBackground();
    const map = this.make.tilemap({ key: this.levelId });
    const kenney = map.addTilesetImage(TILESETS.kenney, SHEETS.tiles);
    const blocks = map.addTilesetImage(TILESETS.blocks, ASSETS.blockTiles);
    if (!kenney || !blocks) throw new Error('A tileset is missing from the level file');
    const tilesets = [kenney, blocks];
    if (map.getLayerIndex(DECOR_LAYER) !== null) map.createLayer(DECOR_LAYER, tilesets);
    const blue = map.createLayer(TILE_LAYERS.blue, tilesets)!;
    this.ground = map.createLayer(TILE_LAYERS.ground, tilesets)!;
    const orange = map.createLayer(TILE_LAYERS.orange, tilesets)!;
    this.ground.setCollisionByExclusion([-1]);
    this.colorBlocks = new ColorBlocks(orange, blue);
    this.burnables = new Burnables(this, map.createLayer(TILE_LAYERS.burnable, tilesets)!);
    this.mapCols = map.width;
    this.mapRows = map.height;

    // Closed at the top (low-gravity jumps bump the ceiling), open at the bottom so pits work.
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels + LEVEL.fallDeathMargin * 4);
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.checkpointFlags = this.level.checkpoints.map((p) => {
      const flag = this.physics.add.staticSprite(p.x, p.y, SHEETS.tiles, TILE_FRAMES.flag);
      flag.setOrigin(0.5, 1).refreshBody();
      return flag.setTint(COLORS.checkpointOff);
    });
  }

  /** World 1's meadow backdrop: sky, then hills and low ground that scroll slower than the level. */
  private createBackground(): void {
    const scale = 3;
    const w = Math.ceil(this.scale.width / scale) + 24;
    const piece = (frame: number, y: number) =>
      this.add
        .tileSprite(0, y, w, 24, SHEETS.backgrounds, frame)
        .setOrigin(0, 0)
        .setScale(scale)
        .setScrollFactor(0)
        .setDepth(-10);
    const h = this.scale.height;
    const sky = this.textures.getPixel(4, 4, SHEETS.backgrounds, MEADOW_BACKGROUND.sky);
    if (sky) this.cameras.main.setBackgroundColor(sky.color);
    this.background = [piece(MEADOW_BACKGROUND.hills, h - 24 * scale * 2), piece(MEADOW_BACKGROUND.low, h - 24 * scale)];
  }

  private scrollBackground(): void {
    for (const bg of this.background) bg.tilePositionX = (this.cameras.main.scrollX * 0.25) / bg.scaleX;
  }

  private spawnCreatures(): void {
    this.enemies = this.memberGroup();
    this.mushrooms = this.memberGroup();
    const solidAt = (x: number, y: number) => this.isSolidAt(x, y);
    for (const p of this.level.enemies) this.enemies.add(new Walker(this, p, solidAt));
    for (const p of this.level.mushrooms) this.mushrooms.add(new Mushroom(this, p));
    for (const g of this.level.guardians) {
      const beetle = new EmberBeetle(this, g, solidAt, () => this.hero);
      this.guardians.push(beetle);
      this.enemies.add(beetle);
    }
  }

  /** A physics group whose members set up their own bodies and get update() called every frame. */
  private memberGroup(): Phaser.Physics.Arcade.Group {
    const group = this.physics.add.group({ runChildUpdate: true });
    // Without this, adding a member would reset its body (velocity, gravity, bounds) to the group defaults.
    group.defaults = {} as Phaser.Types.Physics.Arcade.PhysicsGroupDefaults;
    return group;
  }

  private addColliders(): void {
    const crates = this.burnables.layer;
    const solids = [this.ground, ...this.colorBlocks.layers, crates];
    this.physics.add.collider(this.hero, solids);
    this.physics.add.collider([this.enemies, this.mushrooms], solids);

    // Arrows stop on solid blocks and fly through ghost blocks, since ghosts have no collision.
    // A fire arrow lights the crate it hits.
    this.physics.add.collider(this.arrows, solids, (a, t) => {
      const arrow = a as Arrow;
      const tile = t as Phaser.Tilemaps.Tile;
      if (arrow.element === 'fire' && tile.tilemapLayer === crates) this.burnables.ignite(tile.x, tile.y);
      arrow.destroy();
    });
    // Fireballs bounce along floors, burn out against walls, and light crates.
    this.physics.add.collider(this.fireballs, solids, (f, t) => {
      const fireball = f as Fireball;
      const tile = t as Phaser.Tilemaps.Tile;
      if (tile.tilemapLayer === crates) {
        this.burnables.ignite(tile.x, tile.y);
        fireball.burnOut();
      } else if (fireball.body.blocked.left || fireball.body.blocked.right) {
        fireball.burnOut();
      } else if (fireball.body.blocked.down) {
        fireball.bounce();
      } else {
        fireball.burnOut();
      }
    });

    this.physics.add.overlap(this.hero, [this.enemies, this.mushrooms], (_h, c) => this.heroTouches(c as Creature));
    this.physics.add.overlap(this.arrows, [this.enemies, this.mushrooms], (a, c) =>
      this.arrowHits(a as Arrow, c as Creature),
    );
    this.physics.add.overlap(this.fireballs, [this.enemies, this.mushrooms], (f, c) => {
      const fireball = f as Fireball;
      if (!fireball.active) return;
      if (this.weaponHit(c as Creature, fireball.damage, fireball.x).kind !== 'none') fireball.burnOut();
    });
    this.physics.add.overlap(this.hero, this.orbs, (_h, o) => this.collectOrb(o as PowerOrb));

    this.checkpointFlags.forEach((flag, i) => this.physics.add.overlap(this.hero, flag, () => this.touchCheckpoint(i)));
    const crown = this.physics.add.staticImage(this.level.crown.x, this.level.crown.y, TEXTURES.crown);
    crown.setOrigin(0.5, 1).refreshBody();
    this.tweens.add({ targets: crown, y: crown.y - 3, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.physics.add.overlap(this.hero, crown, () => this.reachCrown());
  }

  private setUpCamera(): void {
    const cam = this.cameras.main;
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
    // Switch power: L cycles, 1-4 pick fire, water, snow, wind.
    kb.on('keydown-L', () => this.powers.cycle());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => kb.on(`keydown-${key}`, () => this.powers.select(ELEMENTS[i])));
    if (DEBUG.enabled) this.addDebugKeys(kb);
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
    for (const group of [this.arrows, this.fireballs]) {
      for (const p of group.getChildren() as (Arrow | Fireball)[]) {
        if (overlapsSolid({ x: p.body.x, y: p.body.y, width: p.body.width, height: p.body.height }, TILE, solid)) {
          p.destroy();
        }
      }
    }
  }

  private isSolidTile(col: number, row: number): boolean {
    return (
      this.ground.hasTileAt(col, row) || this.colorBlocks.isSolidTile(col, row) || this.burnables.isSolidTile(col, row)
    );
  }

  /** Solid check for creatures looking ahead: the map's sides count as walls, below the map is a pit. */
  private isSolidAt(x: number, y: number): boolean {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= this.mapCols) return true;
    if (row < 0 || row >= this.mapRows) return row < 0;
    return this.isSolidTile(col, row);
  }

  // ---- Creatures, combat and powers ----

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
      const defeated = c.takeHit(effect.amount, fromX, now);
      sfx.hit();
      if (defeated && c instanceof EmberBeetle) this.guardianDefeated(c, { x: c.x, y: c.body.bottom });
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
    for (const c of this.creatures()) {
      if (c.y <= bottom) continue;
      // Spec: a guardian that falls into a pit still drops its power, at the pit's edge.
      if (c instanceof EmberBeetle && !c.isDefeated) this.guardianDefeated(c, c.pitEdge);
      c.destroy();
    }
  }

  private guardianDefeated(g: EmberBeetle, dropAt: Point): void {
    this.guardians = this.guardians.filter((x) => x !== g);
    const element = GUARDIANS[g.guardianKind].element;
    if (this.powers.has(element)) return; // Replaying a level: the power is already yours.
    this.orbs.add(new PowerOrb(this, this.onGroundNear(dropAt), element));
    this.showBanner(`${g.displayName} defeated!\nGrab the ${ELEMENT_INFO[element].label} power!`, 2500);
  }

  private collectOrb(orb: PowerOrb): void {
    if (!orb.active || this.playState !== 'playing') return;
    const { element } = orb;
    orb.destroy();
    this.powers.grant(element);
    // Powers are kept forever, including after death, so save at once.
    saveGame.update((s) => withPower(s, element));
    this.cameras.main.flash(300, 255, 200, 120);
    sfx.bounce();
    this.showBanner(`You got ${ELEMENT_INFO[element].label.toUpperCase()}!\n${POWER_HINT[this.heroKind]}`, 4500);
  }

  /**
   * The nearest tile column to `p` that has ground right under it, so a dropped power never floats
   * over a pit: a creature's center can be past a ledge while its feet are still on it.
   */
  private onGroundNear(p: Point): Point {
    const col = Math.floor(p.x / TILE);
    const rowBelow = Math.round(p.y / TILE);
    for (let d = 0; d <= 6; d++) {
      for (const c of d === 0 ? [col] : [col - d, col + d]) {
        if (this.isSolidTile(c, rowBelow) && !this.isSolidTile(c, rowBelow - 1)) {
          return { x: c * TILE + TILE / 2, y: rowBelow * TILE };
        }
      }
    }
    return p;
  }

  private nearbyGuardian(): HudState['guardian'] {
    const g = this.guardians.find((x) => x.active && !x.isDefeated);
    if (!g || Math.abs(g.x - this.hero.x) > GUARDIAN.showBarRange) return null;
    return { name: g.displayName, health: g.healthFraction };
  }

  // ---- Progress, death and respawn ----

  private touchCheckpoint(index: number): void {
    if (this.playState !== 'playing' || !this.checkpoints.activate(index)) return;
    this.checkpointFlags[index].clearTint().play(FLAG_ANIM);
    this.showBanner('Checkpoint!', 1200);
  }

  private reachCrown(): void {
    if (this.playState !== 'playing') return;
    this.playState = 'won';
    this.physics.pause();
    this.hero.setAlpha(1);
    this.banner = null;
    const stars = starsFor(this.elapsedMs, this.level.parMs, this.heartsLost);
    // Spec: unlocked levels, powers, best stars and chosen hero are saved after each level.
    saveGame.update((s) => ({
      ...recordLevel(s, this.levelId, stars, this.elapsedMs, nextLevelId(this.levelId)),
      hero: this.heroKind,
    }));
    this.result = {
      stars,
      timeMs: this.elapsedMs,
      parMs: this.level.parMs,
      heartsLost: this.heartsLost,
      bestStars: saveGame.current.levels[this.levelId]?.bestStars ?? stars,
    };
  }

  private die(): void {
    if (this.playState !== 'playing') return;
    this.playState = 'dying';
    this.heartsLost = true;
    this.hero.freeze();
    this.hero.setAlpha(1).setTint(0xff6666);
    const cam = this.cameras.main;
    this.time.delayedCall(RESPAWN.deathPauseMs, () => {
      cam.fadeOut(RESPAWN.fadeMs, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (this.vitals.loseLife() === 'restartLevel') {
          // Out of lives: restart the level (but never the whole game). Earned powers are kept.
          this.scene.restart({
            hero: this.heroKind,
            levelId: this.levelId,
            banner: 'Out of lives!\nStarting the level again',
          });
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

  /** Dev-only shortcuts: F flip now, G physics outlines, N next checkpoint, H hurt self, P get Fire. */
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
    kb.on('keydown-P', () => this.powers.grant('fire'));
  }
}
