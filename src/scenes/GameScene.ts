// One playable level: tiles, hero, checkpoints, pits, the crown, pausing and respawning.
import Phaser from 'phaser';
import { CAMERA, COLORS, DEBUG, HERO, LEVEL, LIVES, RESPAWN } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { Hero } from '../hero/Hero';
import { Controls } from '../input/Controls';
import { parseLevelObjects, TILE_LAYERS, TILESET_NAME, type LevelObjects, type TiledMap } from '../level/LevelData';
import { CheckpointTracker, type Point } from '../systems/CheckpointTracker';
import { HeroVitals } from '../systems/HeroVitals';
import { formatTime } from '../systems/math';
import { ASSETS, SCENES } from './keys';

export type PlayState = 'playing' | 'paused' | 'dying' | 'won';

/** Everything the HUD shows, read by the HUD every frame. */
export interface HudState {
  hearts: number;
  maxHearts: number;
  lives: number;
  elapsedMs: number;
  playState: PlayState;
  banner: string | null;
}

export class GameScene extends Phaser.Scene {
  private hero!: Hero;
  private controls!: Controls;
  private vitals!: HeroVitals;
  private checkpoints!: CheckpointTracker;
  private level!: LevelObjects;
  private checkpointFlags: Phaser.Physics.Arcade.Image[] = [];
  private mapHeight = 0;
  private playState: PlayState = 'playing';
  private elapsedMs = 0;
  private banner: { text: string; untilMs: number } | null = null;

  constructor() {
    super(SCENES.game);
  }

  get hudState(): HudState {
    const showBanner = this.banner && this.time.now < this.banner.untilMs;
    return {
      hearts: this.vitals.hearts,
      maxHearts: this.vitals.maxHearts,
      lives: this.vitals.lives,
      elapsedMs: this.elapsedMs,
      playState: this.playState,
      banner: showBanner ? this.banner!.text : null,
    };
  }

  create(): void {
    this.playState = 'playing';
    this.elapsedMs = 0;
    this.banner = null;
    this.checkpointFlags = [];

    // Level: the raw Tiled JSON gives spawn, checkpoints and crown; Phaser builds the tile layers.
    this.level = parseLevelObjects(this.cache.tilemap.get(ASSETS.testLevel).data as TiledMap);
    const map = this.make.tilemap({ key: ASSETS.testLevel });
    const tiles = map.addTilesetImage(TILESET_NAME, ASSETS.tiles);
    if (!tiles) throw new Error(`Tileset "${TILESET_NAME}" not found in the level file`);

    // Normal state: orange blocks are solid, blue blocks are ghosts. Milestone 2's flips will swap these.
    map.createLayer(TILE_LAYERS.blue, tiles)?.setAlpha(COLORS.ghostAlpha);
    const ground = map.createLayer(TILE_LAYERS.ground, tiles)!;
    const orange = map.createLayer(TILE_LAYERS.orange, tiles)!;
    ground.setCollisionByExclusion([-1]);
    orange.setCollisionByExclusion([-1]);

    // The world is open at the top and bottom, so the hero can fall into pits.
    this.mapHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels + LEVEL.fallDeathMargin * 4);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.vitals = new HeroVitals({ maxHearts: HERO.maxHearts, lives: LIVES.perLevel, invulnerableMs: HERO.invulnerableMs });
    this.checkpoints = new CheckpointTracker(this.level.spawn, this.level.checkpoints);
    this.hero = new Hero(this, this.level.spawn, TEXTURES.knight);
    this.controls = new Controls(this);

    this.physics.add.collider(this.hero, ground);
    this.physics.add.collider(this.hero, orange);

    this.level.checkpoints.forEach((p, i) => {
      const flag = this.staticSprite(p, TEXTURES.checkpointOff);
      this.checkpointFlags.push(flag);
      this.physics.add.overlap(this.hero, flag, () => this.touchCheckpoint(i));
    });
    const crown = this.staticSprite(this.level.crown, TEXTURES.crown);
    this.tweens.add({ targets: crown, y: crown.y - 3, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.physics.add.overlap(this.hero, crown, () => this.reachCrown());

    const cam = this.cameras.main;
    cam.setBackgroundColor(COLORS.sky);
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.hero, true, CAMERA.lerp, CAMERA.lerp);
    cam.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-ENTER', () => {
      if (this.playState === 'won') this.restartLevel();
    });
    if (DEBUG.enabled) this.addDebugKeys(kb);

    this.vitals.grantInvulnerability(this.time.now, RESPAWN.graceMs);
    if (!this.scene.isActive(SCENES.hud)) this.scene.launch(SCENES.hud);
  }

  update(_time: number, delta: number): void {
    if (this.playState !== 'playing') return;
    const now = this.time.now;
    this.elapsedMs += delta;
    this.hero.move(this.controls.read(), delta);
    this.hero.showInvulnerable(this.vitals.isInvulnerable(now), now);
    if (this.hero.y > this.mapHeight + LEVEL.fallDeathMargin) this.die();
  }

  /** Costs one heart, e.g. from an enemy touch. Used by enemies in milestone 2. */
  hurtHero(amount = 1): void {
    if (this.playState !== 'playing') return;
    if (this.vitals.takeHit(this.time.now, amount) === 'dead') this.die();
  }

  private staticSprite(at: Point, texture: string): Phaser.Physics.Arcade.Image {
    // Origin at the bottom so the sprite stands on the floor point; the static body must be refreshed after.
    return this.physics.add.staticImage(at.x, at.y, texture).setOrigin(0.5, 1).refreshBody();
  }

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
    this.showBanner(`You found the crown!\nTime ${formatTime(this.elapsedMs)}\n\nPress Enter to play again`);
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
          this.resetLevelProgress();
          this.showBanner('Out of lives!\nStarting the level again', 2500);
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
    this.controls.reset();
    this.playState = 'playing';
  }

  private restartLevel(): void {
    this.vitals.resetLevel();
    this.resetLevelProgress();
    this.banner = null;
    this.physics.resume();
    this.respawn();
  }

  private resetLevelProgress(): void {
    this.checkpoints.reset();
    for (const flag of this.checkpointFlags) flag.setTexture(TEXTURES.checkpointOff);
    this.elapsedMs = 0;
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

  /** Dev-only shortcuts for play-testing: G physics outlines, N next checkpoint, H hurt self. */
  private addDebugKeys(kb: Phaser.Input.Keyboard.KeyboardPlugin): void {
    const world = this.physics.world;
    world.drawDebug = false;
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
