// The top bar (hearts, lives, power, current flip, time), the guardian's health bar,
// on-screen messages and the results panel, drawn above the level.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, VIEW } from '../config';
import { FLIP_ICONS, POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { HERO_LOOKS, SHEETS, TILE_FRAMES } from '../gfx/sprites';
import { FLIP_INFO } from '../systems/flips';
import { ELEMENTS } from '../systems/powers';
import { formatTime } from '../systems/math';
import type { GameScene, HudState, LevelResult } from './GameScene';
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
const HEART_SPACING = 15;
const POWER_SLOT = 17;

export class HudScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private livesIcon!: Phaser.GameObjects.Image;
  private livesText!: Phaser.GameObjects.Text;
  private powerIcons: Phaser.GameObjects.Image[] = [];
  private powerCooldown!: Phaser.GameObjects.Rectangle;
  private powerMarker!: Phaser.GameObjects.Rectangle;
  private powerX = 0;
  private timeText!: Phaser.GameObjects.Text;
  private flipIcon!: Phaser.GameObjects.Image;
  private flipText!: Phaser.GameObjects.Text;
  private nextIcon!: Phaser.GameObjects.Image;
  private nextText!: Phaser.GameObjects.Text;
  private guardianName!: Phaser.GameObjects.Text;
  private guardianBarBack!: Phaser.GameObjects.Rectangle;
  private guardianBar!: Phaser.GameObjects.Rectangle;
  private shieldIcons: Phaser.GameObjects.Image[] = [];
  private shimmer!: Phaser.GameObjects.Rectangle;
  private bannerText!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private resultPanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    // The warning shimmer sits under everything else in the HUD.
    this.shimmer = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0xffffff, 0).setOrigin(0, 0);
    // A dark strip behind the top bar keeps it readable over ceilings and bright skies.
    this.add.rectangle(0, 0, VIEW.width, 20, 0x10141c, 0.35).setOrigin(0, 0);

    this.hearts = [];
    const { maxHearts } = this.gameScene().hudState;
    for (let i = 0; i < maxHearts; i++) {
      this.hearts.push(this.add.image(2 + i * HEART_SPACING, 1, SHEETS.tiles, TILE_FRAMES.heartFull).setOrigin(0, 0));
    }
    const afterHearts = 4 + maxHearts * HEART_SPACING;
    this.livesIcon = this.add.image(afterHearts + 8, 18, HERO_LOOKS.knight.sheet, HERO_LOOKS.knight.idle).setOrigin(0.5, 1).setScale(0.5);
    this.livesText = this.add.text(afterHearts + 19, 4, '', TEXT);

    // Owned powers in a row (keys 1-4). The active one is underlined, with a dark overlay
    // that shrinks as it recharges.
    this.powerX = afterHearts + 46;
    this.powerIcons = ELEMENTS.map((e, i) =>
      this.add.image(this.powerX + i * POWER_SLOT, 2, POWER_ICONS[e]).setOrigin(0, 0).setScale(1.5).setVisible(false),
    );
    this.powerCooldown = this.add.rectangle(0, 2, 15, 15, 0x10141c, 0.7).setOrigin(0, 0);
    this.powerMarker = this.add.rectangle(0, 18, 15, 2, COLORS.crown).setOrigin(0, 0);

    // The time sits left of the music and sound buttons in the top-right corner.
    this.timeText = this.add.text(VIEW.width - 44, 4, '', TEXT).setOrigin(1, 0);

    // Current flip in the middle of the top bar: [icon] Normal 0:47.
    // During the warning: [icon] Normal >> [next icon] in 3, flashing.
    this.flipIcon = this.add.image(0, 9, FLIP_ICONS.normal).setOrigin(0, 0.5);
    this.flipText = this.add.text(0, 4, '', TEXT);
    this.nextIcon = this.add.image(0, 9, FLIP_ICONS.normal).setOrigin(0, 0.5);
    this.nextText = this.add.text(0, 4, '', TEXT);

    const cx = VIEW.width / 2;
    this.guardianName = this.add.text(cx, 24, '', TEXT).setOrigin(0.5, 0);
    this.guardianBarBack = this.add.rectangle(cx - 60, 38, 120, 5, 0x10141c, 0.8).setOrigin(0, 0);
    this.guardianBar = this.add.rectangle(cx - 59, 39, 118, 3, COLORS.heart).setOrigin(0, 0);
    // The boss's shield pieces, beside his bar: a piece's icon goes dim once it's broken.
    this.shieldIcons = ELEMENTS.map((e, i) => this.add.image(cx + 66 + i * 12, 40, POWER_ICONS[e]).setVisible(false));

    const cy = VIEW.height / 2;
    this.bannerText = this.add.text(cx, cy - 40, '', { ...TEXT, fontSize: '14px', align: 'center' }).setOrigin(0.5);
    this.pausedText = this.add
      .text(cx, cy, 'PAUSED\n\nEsc: keep playing\nQ: back to the map', { ...TEXT, fontSize: '14px', align: 'center' })
      .setOrigin(0.5);
    this.helpText = this.add
      .text(cx, VIEW.height - 8, 'Move: Arrows/A D   Jump: Space/W   Attack: J   Power: K   Pause: Esc', TEXT)
      .setOrigin(0.5, 1);
    this.time.delayedCall(HELP_MS, () => this.tweens.add({ targets: this.helpText, alpha: 0, duration: 600 }));
    this.resultPanel = null;
  }

  update(time: number): void {
    const s = this.gameScene().hudState;
    this.hearts.forEach((h, i) => h.setFrame(i < s.hearts ? TILE_FRAMES.heartFull : TILE_FRAMES.heartEmpty));
    const look = HERO_LOOKS[s.heroKind];
    this.livesIcon.setTexture(look.sheet, look.idle);
    this.livesText.setText(`x${s.lives}`);
    this.timeText.setText(formatTime(s.elapsedMs));
    this.bannerText.setText(s.banner ?? '');
    this.pausedText.setVisible(s.playState === 'paused');
    this.updatePowers(s.powers);
    this.updateGuardian(s.guardian);
    this.updateFlipBar(s.flip, time);
    if (s.result && !this.resultPanel) {
      this.resultPanel = this.showResult(s.result);
      this.helpText.setVisible(false);
    }
  }

  private updatePowers(p: HudState['powers']): void {
    ELEMENTS.forEach((e, i) => this.powerIcons[i].setVisible(p.owned.includes(e)).setAlpha(e === p.active ? 1 : 0.55));
    const active = p.active ? ELEMENTS.indexOf(p.active) : -1;
    this.powerMarker.setVisible(active >= 0);
    this.powerCooldown.setVisible(active >= 0 && p.readiness < 1);
    if (active < 0) return;
    const x = this.powerX + active * POWER_SLOT;
    this.powerMarker.setX(x);
    // The overlay covers the part that is still recharging, shrinking from the top.
    this.powerCooldown.setPosition(x, 2 + 15 * p.readiness).setSize(15, 15 * (1 - p.readiness));
  }

  private updateGuardian(guardian: HudState['guardian']): void {
    const visible = guardian !== null;
    this.guardianName.setVisible(visible);
    this.guardianBarBack.setVisible(visible);
    this.guardianBar.setVisible(visible);
    this.shieldIcons.forEach((icon, i) => {
      icon.setVisible(!!guardian?.shield);
      icon.setAlpha(guardian?.shield?.includes(ELEMENTS[i]) ? 1 : 0.2);
    });
    if (!guardian) return;
    this.guardianName.setText(guardian.shield?.length === 0 ? `${guardian.name} - shield down!` : guardian.name);
    this.guardianBar.setSize(Math.max(0, 118 * guardian.health), 3);
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

  /** The end-of-level panel: stars, time against par, a tip for the next star, and the best result. */
  private showResult(r: LevelResult): Phaser.GameObjects.Container {
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const panel = this.add.container(cx, cy);
    panel.add(this.add.rectangle(0, 0, 300, 150, 0x10141c, 0.85).setStrokeStyle(2, COLORS.crown));
    panel.add(this.add.text(0, -58, 'You found the crown!', { ...TEXT, fontSize: '14px' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) {
      const star = this.add.image((i - 1) * 30, -28, i < r.stars ? TEXTURES.starFull : TEXTURES.starEmpty).setScale(2);
      panel.add(star);
      // Earned stars pop in one after another.
      if (i < r.stars) {
        star.setScale(0);
        this.tweens.add({ targets: star, scale: 2, delay: 250 * i, duration: 250, ease: 'Back.out' });
        this.time.delayedCall(700 + 250 * i, () => sfx.star(i));
      }
    }
    const tip =
      r.stars === 3
        ? 'Perfect run!'
        : r.stars === 2
          ? 'Finish without getting hurt for 3 stars'
          : `Finish under ${formatTime(r.parMs)} for 2 stars`;
    const lines = [`Time ${formatTime(r.timeMs)}    Par ${formatTime(r.parMs)}`, tip, `Best: ${r.bestStars} of 3 stars`];
    panel.add(this.add.text(0, 14, lines.join('\n'), { ...TEXT, align: 'center', lineSpacing: 4 }).setOrigin(0.5));
    panel.add(this.add.text(0, 58, 'Press Enter to continue', TEXT).setOrigin(0.5));
    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 200 });
    return panel;
  }

  private gameScene(): GameScene {
    return this.scene.get(SCENES.game) as GameScene;
  }
}
