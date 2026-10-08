// The ending (spec): the crown, a thank-you, and the total stars earned across all the worlds.
import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { VIEW } from '../config';
import { TEXTURES } from '../gfx/placeholderTextures';
import { HERO_LOOKS } from '../gfx/sprites';
import type { HeroKind } from '../hero/Hero';
import { LEVELS } from '../level/levels';
import { saveGame } from '../saveGame';
import { SCENES } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

const CONFETTI = [0xff7043, 0x4fc3f7, 0xffffff, 0x80deea, 0xffd23f, 0xb388ff];

export class EndingScene extends Phaser.Scene {
  constructor() {
    super(SCENES.ending);
  }

  create(data: { hero?: HeroKind }): void {
    const cx = VIEW.width / 2;
    this.cameras.main.setBackgroundColor(0x2a1f4a);
    music.play('ending');
    sfx.crown();

    // Confetti in the four power colors (and gold).
    for (let i = 0; i < 70; i++) {
      const p = this.add.rectangle(Phaser.Math.Between(0, VIEW.width), Phaser.Math.Between(-300, -10), 3, 5, CONFETTI[i % CONFETTI.length]);
      this.tweens.add({
        targets: p,
        y: VIEW.height + 20,
        x: p.x + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(2500, 5000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 2500),
      });
    }

    const look = HERO_LOOKS[data.hero ?? saveGame.current.hero];
    const hero = this.add.sprite(cx, 150, look.sheet, look.idle).setOrigin(0.5, 1).setScale(3);
    const crown = this.add.image(cx, -20, TEXTURES.crown).setScale(2);
    // The crown floats down onto the hero's head.
    this.tweens.add({ targets: crown, y: hero.y - hero.displayHeight - 4, duration: 1800, ease: 'Sine.out' });

    this.add.text(cx, 22, 'YOU WON THE CROWN!', { ...TEXT, fontSize: '20px', color: '#ffd23f', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(cx, 166, 'The Shifting King is beaten and the worlds are calm again.', TEXT).setOrigin(0.5);

    // Total of the best stars in every world.
    const save = saveGame.current;
    const total = LEVELS.reduce((sum, l) => sum + (save.levels[l.id]?.bestStars ?? 0), 0);
    const max = LEVELS.length * 3;
    this.add.image(cx - 34, 192, TEXTURES.starFull).setScale(2);
    this.add.text(cx - 18, 192, `${total} of ${max} stars`, { ...TEXT, fontSize: '14px' }).setOrigin(0, 0.5);
    this.add
      .text(cx, 216, total === max ? 'Every star! A true champion!' : 'Replay worlds to earn every star', TEXT)
      .setOrigin(0.5);

    this.add.text(cx, 240, 'A game by Mohamed Samir and Mariam Mohamed Samir', { ...TEXT, color: '#e0e0e0' }).setOrigin(0.5);
    const hint = this.add.text(cx, VIEW.height - 10, 'Press Enter', TEXT).setOrigin(0.5).setAlpha(0);
    this.time.delayedCall(2000, () => {
      hint.setAlpha(1);
      const kb = this.input.keyboard!;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
      for (const key of ['ENTER', 'SPACE', 'ESC']) kb.on(`keydown-${key}`, () => this.scene.start(SCENES.menu));
    });
  }
}
