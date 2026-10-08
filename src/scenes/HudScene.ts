// The top bar (hearts, lives, time) and on-screen messages, drawn above the level.
import Phaser from 'phaser';
import { VIEW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { formatTime } from '../systems/math';
import type { GameScene } from './GameScene';
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
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    this.hearts = [];
    const { maxHearts } = this.gameScene().hudState;
    for (let i = 0; i < maxHearts; i++) {
      this.hearts.push(this.add.image(6 + i * 11, 6, TEXTURES.heartFull).setOrigin(0, 0));
    }
    this.add.image(6 + maxHearts * 11 + 6, 4, TEXTURES.knight).setOrigin(0, 0).setScale(0.75);
    this.livesText = this.add.text(6 + maxHearts * 11 + 17, 4, '', TEXT);
    this.timeText = this.add.text(VIEW.width - 6, 4, '', TEXT).setOrigin(1, 0);

    const center = { x: VIEW.width / 2, y: VIEW.height / 2 };
    this.bannerText = this.add
      .text(center.x, center.y - 30, '', { ...TEXT, fontSize: '14px', align: 'center' })
      .setOrigin(0.5);
    this.pausedText = this.add
      .text(center.x, center.y, 'PAUSED\n\nPress Esc to keep playing', { ...TEXT, fontSize: '14px', align: 'center' })
      .setOrigin(0.5);
    this.helpText = this.add
      .text(center.x, VIEW.height - 8, 'Move: Arrows or A/D   Jump: Space or W   Pause: Esc', TEXT)
      .setOrigin(0.5, 1);
    this.time.delayedCall(HELP_MS, () =>
      this.tweens.add({ targets: this.helpText, alpha: 0, duration: 600 }),
    );
  }

  update(): void {
    const s = this.gameScene().hudState;
    this.hearts.forEach((h, i) => h.setTexture(i < s.hearts ? TEXTURES.heartFull : TEXTURES.heartEmpty));
    this.livesText.setText(`x${s.lives}`);
    this.timeText.setText(formatTime(s.elapsedMs));
    this.bannerText.setText(s.banner ?? '');
    this.pausedText.setVisible(s.playState === 'paused');
  }

  private gameScene(): GameScene {
    return this.scene.get(SCENES.game) as GameScene;
  }
}
