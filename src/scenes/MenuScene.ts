// The main menu: Play (opens the world map), Controls, and About. Up/Down and Enter, or the mouse.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { COLORS, VIEW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { HERO_LOOKS } from '../gfx/sprites';
import { SCENES } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

type Page = 'main' | 'controls' | 'about';

const CONTROLS: [string, string][] = [
  ['Move', 'Arrow keys or A / D'],
  ['Jump', 'Space, W or Up (hold for higher)'],
  ['Attack', 'J (Ranger: hold to charge)'],
  ['Use power', 'Tap K'],
  ['Powered attack', 'Hold K, then press J'],
  ['Switch power', 'L, or 1 2 3 4'],
  ['Double jump, glide', 'Jump in the air (with Wind)'],
  ['Pause', 'Esc  (then Q: back to the map)'],
  ['Sound on/off', 'M'],
];

export class MenuScene extends Phaser.Scene {
  private page: Page = 'main';
  private items: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private content: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.sky);
    music.play('menu');
    const kb = this.input.keyboard!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    for (const key of ['UP', 'W']) kb.on(`keydown-${key}`, () => this.move(-1));
    for (const key of ['DOWN', 'S']) kb.on(`keydown-${key}`, () => this.move(1));
    for (const key of ['ENTER', 'SPACE', 'J']) kb.on(`keydown-${key}`, () => this.choose());
    kb.on('keydown-ESC', () => this.show('main'));
    this.show('main');
  }

  private clear(): void {
    for (const o of this.content) o.destroy();
    this.content = [];
    this.items = [];
  }

  private text(x: number, y: number, s: string, style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
    const t = this.add.text(x, y, s, { ...TEXT, ...style }).setOrigin(0.5);
    this.content.push(t);
    return t;
  }

  private show(page: Page): void {
    this.page = page;
    this.clear();
    const cx = VIEW.width / 2;
    if (page === 'main') {
      this.text(cx, 52, 'WORLD FLIP', { fontSize: '30px', strokeThickness: 5 });
      this.text(cx, 82, 'The world flips. Can you keep up?', { fontSize: '10px' });
      // The two heroes, walking in place either side of the menu.
      for (const [look, x, flip] of [[HERO_LOOKS.knight, cx - 120, false], [HERO_LOOKS.ranger, cx + 120, true]] as const) {
        this.content.push(this.add.sprite(x, 200, look.sheet, look.idle).setOrigin(0.5, 1).setScale(2).setFlipX(flip).play(look.walkAnim));
      }
      this.content.push(this.add.image(cx, 112, TEXTURES.crown).setScale(2));
      this.items = ['Play', 'Controls', 'About'].map((label, i) => {
        const t = this.text(cx, 150 + i * 26, label, { fontSize: '16px' });
        t.setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.highlight(i))
          .on('pointerdown', () => {
            this.highlight(i);
            this.choose();
          });
        return t;
      });
      this.text(cx, VIEW.height - 12, 'Up / Down to choose    Enter to pick', { fontSize: '9px' });
      this.highlight(0);
    } else if (page === 'controls') {
      this.text(cx, 24, 'CONTROLS', { fontSize: '18px' });
      CONTROLS.forEach(([action, keys], i) => {
        const y = 52 + i * 20;
        this.content.push(this.add.text(cx - 10, y, action, { ...TEXT, align: 'right' }).setOrigin(1, 0.5));
        this.content.push(this.add.text(cx + 10, y, keys, { ...TEXT, color: '#fff176', align: 'left' }).setOrigin(0, 0.5));
      });
      this.backHint();
    } else {
      this.text(cx, 30, 'ABOUT', { fontSize: '18px' });
      this.text(cx, 64, 'World Flip', { fontSize: '14px' });
      this.text(cx, 96, 'Made by', { fontSize: '10px', color: '#e0e0e0' });
      this.text(cx, 116, 'Mohamed Samir', { fontSize: '14px', color: '#fff176' });
      this.text(cx, 136, 'Mariam Mohamed Samir', { fontSize: '14px', color: '#fff176' });
      this.text(
        cx,
        184,
        'Art: Kenney (kenney.nl, CC0) and our own Knight and Ranger\nBuilt with Phaser',
        { fontSize: '9px', lineSpacing: 4, color: '#e0e0e0' },
      );
      this.backHint();
    }
  }

  private backHint(): void {
    const t = this.text(VIEW.width / 2, VIEW.height - 16, 'Enter or Esc: back', { fontSize: '10px' });
    t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.show('main'));
  }

  private highlight(i: number): void {
    this.selected = i;
    this.items.forEach((t, j) => t.setColor(j === i ? '#fff176' : '#ffffff').setScale(j === i ? 1.15 : 1));
  }

  private move(d: number): void {
    if (this.page !== 'main') return;
    this.highlight((this.selected + d + this.items.length) % this.items.length);
    sfx.menuMove();
  }

  private choose(): void {
    sfx.menuSelect();
    if (this.page !== 'main') {
      this.show('main');
      return;
    }
    if (this.selected === 0) this.scene.start(SCENES.map);
    else this.show(this.selected === 1 ? 'controls' : 'about');
  }
}
