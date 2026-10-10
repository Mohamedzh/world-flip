// The top bar (hearts, lives, power, current flip, time), the guardian's health bar,
// on-screen messages and the results panel, drawn above the level.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, VIEW } from '../config';
import { FLIP_ICONS, POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { HERO_LOOKS, SHEETS, TILE_FRAMES } from '../gfx/sprites';
import type { FlipState } from '../systems/flips';
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
/** The flip bar sits centered in the free space between the power row and the timer. */
const FLIP_BAR_CENTER = 296;
/** The color block colors, matching the tiles and the color swap icon. */
const SOLID_COLORS = { orange: 0xf28c28, blue: 0x3b82f6 } as const;
/** Short flip names for the top bar (the full names appear in the big banner). */
const SHORT_FLIP: Record<FlipState, string> = {
  normal: 'Normal',
  lowGravity: 'Low gravity',
  colorSwap: 'Color swap',
  friendFoe: 'Friend/foe',
  upsideDown: 'Upside-down',
};

export class HudScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private livesIcon!: Phaser.GameObjects.Image;
  private livesText!: Phaser.GameObjects.Text;
  private powerIcons: Phaser.GameObjects.Image[] = [];
  private powerCooldown!: Phaser.GameObjects.Rectangle;
  private powerMarker!: Phaser.GameObjects.Rectangle;
  /** Key hints on the power row: the number that picks each power, and "K" for using it. */
  private powerDigits: Phaser.GameObjects.Text[] = [];
  private powerKeyHint!: Phaser.GameObjects.Text;
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
  /** Marks on the boss's bar at each third: one shield break, or a good round of hits, takes a third. */
  private roundTicks: Phaser.GameObjects.Rectangle[] = [];
  private shimmer!: Phaser.GameObjects.Rectangle;
  /** "Solid: [block]" under the hearts, so it is always clear which color can be stood on. */
  private solidLabel!: Phaser.GameObjects.Text;
  private solidSwatch!: Phaser.GameObjects.Rectangle;
  private shownSolid: HudState['solidColor'] = null;
  private bannerText!: Phaser.GameObjects.Text;
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseButton!: Phaser.GameObjects.Container;
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
    const tiny = { ...TEXT, fontSize: '7px', strokeThickness: 2 };
    this.powerDigits = ELEMENTS.map((_, i) =>
      this.add.text(this.powerX + i * POWER_SLOT + 15, 18, String(i + 1), tiny).setOrigin(1, 1).setVisible(false),
    );
    this.powerKeyHint = this.add.text(0, 4, 'K', { ...TEXT, color: '#fff176' }).setVisible(false);

    // The time sits left of the music and sound buttons in the top-right corner.
    this.timeText = this.add.text(VIEW.width - 44, 4, '', TEXT).setOrigin(1, 0);

    this.solidLabel = this.add.text(3, 22, 'Solid:', { ...TEXT, fontSize: '8px', strokeThickness: 2 }).setVisible(false);
    this.solidSwatch = this.add
      .rectangle(this.solidLabel.x + this.solidLabel.width + 7, 27, 10, 10, SOLID_COLORS.orange)
      .setStrokeStyle(1, 0x10141c)
      .setVisible(false);
    this.shownSolid = null;

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
    this.roundTicks = [1, 2].map((k) => this.add.rectangle(cx - 59 + (118 * k) / 3, 38, 1, 5, 0x10141c).setOrigin(0.5, 0).setVisible(false));

    const cy = VIEW.height / 2;
    this.bannerText = this.add.text(cx, cy - 40, '', { ...TEXT, fontSize: '14px', align: 'center' }).setOrigin(0.5);
    this.pauseMenu = this.createPauseMenu(cx, cy);
    this.pauseButton = this.createPauseButton();
    this.helpText = this.add
      .text(cx, VIEW.height - 8, 'Move: Arrows/A D  Jump: Space/W  Attack: J or Z  Power: K or C  Pause: Esc', TEXT)
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
    this.pauseMenu.setVisible(s.playState === 'paused');
    // The pause button sits just left of the time; it is hidden once the level is won.
    this.pauseButton.setVisible(s.playState === 'playing' || s.playState === 'paused');
    this.pauseButton.setX(this.timeText.x - this.timeText.width - 19);
    this.updatePowers(s.powers);
    this.updateGuardian(s.guardian);
    this.updateFlipBar(s.flip, time);
    this.updateSolid(s.solidColor);
    if (s.result && !this.resultPanel) {
      this.resultPanel = this.showResult(s.result);
      this.helpText.setVisible(false);
    }
  }

  private updatePowers(p: HudState['powers']): void {
    ELEMENTS.forEach((e, i) => {
      const owned = p.owned.includes(e);
      this.powerIcons[i].setVisible(owned).setAlpha(e === p.active ? 1 : 0.55);
      this.powerDigits[i].setVisible(owned);
    });
    // "K" sits after the last owned power, as a reminder of the key that uses it.
    const last = ELEMENTS.reduce((max, e, i) => (p.owned.includes(e) ? i : max), -1);
    this.powerKeyHint.setVisible(last >= 0).setX(this.powerX + (last + 1) * POWER_SLOT);
    const active = p.active ? ELEMENTS.indexOf(p.active) : -1;
    this.powerMarker.setVisible(active >= 0);
    this.powerCooldown.setVisible(active >= 0 && p.readiness < 1);
    if (active < 0) return;
    const x = this.powerX + active * POWER_SLOT;
    this.powerMarker.setX(x);
    // The overlay covers the part that is still recharging, shrinking from the top.
    this.powerCooldown.setPosition(x, 2 + 15 * p.readiness).setSize(15, 15 * (1 - p.readiness));
  }

  /** Paused: a small panel with buttons (or keys Esc, R, Q). */
  private createPauseMenu(cx: number, cy: number): Phaser.GameObjects.Container {
    const menu = this.add.container(cx, cy).setVisible(false);
    menu.add(this.add.rectangle(0, 0, 190, 118, 0x10141c, 0.85).setStrokeStyle(2, COLORS.crown));
    menu.add(this.add.text(0, -40, 'PAUSED', { ...TEXT, fontSize: '14px' }).setOrigin(0.5));
    const options: [string, () => void][] = [
      ['Keep playing  (Esc)', () => this.gameScene().togglePause()],
      ['Restart level  (R)', () => this.gameScene().restartLevel()],
      ['World map  (Q)', () => this.gameScene().backToMap()],
    ];
    options.forEach(([label, action], i) => {
      const t = this.add.text(0, -12 + i * 20, label, TEXT).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true })
        .on('pointerover', () => t.setColor('#fff176'))
        .on('pointerout', () => t.setColor('#ffffff'))
        .on('pointerdown', () => {
          sfx.menuSelect();
          t.setColor('#ffffff');
          action();
        });
      menu.add(t);
    });
    return menu;
  }

  /** A pause button in the top bar, styled like the speaker buttons beside it. */
  private createPauseButton(): Phaser.GameObjects.Container {
    const plate = this.add.rectangle(0, 3, 15, 15, 0x10141c, 0.55).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.4);
    const bars = [this.add.rectangle(4, 6, 2, 9, 0xffffff).setOrigin(0, 0), this.add.rectangle(9, 6, 2, 9, 0xffffff).setOrigin(0, 0)];
    plate
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => plate.setFillStyle(0x10141c, 0.85))
      .on('pointerout', () => plate.setFillStyle(0x10141c, 0.55))
      .on('pointerdown', () => this.gameScene().togglePause());
    return this.add.container(0, 0, [plate, ...bars]);
  }

  private updateSolid(solid: HudState['solidColor']): void {
    this.solidLabel.setVisible(solid !== null);
    this.solidSwatch.setVisible(solid !== null);
    if (solid === null || solid === this.shownSolid) return;
    const changed = this.shownSolid !== null;
    this.shownSolid = solid;
    this.solidSwatch.setFillStyle(SOLID_COLORS[solid]);
    if (changed) this.tweens.add({ targets: this.solidSwatch, scale: { from: 1.8, to: 1 }, duration: 350, ease: 'Back.out' });
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
    for (const t of this.roundTicks) t.setVisible(!!guardian?.shield);
    if (!guardian) return;
    this.guardianName.setText(guardian.shield?.length === 0 ? `${guardian.name} - dizzy! Hit him!` : guardian.name);
    this.guardianBar.setSize(Math.max(0, 118 * guardian.health), 3);
  }

  /**
   * The flip bar, in words kids can read:
   *   between flips:  [icon] Low gravity - next flip in 7     (just "Next flip in 7" when Normal)
   *   warning:        Next: [icon] Color swap in 3            (flashing, over a soft shimmer)
   * Right after a flip the bar pops, since the big banner only explains a flip the first time.
   */
  private updateFlipBar(flip: HudState['flip'], time: number): void {
    const seconds = Math.ceil(flip.msUntilFlip / 1000);
    this.nextIcon.setVisible(flip.warning);
    this.nextText.setVisible(flip.warning);
    this.flipIcon.setVisible(!flip.warning);
    if (flip.warning) {
      const color = Math.floor(time / 200) % 2 ? '#fff176' : '#ffffff';
      this.flipText.setText('Next:').setColor(color);
      this.nextIcon.setTexture(FLIP_ICONS[flip.next]);
      this.nextText.setText(`${SHORT_FLIP[flip.next]} in ${seconds}`).setColor(color);
      this.shimmer.setFillStyle(0xffffff, 0.03 + 0.03 * Math.sin(time / 60));
    } else {
      this.flipIcon.setTexture(FLIP_ICONS[flip.state]);
      const label = flip.state === 'normal' ? 'Next flip in' : `${SHORT_FLIP[flip.state]} · flip in`;
      this.flipText.setText(`${label} ${seconds}`).setColor(flip.sinceFlipMs < 1500 ? '#fff176' : '#ffffff');
      this.shimmer.setFillStyle(0xffffff, 0);
    }
    // A short pop right after a flip.
    const pop = flip.sinceFlipMs < 400 ? 1 + 0.3 * (1 - flip.sinceFlipMs / 400) : 1;
    this.flipIcon.setScale(pop);
    // Lay the pieces out left to right, centered on the screen.
    const gap = 4;
    const parts: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text; w: number }[] = [];
    if (!flip.warning) parts.push({ obj: this.flipIcon, w: this.flipIcon.width });
    parts.push({ obj: this.flipText, w: this.flipText.width });
    if (flip.warning) {
      parts.push({ obj: this.nextIcon, w: this.nextIcon.width }, { obj: this.nextText, w: this.nextText.width });
    }
    let x = FLIP_BAR_CENTER - parts.reduce((sum, p) => sum + p.w + gap, -gap) / 2;
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
