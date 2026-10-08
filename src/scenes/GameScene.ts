// One playable level: tiles, hero, creatures, guardian, checkpoints, pits, water, the crown,
// world flips, combat, the four powers and their combos, stars and saving.
import Phaser from 'phaser';
import { BossDoor } from '../actors/BossDoor';
import { ShiftingKing, type BossWorld } from '../actors/ShiftingKing';
import { FireWall } from '../actors/FireWall';
import { createGuardian, Guardian } from '../actors/guardians';
import { Mushroom } from '../actors/Mushroom';
import { PowerOrb } from '../actors/PowerOrb';
import { Thrower } from '../actors/Thrower';
import { BASIC_WALKER, Walker } from '../actors/Walker';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import {
  BOSS,
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
  THROWER,
  TILE,
  WATER,
  WIND,
} from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { BACKGROUNDS, FLAG_ANIM, SHEETS, TILE_FRAMES } from '../gfx/sprites';
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
import { FLIP_INFO, rulesFor, type FlipState, type GravityDir, type WorldRules } from '../systems/flips';
import { HeroVitals } from '../systems/HeroVitals';
import { ELEMENT_INFO, ELEMENTS, PowerSystem, type Element } from '../systems/powers';
import { recordLevel, starsFor, withPower } from '../systems/progress';
import { findFreeSpot, overlapsSolid } from '../systems/pushOut';
import { Arrow } from '../weapons/Arrow';
import { Fireball } from '../weapons/Fireball';
import { Pellet, puff, Shockwave, Snowball, WaterWave } from '../weapons/projectiles';
import type { CombatWorld, Hit } from '../weapons/Weapon';
import { Burnables } from '../world/Burnables';
import { ColorBlocks } from '../world/ColorBlocks';
import { SeedPod, SeedPods } from '../world/SeedPods';
import { WaterWorld } from '../world/WaterWorld';
import { SCENES, ASSETS } from './keys';

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
  /** Owned powers, the active one, and how recharged it is (1 = ready). */
  powers: { owned: Element[]; active: Element | null; readiness: number };
  /** The guardian's (or the boss's) health bar, while the hero is near it; the boss also shows his shield. */
  guardian: { name: string; health: number; shield?: Element[] } | null;
  result: LevelResult | null;
}

export class GameScene extends Phaser.Scene implements CombatWorld, BossWorld {
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
  private water!: WaterWorld;
  private seedPods!: SeedPods;
  private enemies!: Phaser.Physics.Arcade.Group;
  private mushrooms!: Phaser.Physics.Arcade.Group;
  private arrows!: Phaser.Physics.Arcade.Group;
  private fireballs!: Phaser.Physics.Arcade.Group;
  private waves!: Phaser.Physics.Arcade.Group;
  private snowballs!: Phaser.Physics.Arcade.Group;
  private pellets!: Phaser.Physics.Arcade.Group;
  private orbs!: Phaser.Physics.Arcade.Group;
  private shockwaves!: Phaser.Physics.Arcade.Group;
  private boss: ShiftingKing | null = null;
  /** Mushrooms the boss summoned in the friend/foe swap; they vanish at the next flip. */
  private minions: Mushroom[] = [];
  private bossDoors: BossDoor[] = [];
  private crown!: Phaser.Physics.Arcade.Image;
  private fireWalls!: Phaser.Physics.Arcade.StaticGroup;
  private guardians: Guardian[] = [];
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

  get gravityDir(): GravityDir {
    return this.rules?.gravityDir ?? 1;
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
      powers: { owned: this.powers.ownedPowers, active, readiness: active ? this.powers.readiness(active, now) : 0 },
      guardian: this.nearbyGuardian(),
      result: this.result,
    };
  }

  create(data: GameSceneData): void {
    // The scene clock only catches up with the game on the next frame; anything timed during
    // create (banner, start protection, the guardian's first attack) needs the real time now.
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
    this.boss = null;
    this.minions = [];
    // The physics world survives a scene restart, so undo anything a previous run left behind.
    this.physics.resume();

    this.buildLevel();
    this.vitals = new HeroVitals({ maxHearts: HERO.maxHearts, lives: LIVES.perLevel, invulnerableMs: HERO.invulnerableMs });
    this.powers = new PowerSystem(POWERS.cooldownMs, saveGame.current.powers);
    this.checkpoints = new CheckpointTracker(this.level.spawn, this.level.checkpoints);
    this.hero = createHero(this.heroKind, this, this.level.spawn, this, this.powers);
    this.controls = new Controls(this);
    for (const key of ['arrows', 'fireballs', 'waves', 'snowballs', 'pellets', 'orbs', 'shockwaves'] as const) {
      this[key] = this.memberGroup();
    }
    this.spawnCreatures();
    this.addColliders();
    this.setUpCamera();

    // The boss level has a longer window between flips, so all four shield pieces can be broken in one.
    const timing = { intervalMs: this.level.flipIntervalMs ?? FLIPS.intervalMs, warningMs: FLIPS.warningMs };
    this.flips = new FlipManager(this.level.flipOrder, timing, this.level.flipMode);
    this.flips.onWarning(() => sfx.warningChime());
    this.flips.onChanged(({ to }) => this.onFlip(to));
    this.applyRules('normal');

    this.setUpKeys();
    this.vitals.grantInvulnerability(this.time.now, RESPAWN.graceMs);
    this.showBanner(data.banner ?? this.level.name, 2500);
    music.play(this.level.theme);
    if (data.banner) sfx.gameOver();
    else sfx.levelStart();
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
    this.updateProjectiles();
    this.removeFallenCreatures();
    this.updateDoors();
    const hb = this.hero.body;
    const fellOut = this.gravityDir > 0 && this.hero.y > this.mapRows * TILE + LEVEL.fallDeathMargin;
    if (fellOut || this.water.inWater(hb.x, hb.y, hb.width, hb.height)) this.die();
  }

  // ---- ActorWorld: used by creatures ----

  heroPosition(): Point {
    return { x: this.hero.x, y: this.hero.body.center.y };
  }

  throwPellet(x: number, y: number, dir: 1 | -1): void {
    this.pellets.add(new Pellet(this, x, y, dir));
  }

  /** Solid check for creatures looking ahead: the map's sides count as walls, outside top/bottom are open. */
  isSolidAt(x: number, y: number): boolean {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= this.mapCols) return true;
    if (row < 0 || row >= this.mapRows) return row < 0;
    return this.isSolidTile(col, row);
  }

  spawnShockwave(x: number, floorY: number, dir: 1 | -1): void {
    this.shockwaves.add(new Shockwave(this, x, floorY, dir, this.gravityDir, BOSS.shockwaveSpeed, BOSS.shockwaveLifetimeMs));
  }

  summonMinions(near: Point, count: number): void {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const x = Phaser.Math.Clamp(near.x + side * TILE * (3 + i), TILE * 17, (this.mapCols - 2) * TILE);
      const m = new Mushroom(this, { x, y: TILE * 12 });
      m.setGravityDir(this.gravityDir);
      m.setHostile(true, this.time.now);
      this.mushrooms.add(m);
      this.minions.push(m);
      puff(this, x, TILE * 11, 0xb388ff, 8);
    }
  }

  // ---- CombatWorld: used by the heroes' weapons and powers ----

  strike(area: Phaser.Geom.Rectangle, hit: Hit): void {
    for (const c of this.creatures()) {
      const b = c.body;
      if (!b.enable) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) {
        this.weaponHit(c, hit);
      }
    }
    // The Knight's swing knocks back enemy pellets (spec).
    for (const p of this.pellets.getChildren() as Pellet[]) {
      if (!p.deflected && Phaser.Geom.Intersects.RectangleToRectangle(area, p.getBounds())) p.deflect();
    }
    if (hit.element === 'water') this.waterTouches(area);
  }

  fireArrow(x: number, y: number, dir: 1 | -1, charged: boolean, element: Element | null): void {
    this.arrows.add(new Arrow(this, x, y, dir, charged, element));
  }

  castPower(element: Element, hero: Hero): void {
    const dir = hero.facing;
    const g = this.gravityDir;
    switch (element) {
      case 'fire':
        this.fireballs.add(new Fireball(this, hero.x + dir * 8, hero.body.center.y - 2 * g, dir, g));
        sfx.fireball();
        break;
      case 'water': {
        const feet = g > 0 ? hero.body.bottom : hero.body.top;
        const floorRow = g > 0 ? Math.round(feet / TILE) : Math.round(feet / TILE) - 1;
        this.waves.add(new WaterWave(this, hero.x + dir * 10, feet, dir, floorRow, g));
        sfx.splash();
        break;
      }
      case 'snow':
        this.snowballs.add(new Snowball(this, hero.x + dir * 8, hero.body.center.y, dir));
        sfx.shoot();
        break;
      case 'wind':
        this.gust(hero);
        sfx.gust();
        break;
    }
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
    // The raw Tiled JSON gives the objects, flips and settings; Phaser builds the tile layers.
    this.level = parseLevel(this.cache.tilemap.get(this.levelId).data as TiledMap);
    this.createBackground();
    const map = this.make.tilemap({ key: this.levelId });
    const kenney = map.addTilesetImage(TILESETS.kenney, SHEETS.tiles);
    const blocks = map.addTilesetImage(TILESETS.blocks, ASSETS.blockTiles);
    if (!kenney || !blocks) throw new Error('A tileset is missing from the level file');
    const tilesets = [kenney, blocks];
    if (map.getLayerIndex(DECOR_LAYER) !== null) map.createLayer(DECOR_LAYER, tilesets);
    const waterLayer = map.createLayer(TILE_LAYERS.water, tilesets)!;
    const blue = map.createLayer(TILE_LAYERS.blue, tilesets)!;
    this.ground = map.createLayer(TILE_LAYERS.ground, tilesets)!;
    const orange = map.createLayer(TILE_LAYERS.orange, tilesets)!;
    this.ground.setCollisionByExclusion([-1]);
    this.colorBlocks = new ColorBlocks(orange, blue);
    this.burnables = new Burnables(this, map.createLayer(TILE_LAYERS.burnable, tilesets)!);
    this.mapCols = map.width;
    this.mapRows = map.height;
    const solidTile = (c: number, r: number) => this.isSolidTile(c, r);
    this.water = new WaterWorld(this, map, waterLayer, { kenney, blocks }, solidTile);
    this.seedPods = new SeedPods(this, map, tilesets, this.level.seedPods, solidTile, () => this.pushOutOfSolids());

    // Closed at the top (low-gravity and upside-down heroes bump the ceiling), open at the bottom for pits.
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels + LEVEL.fallDeathMargin * 4);
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.checkpointFlags = this.level.checkpoints.map((p) => {
      const flag = this.physics.add.staticSprite(p.x, p.y, SHEETS.tiles, TILE_FRAMES.flag);
      flag.setOrigin(0.5, 1).refreshBody();
      return flag.setTint(COLORS.checkpointOff);
    });
    this.bossDoors = this.level.bossDoors.map((p) => new BossDoor(this, p, saveGame.current.powers));
    this.fireWalls = this.physics.add.staticGroup();
    for (const p of this.level.fireWalls) this.fireWalls.add(new FireWall(this, p, (x, y) => this.isSolidAt(x, y)));
  }

  /** The world's backdrop: a sky color, then two bands of scenery that scroll slower than the level. */
  private createBackground(): void {
    const look = BACKGROUNDS[this.level.theme];
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
    const sky = this.textures.getPixel(4, 4, SHEETS.backgrounds, look.sky);
    if (sky) this.cameras.main.setBackgroundColor(sky.color);
    this.background = [piece(look.hills, h - 24 * scale * 2), piece(look.low, h - 24 * scale)];
  }

  private scrollBackground(): void {
    for (const bg of this.background) bg.tilePositionX = (this.cameras.main.scrollX * 0.25) / bg.scaleX;
  }

  private spawnCreatures(): void {
    this.enemies = this.memberGroup();
    this.mushrooms = this.memberGroup();
    // Basic enemies get tougher and faster in later worlds (spec).
    const style = {
      ...BASIC_WALKER,
      health: this.level.enemyHealth,
      speed: ENEMY.walkerSpeed * this.level.enemySpeed,
    };
    for (const p of this.level.enemies) this.enemies.add(new Walker(this, p, this, style));
    for (const p of this.level.throwers) this.enemies.add(new Thrower(this, p, this, this.level.enemyHealth));
    for (const p of this.level.mushrooms) this.mushrooms.add(new Mushroom(this, p));
    if (this.level.boss) {
      this.boss = new ShiftingKing(this, this.level.boss, this);
      this.enemies.add(this.boss);
    }
    for (const g of this.level.guardians) {
      const guardian = createGuardian(g.kind, this, g, this);
      this.guardians.push(guardian);
      this.enemies.add(guardian);
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
    const solids = [this.ground, ...this.colorBlocks.layers, crates, this.water.iceLayer, this.seedPods.leafLayer];
    const now = () => this.time.now;
    this.physics.add.collider(this.hero, solids);
    this.physics.add.collider([this.enemies, this.mushrooms], solids);
    this.physics.add.collider([this.enemies, this.mushrooms], this.fireWalls);
    // Fire walls block the hero and burn on touch.
    this.physics.add.collider(this.hero, this.fireWalls, (_h, w) => this.hurtHero(1, (w as FireWall).x));
    // A frozen enemy is a solid ice block to stand on.
    this.physics.add.collider(this.hero, this.enemies, undefined, (_h, e) => (e as Walker).isFrozen(now()));

    // Arrows stop on solid blocks and fly through ghost blocks, since ghosts have no collision.
    this.physics.add.collider(this.arrows, solids, (a, t) => {
      const arrow = a as Arrow;
      const tile = t as Phaser.Tilemaps.Tile;
      if (arrow.element === 'fire' && tile.tilemapLayer === crates) this.burnables.ignite(tile.x, tile.y);
      arrow.destroy();
    });
    this.physics.add.overlap(this.arrows, this.fireWalls, (a, w) => {
      if ((a as Arrow).element === 'water') (w as FireWall).extinguish();
      a.destroy();
    });
    this.physics.add.overlap(this.arrows, this.seedPods.group, (a, pod) => {
      if ((a as Arrow).element !== 'water') return;
      this.seedPods.grow(pod as SeedPod);
      a.destroy();
    });

    // Fireballs bounce along floors, burn out against walls, and light crates.
    this.physics.add.collider(this.fireballs, solids, (f, t) => {
      const fireball = f as Fireball;
      const tile = t as Phaser.Tilemaps.Tile;
      const b = fireball.body;
      if (tile.tilemapLayer === crates) {
        this.burnables.ignite(tile.x, tile.y);
        fireball.burnOut();
      } else if (b.blocked.left || b.blocked.right) {
        fireball.burnOut();
      } else if (this.gravityDir > 0 ? b.blocked.down : b.blocked.up) {
        fireball.bounce(this.gravityDir);
      } else {
        fireball.burnOut();
      }
    });
    this.physics.add.overlap(this.fireballs, this.fireWalls, (f) => (f as Fireball).burnOut());

    // Water waves stop at walls; snowballs and pellets burst on anything solid.
    this.physics.add.collider(this.waves, solids, (w) => {
      const wave = w as WaterWave;
      if (wave.body.blocked.left || wave.body.blocked.right) wave.destroy();
    });
    this.physics.add.collider(this.snowballs, solids, (s) => (s as Snowball).burst());
    this.physics.add.collider(this.pellets, solids, (p) => (p as Pellet).burst());
    this.physics.add.overlap([this.snowballs, this.pellets], this.fireWalls, (p) => (p as Snowball | Pellet).burst());

    // Hitting creatures.
    const creatures = [this.enemies, this.mushrooms];
    this.physics.add.overlap(this.hero, creatures, (_h, c) => this.heroTouches(c as Creature));
    this.physics.add.overlap(this.arrows, creatures, (a, c) => this.arrowHits(a as Arrow, c as Creature));
    this.physics.add.overlap(this.fireballs, creatures, (f, c) => {
      const fb = f as Fireball;
      if (!fb.active) return;
      const effect = this.weaponHit(c as Creature, { damage: fb.damage, fromX: fb.x, element: 'fire' });
      if (effect.kind !== 'none') fb.burnOut();
    });
    this.physics.add.overlap(this.waves, creatures, (w, c) => {
      const wave = w as WaterWave;
      if (wave.hitTargets.has(c as Creature)) return;
      wave.hitTargets.add(c as Creature);
      this.weaponHit(c as Creature, { damage: 0, fromX: wave.x - wave.dir * 20, element: 'water' });
    });
    this.physics.add.overlap(this.waves, this.seedPods.group, (_w, pod) => this.seedPods.grow(pod as SeedPod));
    this.physics.add.overlap(this.waves, this.fireWalls, (_w, wall) => (wall as FireWall).extinguish());
    this.physics.add.overlap(this.snowballs, creatures, (s, c) => {
      const ball = s as Snowball;
      if (!ball.active) return;
      this.weaponHit(c as Creature, { damage: 0, fromX: ball.x, element: 'snow', freezes: true });
      ball.burst();
    });
    this.physics.add.overlap(this.hero, this.pellets, (_h, p) => {
      const pellet = p as Pellet;
      if (pellet.deflected || !pellet.active) return;
      this.hurtHero(1, pellet.x);
      pellet.burst();
    });
    this.physics.add.overlap(this.pellets, this.enemies, (p, e) => {
      const pellet = p as Pellet;
      if (!pellet.deflected || !pellet.active) return;
      this.weaponHit(e as Walker, { damage: THROWER.deflectDamage, fromX: pellet.x, element: null });
      pellet.burst();
    });
    this.physics.add.overlap(this.hero, this.orbs, (_h, o) => this.collectOrb(o as PowerOrb));
    // The castle door blocks a hero who doesn't have all four powers yet.
    this.physics.add.collider(this.hero, this.bossDoors, () => {
      if (this.powers.ownedPowers.length < 4) this.showBanner('The door needs all four powers', 1500);
    });
    this.physics.add.collider([this.enemies, this.mushrooms], this.bossDoors);
    // The King's shockwaves run along the floor: jump over them. They stop at walls.
    this.physics.add.overlap(this.hero, this.shockwaves, (_h, w) => this.hurtHero(BOSS.touchDamage, (w as Shockwave).x));
    this.physics.add.collider(this.shockwaves, solids, (w) => {
      const wave = w as Shockwave;
      if (wave.body.blocked.left || wave.body.blocked.right) wave.destroy();
    });

    this.checkpointFlags.forEach((flag, i) => this.physics.add.overlap(this.hero, flag, () => this.touchCheckpoint(i)));
    const crown = this.physics.add.staticImage(this.level.crown.x, this.level.crown.y, TEXTURES.crown);
    crown.setOrigin(0.5, 1).refreshBody();
    this.crown = crown;
    this.tweens.add({ targets: crown, y: crown.y - 3, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.physics.add.overlap(this.hero, crown, () => this.reachCrown());
    // In the castle the crown only appears once the Shifting King is beaten (spec).
    if (this.boss) {
      crown.setVisible(false);
      crown.body!.enable = false;
    }
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
      if (this.playState === 'won') this.backToMap();
    });
    kb.on('keydown-Q', () => {
      if (this.playState === 'paused') this.backToMap();
    });
    // Switch power: L cycles, 1-4 pick fire, water, snow, wind.
    kb.on('keydown-L', () => this.powers.cycle());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => kb.on(`keydown-${key}`, () => this.powers.select(ELEMENTS[i])));
    if (DEBUG.enabled) this.addDebugKeys(kb);
  }

  private backToMap(): void {
    this.physics.resume();
    this.scene.stop(SCENES.hud);
    this.scene.start(SCENES.map, { focus: this.levelId });
  }

  // ---- World flips ----

  private onFlip(to: FlipState): void {
    for (const m of this.minions) {
      if (m.active) puff(this, m.x, m.y - 6, 0xb388ff, 6);
      m.destroy();
    }
    this.minions = [];
    this.applyRules(to);
    if (this.boss?.active) this.boss.onFlip(to, this.time.now);
    this.cameras.main.flash(250, 255, 255, 255);
    sfx.flip();
    const info = FLIP_INFO[to];
    this.showBanner(`${info.label}!\n${info.tip}`, FLIPS.bannerMs);
  }

  /** The only place world rules change. A flip keeps everyone's velocity; only the physics changes. */
  private applyRules(state: FlipState): void {
    const before = this.rules;
    this.rules = rulesFor(state, FLIPS.lowGravityScale);
    const g = this.rules.gravityDir;
    this.physics.world.gravity.y = PHYSICS.gravity * this.rules.gravityScale * g;
    this.hero.setMaxFallSpeed(this.rules.gravityScale < 1 ? FLIPS.lowGravityMaxFallSpeed : PHYSICS.maxFallSpeed);
    if (!before || before.gravityDir !== g) {
      this.hero.setGravityDir(g);
      for (const c of this.creatures()) c.setGravityDir(g);
    }
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
      const spot = findFreeSpot(rect, TILE, solid, 4, this.gravityDir);
      if (spot) b.reset(s.x + spot.x - b.x, s.y + spot.y - b.y);
    }
    for (const group of [this.arrows, this.fireballs, this.snowballs, this.pellets]) {
      for (const p of group.getChildren() as Phaser.Physics.Arcade.Image[]) {
        const pb = p.body as Phaser.Physics.Arcade.Body;
        if (overlapsSolid({ x: pb.x, y: pb.y, width: pb.width, height: pb.height }, TILE, solid)) p.destroy();
      }
    }
  }

  private isSolidTile(col: number, row: number): boolean {
    return (
      this.ground.hasTileAt(col, row) ||
      this.colorBlocks.isSolidTile(col, row) ||
      this.burnables.isSolidTile(col, row) ||
      this.water.isIce(col, row) ||
      this.seedPods.isSolidTile(col, row)
    );
  }

  // ---- Powers ----

  /** Wind: a gust in front of the hero that throws enemies back (off ledges) and blows pellets away. */
  private gust(hero: Hero): void {
    const dir = hero.facing;
    const b = hero.body;
    const area = new Phaser.Geom.Rectangle(
      dir > 0 ? b.right : b.left - WIND.gustWidth,
      b.center.y - WIND.gustHeight / 2,
      WIND.gustWidth,
      WIND.gustHeight,
    );
    const now = this.time.now;
    for (const e of this.walkers()) {
      if (!e.body.enable || !Phaser.Geom.Intersects.RectangleToRectangle(area, e.getBounds())) continue;
      if (e instanceof ShiftingKing) this.hitBoss(e, { damage: 0, fromX: hero.x, element: 'wind' });
      else e.push(dir * WIND.gustPushX, -this.gravityDir * WIND.gustPushY, WIND.gustPushMs, now);
    }
    for (const p of this.pellets.getChildren() as Pellet[]) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, p.getBounds())) p.burst();
    }
    // Fire plus Wind: a fireball caught in the gust splits into a spreading fan of three.
    for (const fb of this.fireballs.getChildren() as Fireball[]) {
      if (fb.spread || !Phaser.Geom.Intersects.RectangleToRectangle(area, fb.getBounds())) continue;
      fb.spread = true;
      for (const vy of [-220, 60]) {
        const extra = new Fireball(this, fb.x, fb.y, dir, this.gravityDir, vy);
        extra.spread = true;
        this.fireballs.add(extra);
      }
    }
    this.showGust(area, dir);
  }

  private showGust(area: Phaser.Geom.Rectangle, dir: 1 | -1): void {
    for (let i = 0; i < 5; i++) {
      const y = area.y + 4 + (i * (area.height - 8)) / 4;
      const startX = dir > 0 ? area.x : area.right;
      const line = this.add.rectangle(startX, y, 10, 2, 0xe0f7fa, 0.9).setDepth(5);
      this.tweens.add({
        targets: line,
        x: startX + dir * area.width,
        scaleX: 2.5,
        alpha: 0,
        delay: i * 30,
        duration: 260,
        onComplete: () => line.destroy(),
      });
    }
  }

  /** Water touching an area: grows seed pods and puts out fire walls there. */
  private waterTouches(area: Phaser.Geom.Rectangle): void {
    this.seedPods.waterArea(area);
    for (const w of this.fireWalls.getChildren() as FireWall[]) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(area, w.getBounds())) w.extinguish();
    }
  }

  /** Per-frame checks for things colliders can't see: water under waves and snowballs. */
  private updateProjectiles(): void {
    for (const w of this.waves.getChildren() as WaterWave[]) {
      // A wave crossing an empty gap leaves water behind (the Water-then-Snow combo).
      this.water.leavePuddle(w.frontCol, w.floorRow);
      // It also waters seed pods a little below it, so casting from a leaf platform works.
      const feet = w.floorRow * TILE;
      this.seedPods.waterColumn(w.x - 9, w.x + 9, feet - TILE, feet + WATER.podReachBelow);
    }
    // A snowball reaching water or a puddle freezes it into an ice bridge.
    for (const s of this.snowballs.getChildren() as Snowball[]) {
      if (this.water.freezeAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) {
        sfx.freeze();
        s.burst();
      }
    }
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
    const g = this.gravityDir;
    // Feet at or just inside the creature's top while falling counts as landing on it
    // ("top" and "falling" are mirrored when upside-down).
    const prevFeet = (g > 0 ? hb.bottom : hb.top) - hb.deltaY();
    const creatureTop = g > 0 ? cb.top : cb.bottom;
    const landingOnTop =
      hb.velocity.y * g > 0 && (g > 0 ? prevFeet <= creatureTop + HERO.stompTolerance : prevFeet >= creatureTop - HERO.stompTolerance);
    const effect = touchEffect(c.kind, {
      friendsHostile: this.rules.friendsHostile,
      landingOnTop,
      stunned: c instanceof Mushroom && c.isStunned(now),
      frozen: c instanceof Walker && c.isFrozen(now),
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

  /** Applies one hit to a creature: damage, and whatever its element does. */
  private weaponHit(c: Creature, hit: Hit): HitEffect {
    if (c instanceof ShiftingKing) return this.hitBoss(c, hit);
    const now = this.time.now;
    const frozen = c instanceof Walker && c.isFrozen(now);
    const effect = weaponHitEffect(c.kind, hit.damage, {
      friendsHostile: this.rules.friendsHostile,
      frozen,
      fire: hit.element === 'fire',
    });
    if (c instanceof Mushroom) {
      if (effect.kind === 'stun') {
        c.stun(now);
        sfx.hit();
      }
      return effect;
    }
    if (effect.kind !== 'damage' && effect.kind !== 'shatter') return effect;
    if (effect.kind === 'shatter') {
      // Snow then Fire: the ice shatters for double damage.
      c.thaw();
      puff(this, c.x, c.body.center.y, 0xe1f5fe, 10);
      sfx.shatter();
    }
    const defeated = effect.amount > 0 && c.takeHit(effect.amount, hit.fromX, now);
    if (effect.amount > 0) sfx.hit();
    if (defeated) {
      if (c instanceof Guardian) this.guardianDefeated(c, { x: c.x, y: c.body.bottom });
      else sfx.defeat();
      return effect;
    }
    const away = Math.sign(c.x - hit.fromX) || 1;
    if (hit.element === 'water') c.push(away * WATER.pushSpeed, 0, WATER.pushMs, now);
    if (hit.element === 'snow') {
      if (hit.freezes) {
        c.freeze(now);
        sfx.freeze();
      } else c.slow(now);
    }
    return effect;
  }

  /**
   * The boss: an element breaks its own shield piece; with the shield down, the hit's damage counts.
   * Anything else just clanks off the shield.
   */
  private hitBoss(boss: ShiftingKing, hit: Hit): HitEffect {
    const now = this.time.now;
    if (!boss.shieldDown) {
      if (hit.element && boss.breakPiece(hit.element)) {
        sfx.shatter();
        if (boss.shieldDown) {
          sfx.powerUp();
          this.showBanner('The shield is down!\nAttack him now!', 2000);
        }
      } else {
        sfx.hit();
      }
      return { kind: 'damage', amount: 0 };
    }
    if (hit.damage > 0) {
      sfx.hit();
      if (boss.takeHit(hit.damage, hit.fromX, now)) this.bossDefeated(boss);
    }
    return { kind: 'damage', amount: hit.damage };
  }

  private bossDefeated(boss: ShiftingKing): void {
    sfx.guardianDefeat();
    this.cameras.main.shake(400, 0.01);
    for (const m of this.minions) m.destroy();
    this.minions = [];
    // The crown floats down where the King fell.
    const x = Phaser.Math.Clamp(boss.x, TILE * 20, (this.mapCols - 3) * TILE);
    this.crown.setPosition(x, -20).setVisible(true);
    this.tweens.add({ targets: this.crown, y: TILE * 12, duration: 1400, ease: 'Bounce.out' });
    // Made touchable on the game clock rather than when the animation ends, so it always happens.
    this.time.delayedCall(1450, () => {
      this.crown.setY(TILE * 12).refreshBody();
      this.crown.body!.enable = true;
    });
    this.showBanner('You beat the Shifting King!\nTake the crown!', 3500);
  }

  private updateDoors(): void {
    if (this.powers.ownedPowers.length < 4) return;
    for (const d of this.bossDoors) if (!d.isOpen && Math.abs(d.x - this.hero.x) < TILE * 4) d.open();
  }

  private arrowHits(arrow: Arrow, c: Creature): void {
    if (!arrow.active || arrow.hitTargets.has(c)) return;
    const effect = this.weaponHit(c, {
      damage: arrow.damage,
      fromX: arrow.x,
      element: arrow.element,
      freezes: arrow.element === 'snow',
    });
    // Friendly creatures don't stop arrows; weapons never affect them.
    if (effect.kind === 'none') return;
    arrow.hitTargets.add(c);
    if (effect.kind !== 'stun' && arrow.piercesLeft > 0) arrow.piercesLeft--;
    else arrow.destroy();
  }

  private removeFallenCreatures(): void {
    const bottom = this.mapRows * TILE + LEVEL.fallDeathMargin;
    for (const c of this.creatures()) {
      const b = c.body;
      const drowned = b.enable && this.water.inWater(b.x, b.y, b.width, b.height);
      if (c.y <= bottom && !drowned) continue;
      // Spec: a guardian that falls into a pit still drops its power, at the pit's edge.
      if (c instanceof Guardian && !c.isDefeated) this.guardianDefeated(c, c.pitEdge);
      if (drowned) puff(this, c.x, c.y - 6, 0x4fc3f7, 8);
      c.destroy();
    }
  }

  private guardianDefeated(g: Guardian, dropAt: Point): void {
    this.guardians = this.guardians.filter((x) => x !== g);
    sfx.guardianDefeat();
    const element = GUARDIANS[g.guardianKind].element;
    if (this.powers.has(element)) return; // Replaying a level: the power is already yours.
    this.orbs.add(new PowerOrb(this, this.onGroundNear(dropAt), element));
    this.showBanner(`${g.displayName} defeated!\nGrab the ${ELEMENT_INFO[element].label} power!`, 2500);
  }

  /**
   * The nearest tile column to `p` that has ground right under it, so a dropped power never floats
   * over a pit or water: a creature's center can be past a ledge while its feet are still on it.
   */
  private onGroundNear(p: Point): Point {
    const col = Math.floor(p.x / TILE);
    const rowBelow = Math.min(this.mapRows - 1, Math.max(1, Math.round(p.y / TILE)));
    for (let d = 0; d <= 8; d++) {
      for (const c of d === 0 ? [col] : [col - d, col + d]) {
        if (this.isSolidTile(c, rowBelow) && !this.isSolidTile(c, rowBelow - 1) && !this.water.isWater(c, rowBelow - 1)) {
          return { x: c * TILE + TILE / 2, y: rowBelow * TILE };
        }
      }
    }
    return p;
  }

  private collectOrb(orb: PowerOrb): void {
    if (!orb.active || this.playState !== 'playing') return;
    const { element } = orb;
    orb.destroy();
    this.powers.grant(element);
    // Powers are kept forever, including after death, so save at once.
    saveGame.update((s) => withPower(s, element));
    this.cameras.main.flash(300, 255, 200, 120);
    sfx.powerUp();
    this.showBanner(`You got ${ELEMENT_INFO[element].label.toUpperCase()}!\n${POWER_HINT[element][this.heroKind]}`, 5000);
  }

  private nearbyGuardian(): HudState['guardian'] {
    const b = this.boss;
    if (b?.active && !b.isDefeated && Math.abs(b.x - this.hero.x) < GUARDIAN.showBarRange * 2) {
      return { name: b.displayName, health: b.healthFraction, shield: b.shieldPieces };
    }
    const g = this.guardians.find((x) => x.active && !x.isDefeated);
    if (!g || Math.abs(g.x - this.hero.x) > GUARDIAN.showBarRange) return null;
    return { name: g.displayName, health: g.healthFraction };
  }

  // ---- Progress, death and respawn ----

  private touchCheckpoint(index: number): void {
    if (this.playState !== 'playing' || !this.checkpoints.activate(index)) return;
    this.checkpointFlags[index].clearTint().play(FLAG_ANIM);
    sfx.checkpoint();
    this.showBanner('Checkpoint!', 1200);
  }

  private reachCrown(): void {
    if (this.playState !== 'playing') return;
    this.playState = 'won';
    this.physics.pause();
    this.hero.setAlpha(1);
    this.banner = null;
    sfx.crown();
    const stars = starsFor(this.elapsedMs, this.level.parMs, this.heartsLost);
    // Spec: unlocked levels, powers, best stars and chosen hero are saved after each level.
    saveGame.update((s) => ({
      ...recordLevel(s, this.levelId, stars, this.elapsedMs, nextLevelId(this.levelId)),
      hero: this.heroKind,
    }));
    if (this.boss) {
      // The end of the game: on to the ending screen with the total of the best stars.
      this.showBanner('The crown is yours!', 3000);
      this.time.delayedCall(1800, () => {
        this.physics.resume();
        this.scene.stop(SCENES.hud);
        this.scene.start(SCENES.ending, { hero: this.heroKind });
      });
      return;
    }
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
    sfx.death();
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
    this.hero.setGravityDir(this.gravityDir);
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

  /** Dev-only shortcuts: F flip now, G physics outlines, N next checkpoint, H hurt self, P get every power. */
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
      this.hero.setGravityDir(this.gravityDir);
    });
    kb.on('keydown-H', () => this.hurtHero());
    kb.on('keydown-P', () => ELEMENTS.forEach((e) => this.powers.grant(e)));
  }
}
