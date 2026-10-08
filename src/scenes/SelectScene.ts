// Hero select screen, shown before each level (spec).
import Phaser from 'phaser';
import { COLORS, VIEW } from '../config';
import type { HeroKind } from '../hero/Hero';
import { HERO_INFO } from '../hero/heroes';
import { SCENES } from './keys';

const KINDS: HeroKind[] = ['knight', 'ranger'];
/** Remembers the last pick while the game is open. Saving it between visits comes in milestone 3. */
const REGISTRY_KEY = 'hero';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

export class SelectScene extends Phaser.Scene {
  private choice: HeroKind = 'knight';
  private frames: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super(SCENES.select);
  }

  create(): void {
    this.choice = (this.registry.get(REGISTRY_KEY) as HeroKind | undefined) ?? 'knight';
    this.cameras.main.setBackgroundColor(COLORS.sky);
    const cx = VIEW.width / 2;
    this.add.text(cx, 26, 'WORLD FLIP', { ...TEXT, fontSize: '22px', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(cx, 52, 'Choose your hero', { ...TEXT, fontSize: '12px' }).setOrigin(0.5);

    this.frames = KINDS.map((kind, i) => {
      const x = cx + (i === 0 ? -80 : 80);
      const y = 150;
      const info = HERO_INFO[kind];
      const frame = this.add.rectangle(x, y, 140, 140, 0x10141c, 0.35).setStrokeStyle(2, 0xffffff);
      frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(kind, true));
      this.add.image(x, y - 30, info.texture).setScale(3);
      this.add.text(x, y + 10, info.name, { ...TEXT, fontSize: '13px' }).setOrigin(0.5);
      this.add.text(x, y + 44, info.lines.join('\n'), { ...TEXT, lineSpacing: 4 }).setOrigin(0.5);
      return frame;
    });
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
    this.registry.set(REGISTRY_KEY, this.choice);
    this.scene.start(SCENES.game, { hero: this.choice });
  }
}
