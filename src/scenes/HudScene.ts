// The top bar (hearts, lives, current flip, time) and on-screen messages, drawn above the level.
import Phaser from 'phaser';
import { VIEW } from '../config';
import { FLIP_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { FLIP_INFO } from '../systems/flips';
import { formatTime } from '../systems/math';
import type { GameScene, HudState } from './GameScene';
import { SCENES } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
};

/** How long the controls reminder stays on screen at the start. */
const HELP_MS = 8000;

export class HudScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private livesIcon!: Phaser.GameObjects.Image;
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private flipIcon!: Phaser.GameObjects.Image;
  private flipText!: Phaser.GameObjects.Text;
  private nextIcon!: Phaser.GameObjects.Image;
  private nextText!: Phaser.GameObjects.Text;
  private shimmer!: Phaser.GameObjects.Rectangle;
  private bannerText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    // The warning shimmer sits under everything else in the HUD.
    this.shimmer = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0xffffff, 0).setOrigin(0, 0);

    this.hearts = [];
    const { maxHearts } = this.gameScene().hudState;
    for (let i = 0; i < maxHearts; i++) {
      this.hearts.push(this.add.image(6 + i * 11, 6, TEXTURES.heartFull).setOrigin(0, 0));
    }
    this.livesIcon = this.add.image(6 + maxHearts * 11 + 6, 4, TEXTURES.knight).setOrigin(0, 0).setScale(0.75);
    this.livesText = this.add.text(6 + maxHearts * 11 + 17, 4, '', TEXT);
    this.timeText = this.add.text(VIEW.width - 6, 4, '', TEXT).setOrigin(1, 0);

    // Current flip in the middle of the top bar: [icon] Normal 0:47.
    // During the warning: [icon] Normal >> [next icon] in 3, flashing.
    this.flipIcon = this.add.image(0, 9, FLIP_ICONS.normal).setOrigin(0, 0.5);
    this.flipText = this.add.text(0, 4, '', TEXT);
    this.nextIcon = this.add.image(0, 9, FLIP_ICONS.normal).setOrigin(0, 0.5);
    this.nextText = this.add.text(0, 4, '', TEXT);

    const center = { x: VIEW.width / 2, y: VIEW.height / 2 };
    this.bannerText = this.add
      .text(center.x, center.y - 40, '', { ...TEXT, fontSize: '14px', align: 'center' })
      .setOrigin(0.5);
    this.pausedText = this.add
      .text(center.x, center.y, 'PAUSED\n\nPress Esc to keep playing', { ...TEXT, fontSize: '14px', align: 'center' })
      .setOrigin(0.5);
    this.helpText = this.add
      .text(center.x, VIEW.height - 8, 'Move: Arrows/A D   Jump: Space/W   Attack: J   Pause: Esc', TEXT)
      .setOrigin(0.5, 1);
    this.time.delayedCall(HELP_MS, () => this.tweens.add({ targets: this.helpText, alpha: 0, duration: 600 }));
  }

  update(time: number): void {
    const s = this.gameScene().hudState;
    this.hearts.forEach((h, i) => h.setTexture(i < s.hearts ? TEXTURES.heartFull : TEXTURES.heartEmpty));
    this.livesIcon.setTexture(s.heroKind === 'knight' ? TEXTURES.knight : TEXTURES.ranger);
    this.livesText.setText(`x${s.lives}`);
    this.timeText.setText(formatTime(s.elapsedMs));
    this.bannerText.setText(s.banner ?? '');
    this.pausedText.setVisible(s.playState === 'paused');

    this.updateFlipBar(s.flip, time);
  }

  private updateFlipBar(flip: HudState['flip'], time: number): void {
    const label = FLIP_INFO[flip.state].label;
    this.flipIcon.setTexture(FLIP_ICONS[flip.state]);
    this.nextIcon.setVisible(flip.warning);
    this.nextText.setVisible(flip.warning);
    if (flip.warning) {
      const color = Math.floor(time / 200) % 2 ? '#fff176' : '#ffffff';
      this.flipText.setText(`${label} >>`).setColor(color);
      this.nextIcon.setTexture(FLIP_ICONS[flip.next]);
      this.nextText.setText(`in ${Math.ceil(flip.msUntilFlip / 1000)}`).setColor(color);
      this.shimmer.setFillStyle(0xffffff, 0.06 + 0.06 * Math.sin(time / 60));
    } else {
      this.flipText.setText(`${label} ${formatTime(flip.msUntilFlip)}`).setColor('#ffffff');
      this.shimmer.setFillStyle(0xffffff, 0);
    }
    // Lay the pieces out left to right, centered on the screen.
    const gap = 4;
    const parts: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text; w: number }[] = [
      { obj: this.flipIcon, w: this.flipIcon.width },
      { obj: this.flipText, w: this.flipText.width },
    ];
    if (flip.warning) {
      parts.push({ obj: this.nextIcon, w: this.nextIcon.width }, { obj: this.nextText, w: this.nextText.width });
    }
    let x = (VIEW.width - parts.reduce((sum, p) => sum + p.w + gap, -gap)) / 2;
    for (const p of parts) {
      p.obj.setX(x);
      x += p.w + gap;
    }
  }

  private gameScene(): GameScene {
    return this.scene.get(SCENES.game) as GameScene;
  }
}
