// The world map: the five worlds along a path. Played worlds show their best stars; locked worlds
// show a padlock. The castle opens once Sky is finished and all four powers are earned (spec),
// shown as four slots under it.
import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { COLORS, DEBUG, VIEW } from '../config';
import { POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { LEVEL_ORDER, LEVELS, TEST_LEVEL, findLevel, type LevelEntry } from '../level/levels';
import { saveGame } from '../saveGame';
import { ELEMENTS } from '../systems/powers';
import { isLevelUnlocked } from '../systems/progress';
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
  { x: 418, y: 150 },
];
const NODE_COLORS = [0x5ab552, 0x3b82f6, 0xcfd8dc, 0x90caf9, 0x9575cd];

export interface MapSceneData {
  /** The world to highlight, e.g. the one just played. */
  focus?: string;
}

function unlocked(level: LevelEntry): boolean {
  return isLevelUnlocked(saveGame.current, LEVEL_ORDER, level.id, level.needsAllPowers);
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

    music.play('menu');
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

    this.cursor = this.add.rectangle(0, 0, 46, 46).setStrokeStyle(3, COLORS.crown);
    this.tweens.add({ targets: this.cursor, scale: 1.1, yoyo: true, repeat: -1, duration: 500 });

    LEVELS.forEach((level, i) => {
      const { x, y } = SPOTS[i];
      const open = unlocked(level);
      if (level.needsAllPowers) this.drawCastle(x, y, open);
      else {
        this.add.circle(x, y, 18, open ? NODE_COLORS[i] : 0x78909c).setStrokeStyle(2, 0x10141c);
        if (open) this.add.text(x, y, String(level.world), { ...TEXT, fontSize: '14px' }).setOrigin(0.5);
        else this.add.image(x, y, TEXTURES.lock).setScale(1.5);
      }
      this.add.text(x, y + (level.needsAllPowers ? 48 : 28), level.name, TEXT).setOrigin(0.5);
      const best = save.levels[level.id]?.bestStars ?? 0;
      if (open) {
        for (let s = 0; s < 3; s++) {
          this.add.image(x - 14 + s * 14, y - (level.needsAllPowers ? 42 : 28), s < best ? TEXTURES.starFull : TEXTURES.starEmpty);
        }
      }
    });

    this.info = this.add.text(VIEW.width / 2, VIEW.height - 34, '', TEXT).setOrigin(0.5);
    this.add.text(VIEW.width / 2, VIEW.height - 14, 'Arrows: choose a world    Enter: play    Esc: menu', TEXT).setOrigin(0.5);

    // Start on the world just played, or the furthest one open.
    const focus = LEVELS.findIndex((l) => l.id === data.focus);
    const furthest = LEVELS.reduce((best, l, i) => (unlocked(l) ? i : best), 0);
    this.select(focus >= 0 ? focus : furthest);

    const kb = this.input.keyboard!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    const move = (d: number) => {
      this.select(this.selected + d);
      sfx.menuMove();
    };
    for (const key of ['LEFT', 'A', 'UP', 'W']) kb.on(`keydown-${key}`, () => move(-1));
    for (const key of ['RIGHT', 'D', 'DOWN', 'S']) kb.on(`keydown-${key}`, () => move(1));
    for (const key of ['ENTER', 'SPACE', 'J']) kb.on(`keydown-${key}`, () => this.play());
    kb.on('keydown-ESC', () => this.scene.start(SCENES.menu));
    if (DEBUG.enabled) {
      // U unlocks every world (and gives every power, for the castle); T plays the test level.
      kb.on('keydown-U', () => {
        saveGame.update((s) => ({ ...s, unlocked: LEVELS.map((l) => l.id), powers: [...ELEMENTS] }));
        this.scene.restart({ focus: LEVELS[this.selected].id });
      });
      kb.on('keydown-T', () => this.scene.start(SCENES.select, { levelId: TEST_LEVEL.id }));
    }
  }

  /** The castle, with the four power slots under it that fill as powers are earned (spec). */
  private drawCastle(x: number, y: number, open: boolean): void {
    const save = saveGame.current;
    this.add.rectangle(x, y, 40, 34, open ? 0x9575cd : 0x78909c).setStrokeStyle(2, 0x10141c);
    this.add.triangle(x, y - 26, 0, 14, 20, 0, 40, 14, open ? 0x7e57c2 : 0x607d8b).setStrokeStyle(2, 0x10141c);
    if (open) this.add.image(x, y + 2, TEXTURES.crown).setScale(1.2);
    else this.add.image(x, y + 2, TEXTURES.lock).setScale(1.3);
    ELEMENTS.forEach((e, i) => {
      const sx = x - 21 + i * 14;
      this.add.rectangle(sx, y + 30, 12, 12, 0x10141c, 0.7).setStrokeStyle(1, 0xffffff);
      if (save.powers.includes(e)) this.add.image(sx, y + 30, POWER_ICONS[e]);
    });
  }

  private select(index: number): void {
    this.selected = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    const spot = SPOTS[this.selected];
    this.cursor.setPosition(spot.x, spot.y);
    const level = LEVELS[this.selected];
    if (unlocked(level)) {
      this.info.setText(level.needsAllPowers ? 'The Shifting King is waiting!' : `World ${level.world}: ${level.name}`);
      return;
    }
    const previous = LEVELS[this.selected - 1];
    if (level.needsAllPowers) {
      const have = saveGame.current.powers.length;
      const finished = saveGame.current.levels[previous.id] !== undefined;
      this.info.setText(!finished ? `Finish World ${previous.world} to unlock` : `Collect all four powers: you have ${have}`);
    } else {
      this.info.setText(`Finish World ${previous.world} to unlock`);
    }
  }

  private play(): void {
    const level = LEVELS[this.selected];
    if (!unlocked(level)) {
      this.cameras.main.shake(150, 0.004);
      sfx.locked();
      return;
    }
    sfx.menuSelect();
    this.scene.start(SCENES.select, { levelId: level.id });
  }
}
