// Two speaker buttons in the top-right corner of every screen: music on/off and sound effects on/off.
// This scene runs the whole time, drawn above all the others. Keys: M for music, X for sound effects.
import Phaser from 'phaser';
import { music } from '../audio/music';
import { soundSettings } from '../audio/settings';
import { toggleSfx } from '../audio/sfx';
import { VIEW } from '../config';
import { SCENES } from './keys';

const ICONS = {
  musicOn: 'ui-music-on',
  musicOff: 'ui-music-off',
  sfxOn: 'ui-sfx-on',
  sfxOff: 'ui-sfx-off',
} as const;

// 13 x 11 pixel icons: a speaker, with a music note (music) or sound waves (effects); a red X when off.
const SPEAKER_MUSIC_ON = [
  '..........ww.',
  '....w.....w.w',
  '...ww.....w..',
  '..www.....w..',
  'wwwww.....w..',
  'wwwww...www..',
  'wwwww..wwww..',
  '..www..www...',
  '...ww........',
  '....w........',
  '.............',
];
const SPEAKER_SFX_ON = [
  '.........w...',
  '....w..w..w..',
  '...ww...w..w.',
  '..www.w..w.w.',
  'wwwww..w.w..w',
  'wwwww..w.w..w',
  'wwwww..w.w..w',
  '..www.w..w.w.',
  '...ww...w..w.',
  '....w..w..w..',
  '.........w...',
];
const SPEAKER_OFF = [
  '.............',
  '....w........',
  '...ww........',
  '..www..r...r.',
  'wwwww...r.r..',
  'wwwww....r...',
  'wwwww...r.r..',
  '..www..r...r.',
  '...ww........',
  '....w........',
  '.............',
];

function draw(scene: Phaser.Scene, key: string, rows: string[]): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle(ch === 'r' ? 0xff5252 : 0xffffff, 1);
      g.fillRect(x, y, 1, 1);
    }),
  );
  g.generateTexture(key, rows[0].length, rows.length);
  g.destroy();
}

export class UiScene extends Phaser.Scene {
  private musicButton!: Phaser.GameObjects.Image;
  private sfxButton!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.ui);
  }

  create(): void {
    draw(this, ICONS.musicOn, SPEAKER_MUSIC_ON);
    draw(this, ICONS.musicOff, SPEAKER_OFF);
    draw(this, ICONS.sfxOn, SPEAKER_SFX_ON);
    draw(this, ICONS.sfxOff, SPEAKER_OFF);

    const y = 3;
    this.musicButton = this.button(VIEW.width - 36, y, () => music.toggle());
    this.sfxButton = this.button(VIEW.width - 17, y, () => toggleSfx());
    this.refresh();

    // The keys work everywhere too.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'm' || e.key === 'M') {
        music.toggle();
        this.refresh();
      } else if (e.key === 'x' || e.key === 'X') {
        toggleSfx();
        this.refresh();
      }
    });
  }

  private button(x: number, y: number, onClick: () => void): Phaser.GameObjects.Image {
    // A small dark plate behind each icon keeps it readable on any background.
    const plate = this.add.rectangle(x, y, 17, 15, 0x10141c, 0.55).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.4);
    const icon = this.add.image(x + 2, y + 2, ICONS.musicOn).setOrigin(0, 0);
    plate
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => plate.setFillStyle(0x10141c, 0.85))
      .on('pointerout', () => plate.setFillStyle(0x10141c, 0.55))
      .on('pointerdown', () => {
        onClick();
        this.refresh();
      });
    return icon;
  }

  private refresh(): void {
    this.musicButton.setTexture(soundSettings.music ? ICONS.musicOn : ICONS.musicOff);
    this.sfxButton.setTexture(soundSettings.sfx ? ICONS.sfxOn : ICONS.sfxOff);
  }
}
