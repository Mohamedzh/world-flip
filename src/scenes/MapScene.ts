// The world map: the five worlds along a path. Finished worlds show their best stars; locked
// worlds show a padlock. The castle opens only with all four powers (spec), shown as four slots.
import Phaser from 'phaser';
import { COLORS, DEBUG, VIEW } from '../config';
import { POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { LEVELS, TEST_LEVEL, findLevel } from '../level/levels';
import { saveGame } from '../saveGame';
import { ELEMENTS } from '../systems/powers';
import { SCENES } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

/** Where each world sits on the map, left to right with a gentle zigzag; the castle is last. */
const SPOTS = [
  { x: 64, y: 176 },
  { x: 152, y: 128 },
  { x: 240, y: 176 },
  { x: 328, y: 128 },
  { x: 418, y: 156 },
];
const NODE_COLORS = [0x5ab552, 0x3b82f6, 0xcfd8dc, 0x90caf9, 0x9575cd];

export interface MapSceneData {
  /** The world to highlight, e.g. the one just played. */
  focus?: string;
}

export class MapScene extends Phaser.Scene {
  private selected = 0;
  private cursor!: Phaser.GameObjects.Rectangle;
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.map);
  }

  create(data: MapSceneData): void {
    // Development shortcut: ?level=test-level goes straight to hero select for that level.
    const asked = DEBUG.enabled ? new URLSearchParams(window.location.search).get('level') : null;
    if (asked && findLevel(asked) && !this.registry.get('skippedMap')) {
      this.registry.set('skippedMap', true);
      this.scene.start(SCENES.select, { levelId: asked });
      return;
    }

    const save = saveGame.current;
    this.cameras.main.setBackgroundColor(COLORS.sky);
    this.add.text(VIEW.width / 2, 20, 'WORLD FLIP', { ...TEXT, fontSize: '20px', strokeThickness: 4 }).setOrigin(0.5);

    // The path between the worlds.
    const path = this.add.graphics();
    path.lineStyle(4, 0xf3e3c3, 1);
    path.beginPath();
    path.moveTo(SPOTS[0].x, SPOTS[0].y);
    for (const s of SPOTS.slice(1)) path.lineTo(s.x, s.y);
    path.strokePath();

    this.cursor = this.add.rectangle(0, 0, 44, 44).setStrokeStyle(3, COLORS.crown);
    this.tweens.add({ targets: this.cursor, scale: 1.1, yoyo: true, repeat: -1, duration: 500 });

    LEVELS.forEach((level, i) => {
      const { x, y } = SPOTS[i];
      const unlocked = save.unlocked.includes(level.id);
      this.add.circle(x, y, 18, unlocked ? NODE_COLORS[i] : 0x78909c).setStrokeStyle(2, 0x10141c);
      if (unlocked) this.add.text(x, y, String(level.world), { ...TEXT, fontSize: '14px' }).setOrigin(0.5);
      else this.add.image(x, y, TEXTURES.lock).setScale(1.5);
      this.add.text(x, y + 28, level.name, TEXT).setOrigin(0.5);
      const best = save.levels[level.id]?.bestStars ?? 0;
      if (unlocked) {
        for (let s = 0; s < 3; s++) {
          this.add.image(x - 14 + s * 14, y - 28, s < best ? TEXTURES.starFull : TEXTURES.starEmpty);
        }
      }
    });

    // The castle: four power slots that fill as powers are earned (spec), locked for now.
    const castle = SPOTS[4];
    this.add.rectangle(castle.x, castle.y, 40, 34, 0x9575cd).setStrokeStyle(2, 0x10141c);
    this.add.triangle(castle.x, castle.y - 26, 0, 14, 20, 0, 40, 14, 0x7e57c2).setStrokeStyle(2, 0x10141c);
    this.add.image(castle.x, castle.y + 2, TEXTURES.lock).setScale(1.3);
    ELEMENTS.forEach((e, i) => {
      const sx = castle.x - 21 + i * 14;
      this.add.rectangle(sx, castle.y + 32, 12, 12, 0x10141c, 0.6).setStrokeStyle(1, 0xffffff);
      if (save.powers.includes(e)) this.add.image(sx, castle.y + 32, POWER_ICONS[e]);
    });
    this.add.text(castle.x, castle.y + 48, 'Crown Castle', TEXT).setOrigin(0.5);

    this.info = this.add.text(VIEW.width / 2, VIEW.height - 34, '', TEXT).setOrigin(0.5);
    this.add.text(VIEW.width / 2, VIEW.height - 14, 'Arrows: choose a world    Enter: play', TEXT).setOrigin(0.5);

    // Start on the world just played, or the furthest one unlocked.
    const focus = LEVELS.findIndex((l) => l.id === data.focus);
    const furthest = LEVELS.reduce((best, l, i) => (save.unlocked.includes(l.id) ? i : best), 0);
    this.select(focus >= 0 ? focus : furthest);

    const kb = this.input.keyboard!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    for (const key of ['LEFT', 'A', 'UP', 'W']) kb.on(`keydown-${key}`, () => this.select(this.selected - 1));
    for (const key of ['RIGHT', 'D', 'DOWN', 'S']) kb.on(`keydown-${key}`, () => this.select(this.selected + 1));
    for (const key of ['ENTER', 'SPACE', 'J']) kb.on(`keydown-${key}`, () => this.play());
    if (DEBUG.enabled) {
      // U unlocks every world; T plays the test level.
      kb.on('keydown-U', () => {
        saveGame.update((s) => ({ ...s, unlocked: LEVELS.map((l) => l.id) }));
        this.scene.restart({ focus: LEVELS[this.selected].id });
      });
      kb.on('keydown-T', () => this.scene.start(SCENES.select, { levelId: TEST_LEVEL.id }));
    }
  }

  /** Moves the cursor; the castle (index 4) can be looked at but not played yet. */
  private select(index: number): void {
    this.selected = Phaser.Math.Clamp(index, 0, SPOTS.length - 1);
    const spot = SPOTS[this.selected];
    this.cursor.setPosition(spot.x, spot.y);
    const level = LEVELS[this.selected];
    if (!level) {
      const have = saveGame.current.powers.length;
      this.info.setText(`The Shifting King waits here. Powers: ${have} of 4`);
      return;
    }
    const unlocked = saveGame.current.unlocked.includes(level.id);
    this.info.setText(unlocked ? `World ${level.world}: ${level.name}` : `Finish World ${level.world - 1} to unlock`);
  }

  private play(): void {
    const level = LEVELS[this.selected];
    if (!level || !saveGame.current.unlocked.includes(level.id)) {
      this.cameras.main.shake(150, 0.004);
      return;
    }
    this.scene.start(SCENES.select, { levelId: level.id });
  }
}
