// Hero select screen, shown before each level (spec). Remembers the last hero in the save.
import Phaser from 'phaser';
import { COLORS, DEBUG, VIEW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import type { HeroKind } from '../hero/Hero';
import { HERO_INFO } from '../hero/heroes';
import { FIRST_LEVEL, findLevel } from '../level/levels';
import { saveGame } from '../saveGame';
import { SCENES } from './keys';

const KINDS: HeroKind[] = ['knight', 'ranger'];

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

/** Which level to start. In development, ?level=test-level picks another one. */
function levelToPlay(): string {
  const asked = DEBUG.enabled ? new URLSearchParams(window.location.search).get('level') : null;
  return asked && findLevel(asked) ? asked : FIRST_LEVEL;
}

export class SelectScene extends Phaser.Scene {
  private choice: HeroKind = 'knight';
  private frames: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super(SCENES.select);
  }

  create(): void {
    this.choice = saveGame.current.hero;
    this.cameras.main.setBackgroundColor(COLORS.sky);
    const cx = VIEW.width / 2;
    this.add.text(cx, 24, 'WORLD FLIP', { ...TEXT, fontSize: '22px', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(cx, 48, 'Choose your hero', { ...TEXT, fontSize: '12px' }).setOrigin(0.5);

    this.frames = KINDS.map((kind, i) => {
      const x = cx + (i === 0 ? -80 : 80);
      const y = 142;
      const info = HERO_INFO[kind];
      const frame = this.add.rectangle(x, y, 140, 140, 0x10141c, 0.35).setStrokeStyle(2, 0xffffff);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(kind, true));
      this.add.sprite(x, y - 30, info.look.sheet, info.look.frames[0]).setScale(3).play(info.look.walkAnim);
      this.add.text(x, y + 10, info.name, { ...TEXT, fontSize: '13px' }).setOrigin(0.5);
      this.add.text(x, y + 44, info.lines.join('\n'), { ...TEXT, lineSpacing: 4 }).setOrigin(0.5);
      return frame;
    });

    // Best result so far on the level about to be played.
    const best = saveGame.current.levels[levelToPlay()]?.bestStars ?? 0;
    if (best > 0) {
      this.add.text(cx - 46, VIEW.height - 40, 'Best:', TEXT).setOrigin(0, 0.5);
      for (let i = 0; i < 3; i++) {
        this.add.image(cx + 4 + i * 14, VIEW.height - 40, i < best ? TEXTURES.starFull : TEXTURES.starEmpty);
      }
    }
    this.add.text(cx, VIEW.height - 18, 'Left / Right to choose    Enter or J to start', TEXT).setOrigin(0.5);

    const kb = this.input.keyboard!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    const toggle = () => this.pick(this.choice === 'knight' ? 'ranger' : 'knight');
    for (const key of ['LEFT', 'RIGHT', 'A', 'D']) kb.on(`keydown-${key}`, toggle);
    for (const key of ['ENTER', 'SPACE', 'J']) kb.on(`keydown-${key}`, () => this.start());
    this.pick(this.choice);
  }

  private pick(kind: HeroKind, startNow = false): void {
    this.choice = kind;
    this.frames.forEach((f, i) => {
      const selected = KINDS[i] === kind;
      f.setStrokeStyle(selected ? 3 : 1, selected ? COLORS.crown : 0xffffff);
      f.setFillStyle(0x10141c, selected ? 0.55 : 0.25);
    });
    if (startNow) this.start();
  }

  private start(): void {
    saveGame.update((s) => ({ ...s, hero: this.choice }));
    this.scene.start(SCENES.game, { hero: this.choice, levelId: levelToPlay() });
  }
}
