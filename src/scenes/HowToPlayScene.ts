// How to Play: six short pages, each with a little looping scene acted out by the game's own sprites
// (moving and jumping, attacking and stomping, the flips, powers, hearts and stars, the boss).
// Left / Right or the buttons turn the pages; Esc goes back to the menu.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, HERO, VIEW } from '../config';
import { FLIP_ICONS, POWER_ICONS, TEXTURES } from '../gfx/placeholderTextures';
import { HERO_LOOKS, LOOKS, SHEETS, TILE_FRAMES, FLAG_ANIM, type HeroLook } from '../gfx/sprites';
import type { FlipState } from '../systems/flips';
import { ELEMENTS, type Element } from '../systems/powers';
import { puff } from '../weapons/projectiles';
import { ASSETS, SCENES } from './keys';

const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#10141c',
  strokeThickness: 3,
  align: 'center',
};

/** The floor of every little scene (top of the grass). */
const GROUND_Y = 180;
const TILE_GRASS = 22;
const TILE_DIRT = 122;
const TILE_CRATE = 26;
const SHORT_FLIP: Record<FlipState, string> = {
  normal: 'Normal',
  lowGravity: 'Low gravity',
  colorSwap: 'Color swap',
  friendFoe: 'Friend/foe',
  upsideDown: 'Upside-down',
};
const PROJECTILE: Record<Element, { texture: string; tint?: number }> = {
  fire: { texture: TEXTURES.fireball },
  water: { texture: TEXTURES.wave },
  snow: { texture: TEXTURES.snowball },
  wind: { texture: TEXTURES.wave, tint: 0xb2ebf2 },
};
const ELEMENT_COLOR: Record<Element, number> = { fire: 0xff7043, water: 0x4fc3f7, snow: 0xf5fbff, wind: 0x80deea };

interface Page {
  title: string;
  /** How long one run of the little scene takes before it starts again. */
  loopMs: number;
  play: () => void;
}

export class HowToPlayScene extends Phaser.Scene {
  private pages: Page[] = [];
  private index = 0;
  /** Everything belonging to the current page's scene, removed when it restarts or the page turns. */
  private demo: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private captionText!: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    // The scene clock only catches up on the next frame; the scenes' timers need the real time now.
    this.time.now = this.game.loop.now;
    this.cameras.main.setBackgroundColor(COLORS.sky);
    // Frames for our own block tiles (orange is the 3rd tile on the sheet, blue the 4th).
    const blocks = this.textures.get(ASSETS.blockTiles);
    if (!blocks.has('orange')) blocks.add('orange', 0, 36, 0, 18, 18);
    if (!blocks.has('blue')) blocks.add('blue', 0, 54, 0, 18, 18);

    this.pages = [
      { title: 'Move and jump', loopMs: 7000, play: () => this.pageMove() },
      { title: 'Attack and stomp', loopMs: 7500, play: () => this.pageAttack() },
      { title: 'The world flips!', loopMs: 20000, play: () => this.pageFlips() },
      { title: 'Powers', loopMs: 10000, play: () => this.pagePowers() },
      { title: 'Hearts, flags and stars', loopMs: 9000, play: () => this.pageHearts() },
      { title: 'The Shifting King', loopMs: 11000, play: () => this.pageBoss() },
    ];
    const cx = VIEW.width / 2;
    this.titleText = this.add.text(cx, 16, '', { ...TEXT, fontSize: '16px' }).setOrigin(0.5);
    // A soft panel the little scenes play on.
    this.add.rectangle(cx, 126, VIEW.width - 24, 160, 0xffffff, 0.18).setStrokeStyle(1, 0xffffff, 0.5);
    this.captionText = this.add.text(cx, 226, '', { ...TEXT, fontSize: '9px', lineSpacing: 3 }).setOrigin(0.5, 0.5);

    this.dots = this.pages.map((_, i) => this.add.circle(cx - (this.pages.length - 1) * 6 + i * 12, 257, 3, 0xffffff));
    this.button(40, 257, '< Back', () => this.turn(-1));
    this.button(VIEW.width - 40, 257, 'Next >', () => this.turn(1));
    const menu = this.add.text(cx, 36, 'Esc: menu', { ...TEXT, fontSize: '8px', strokeThickness: 2 }).setOrigin(0.5);
    menu.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leave());

    const kb = this.input.keyboard!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.removeAllListeners());
    for (const key of ['LEFT', 'A']) kb.on(`keydown-${key}`, () => this.turn(-1));
    for (const key of ['RIGHT', 'D', 'ENTER', 'SPACE']) kb.on(`keydown-${key}`, () => this.turn(1));
    kb.on('keydown-ESC', () => this.leave());
    this.index = 0;
    this.showPage();
  }

  // ---- Pages ----

  private pageMove(): void {
    this.caption('Move: Arrow keys or A / D\nJump: Space, W or Up  (hold it to jump higher)\nFind the crown at the end of every world!');
    this.ground(30, 210);
    this.ground(282, 450);
    const crown = this.track(this.add.image(420, GROUND_Y - 10, TEXTURES.crown));
    this.bob(crown);
    const hero = this.hero(HERO_LOOKS.knight, 60);
    this.at(300, () => this.walk(hero, HERO_LOOKS.knight, 196, 1500));
    this.at(1900, () => this.jump(hero, HERO_LOOKS.knight, 300, 60, 800));
    this.at(2800, () => this.walk(hero, HERO_LOOKS.knight, 412, 1300));
    this.at(4150, () => {
      sfx.crown();
      puff(this, crown.x, crown.y, COLORS.crown, 10);
      crown.setVisible(false);
    });
  }

  private pageAttack(): void {
    this.caption('Attack: J or Z   (Ranger: hold it to charge a strong arrow)\nStomp: land on an enemy to bop it and bounce off\nBut touching an enemy from the side hurts!');
    this.ground(30, 450);
    const look = HERO_LOOKS.knight;
    const hero = this.hero(look, 60);
    const first = this.creature(LOOKS.walker, 180);
    const second = this.creature(LOOKS.walker, 340);
    this.at(300, () => this.walk(hero, look, 150, 1000));
    this.at(1400, () => this.attack(hero, look));
    this.at(1550, () => this.hitAndPoof(first));
    this.at(2300, () => this.walk(hero, look, 280, 1100));
    this.at(3450, () => this.jumpTo(hero, look, 340, GROUND_Y - 12, 600));
    this.at(4050, () => {
      sfx.bounce();
      second.setTintFill(0xffffff);
      this.tweens.add({ targets: second, scaleY: 0.6, duration: 80, yoyo: true });
      this.at(120, () => second.clearTint());
      this.jumpTo(hero, look, 400, GROUND_Y, 800, 50);
    });
    this.at(4100, () => this.label(340, GROUND_Y - 40, 'Stomp!'));
  }

  /** Each flip in turn, acted out: low gravity, color swap, friend/foe, upside-down. */
  private pageFlips(): void {
    this.ground(30, 450);
    const look = HERO_LOOKS.ranger;
    const hero = this.hero(look, 120);
    const bar = this.flipBar();
    const intro = 'The rules change every few seconds. The top bar warns you what comes next.';
    const segment = (start: number, flip: FlipState, text: string, act: () => void) => {
      for (let n = 3; n >= 1; n--) this.at(start + (3 - n) * 600, () => bar(`Next: ${SHORT_FLIP[flip]} in ${n}`, flip));
      this.at(start + 1800, () => {
        bar(SHORT_FLIP[flip], flip);
        this.flash();
        sfx.flip();
        this.caption(`${intro}\n${text}`);
        act();
      });
    };
    this.caption(`${intro}\n `);

    segment(200, 'lowGravity', 'Low gravity: jumps go much higher, and you float down slowly.', () => {
      this.at(300, () => this.jump(hero, look, 200, 110, 2400));
    });

    // Color swap: only one color of block is solid at a time.
    const orange = [0, 1, 2].map((i) => this.track(this.add.image(260 + i * 18, 140, ASSETS.blockTiles, 'orange').setOrigin(0, 0)));
    const blue = [0, 1, 2].map((i) => this.track(this.add.image(330 + i * 18, 110, ASSETS.blockTiles, 'blue').setOrigin(0, 0).setAlpha(COLORS.ghostAlpha)));
    segment(5000, 'colorSwap', 'Color swap: the see-through blocks turn solid, and the solid ones fade away.', () => {
      for (const b of blue) this.tweens.add({ targets: b, alpha: { from: COLORS.ghostAlpha, to: 1 }, duration: 110, repeat: 2, ease: 'Stepped' });
      for (const o of orange) this.tweens.add({ targets: o, alpha: COLORS.ghostAlpha, duration: 360 });
      this.at(600, () => this.walk(hero, look, 300, 700));
      this.at(1400, () => this.jumpTo(hero, look, 357, 110, 900));
    });

    // Friend/foe: enemies turn calm (a heart), mushrooms turn angry.
    this.at(10000, () => {
      for (const b of [...orange, ...blue]) b.setVisible(false);
      hero.setPosition(120, GROUND_Y).setFrame(look.idle);
    });
    const walker = this.creature(LOOKS.walker, 250);
    walker.setVisible(false);
    const mushroom = this.track(this.add.sprite(380, GROUND_Y, SHEETS.tiles, TILE_FRAMES.mushroom).setOrigin(0.5, 1).setVisible(false));
    this.at(10100, () => {
      walker.setVisible(true);
      mushroom.setVisible(true);
    });
    segment(10200, 'friendFoe', 'Friend/foe: enemies turn friendly (a heart): bounce on them! Mushrooms bite.', () => {
      walker.setTint(COLORS.enemyCalm);
      mushroom.setTint(COLORS.friendHostile);
      this.marker(walker, TEXTURES.markHeart);
      this.marker(mushroom, TEXTURES.markAngry);
      this.tweens.add({ targets: mushroom, y: GROUND_Y - 12, duration: 250, yoyo: true, repeat: 4, repeatDelay: 300, ease: 'Sine.out' });
      this.at(400, () => this.walk(hero, look, 200, 700));
      this.at(1100, () => this.jumpTo(hero, look, 250, GROUND_Y - 12, 550));
      this.at(1650, () => {
        sfx.bounce();
        this.jumpTo(hero, look, 300, GROUND_Y, 800, 60);
      });
    });

    // Upside-down: gravity pulls up, so the hero walks on the ceiling.
    segment(15000, 'upsideDown', 'Upside-down: gravity pulls up, so you walk on the ceiling!', () => {
      walker.setVisible(false);
      mushroom.setVisible(false);
      this.demo.filter((o) => o.getData('marker')).forEach((o) => (o as Phaser.GameObjects.Image).setVisible(false));
      this.ceiling(30, 450);
      hero.setFlipY(true).setFrame(look.fall);
      this.tweens.add({ targets: hero, y: 104 + 36, duration: 600, ease: 'Quad.in' });
      this.at(700, () => {
        hero.setFrame(look.idle);
        this.walk(hero, look, 380, 1600);
      });
    });
  }

  private pagePowers(): void {
    this.caption('Beat each world\'s guardian to earn its power: Fire, Water, Snow, Wind\nTap K or C: use it    1 2 3 4: switch powers\nHold K and press J: a powered attack    Wind also gives a double jump');
    this.ground(30, 450);
    ELEMENTS.forEach((e, i) => {
      const x = 186 + i * 36;
      this.track(this.add.image(x, 72, POWER_ICONS[e]).setScale(2));
      this.track(this.add.text(x, 90, String(i + 1), { ...TEXT, fontSize: '9px', strokeThickness: 2 }).setOrigin(0.5, 0));
    });
    const look = HERO_LOOKS.knight;
    const hero = this.hero(look, 70);
    const crates = [0, 1].map((i) => this.track(this.add.image(330, GROUND_Y - 18 - i * 18, SHEETS.tiles, TILE_CRATE).setOrigin(0.5, 0)));
    // Tap K: a fireball bounces along and burns the crates.
    this.at(500, () => {
      this.attack(hero, look);
      this.label(hero.x, GROUND_Y - 46, 'K');
      const ball = this.track(this.add.image(hero.x + 14, GROUND_Y - 14, TEXTURES.fireball));
      sfx.fireball();
      this.tweens.add({ targets: ball, x: 318, duration: 900 });
      this.tweens.add({ targets: ball, y: GROUND_Y - 30, duration: 225, yoyo: true, repeat: 1, ease: 'Sine.out' });
      this.at(900, () => {
        ball.destroy();
        for (const c of crates) {
          puff(this, c.x, c.y + 9, 0xff7043, 8);
          c.destroy();
        }
        sfx.crateBurn();
      });
    });
    // Hold K + J: a flaming sword swing.
    this.at(2600, () => this.walk(hero, look, 200, 1100));
    // The next enemy walks in once the fireball is gone.
    const enemy = this.creature(LOOKS.walker, 236).setAlpha(0);
    this.at(1800, () => this.tweens.add({ targets: enemy, alpha: 1, duration: 300 }));
    this.at(3900, () => {
      this.label(hero.x, GROUND_Y - 46, 'K + J');
      hero.setTint(0xff9e6b);
      this.attack(hero, look);
      this.at(150, () => {
        puff(this, enemy.x, enemy.y - 8, 0xff7043, 8);
        this.hitAndPoof(enemy);
      });
      this.at(600, () => hero.clearTint());
    });
    // Wind: a second jump in mid-air.
    this.at(5600, () => {
      this.jump(hero, look, 300, 50, 700);
      this.at(380, () => {
        this.label(hero.x, hero.y - 44, 'Jump again!');
        puff(this, hero.x, hero.y, 0xb2ebf2, 8);
        sfx.doubleJump();
        this.tweens.killTweensOf(hero);
        this.jump(hero, look, 400, 60, 900);
      });
    });
  }

  private pageHearts(): void {
    const look = HERO_LOOKS.ranger;
    this.caption(`You have ${HERO.maxHearts} hearts. Lose them all and you start again from the last flag.\nTouch a flag to make it your checkpoint.\nStars: 1 for the crown, 2 if you're quick, 3 if you're quick and never get hurt.`);
    this.ground(30, 450);
    const hearts = Array.from({ length: HERO.maxHearts }, (_, i) =>
      this.track(this.add.image(36 + i * 15, 64, SHEETS.tiles, TILE_FRAMES.heartFull).setOrigin(0, 0)),
    );
    const flag = this.track(this.add.sprite(250, GROUND_Y, SHEETS.tiles, TILE_FRAMES.flag).setOrigin(0.5, 1).setTint(COLORS.checkpointOff));
    const hero = this.hero(look, 60);
    this.creature(LOOKS.walker, 150);
    this.at(300, () => this.walk(hero, look, 130, 900));
    this.at(1200, () => {
      sfx.hurt();
      hearts[HERO.maxHearts - 1].setFrame(TILE_FRAMES.heartEmpty);
      hero.setTint(0xff6666);
      this.tweens.add({ targets: hero, x: 100, duration: 200 });
      this.tweens.add({ targets: hero, alpha: 0.3, duration: 100, yoyo: true, repeat: 5, onComplete: () => hero.setAlpha(1).clearTint() });
      this.label(130, GROUND_Y - 44, 'Ouch!');
    });
    this.at(2600, () => this.jump(hero, look, 190, 50, 800));
    this.at(3500, () => this.walk(hero, look, 234, 550));
    this.at(4100, () => {
      sfx.checkpoint();
      flag.clearTint().play(FLAG_ANIM);
      this.label(250, GROUND_Y - 34, 'Checkpoint!');
    });
    this.at(5200, () => {
      for (let i = 0; i < 3; i++) {
        const star = this.track(this.add.image(330 + i * 30, 100, TEXTURES.starFull).setScale(0));
        this.tweens.add({ targets: star, scale: 2, delay: 250 * i, duration: 250, ease: 'Back.out' });
        this.at(250 * i, () => sfx.star(i));
      }
    });
  }

  private pageBoss(): void {
    this.caption('The Shifting King wears a shield of four pieces. Each breaks only with its\nown power: pick it with 1 2 3 4, then tap K. Break all four before the next\nflip, or they grow back! Then hit him with your sword or arrows.');
    this.ground(30, 450);
    const look = HERO_LOOKS.knight;
    const hero = this.hero(look, 80);
    const king = this.track(this.add.sprite(360, GROUND_Y, SHEETS.characters, LOOKS.king.frames[0]).setOrigin(0.5, 1).setScale(2).setFlipX(false));
    king.play(LOOKS.king.walkAnim);
    const orbs = ELEMENTS.map((e, i) => {
      const angle = -Math.PI / 2 + (i - 1.5) * 0.6;
      const orb = this.track(
        this.add.container(king.x + Math.cos(angle) * 40 - 10, GROUND_Y - 30 + Math.sin(angle) * 40, [
          this.add.circle(0, 0, 8, 0x10141c, 0.85).setStrokeStyle(2, ELEMENT_COLOR[e]),
          this.add.image(0, 0, POWER_ICONS[e]),
        ]),
      );
      return orb;
    });
    ELEMENTS.forEach((e, i) => {
      const t = 600 + i * 1500;
      this.at(t, () => {
        this.label(hero.x, GROUND_Y - 46, `${i + 1} then K`);
        this.attack(hero, look);
        const p = PROJECTILE[e];
        const shot = this.track(this.add.image(hero.x + 14, GROUND_Y - 16, p.texture));
        if (p.tint) shot.setTint(p.tint);
        this.tweens.add({ targets: shot, x: orbs[i].x, y: orbs[i].y, duration: 700 });
        this.at(700, () => {
          shot.destroy();
          puff(this, orbs[i].x, orbs[i].y, ELEMENT_COLOR[e], 8);
          orbs[i].setVisible(false);
          sfx.shatter();
        });
      });
    });
    this.at(6800, () => this.label(king.x, GROUND_Y - 70, 'Shield down!'));
    this.at(7300, () => this.walk(hero, look, 318, 1200));
    for (let k = 0; k < 3; k++) {
      this.at(8600 + k * 450, () => {
        this.attack(hero, look);
        this.at(120, () => {
          sfx.hit();
          king.setTintFill(0xffffff);
          this.at(90, () => king.clearTint());
        });
      });
    }
  }

  // ---- Little helpers for the scenes ----

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.demo.push(o);
    return o;
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  private caption(text: string): void {
    this.captionText.setText(text);
  }

  private ground(x1: number, x2: number): void {
    for (let x = x1; x < x2; x += 18) {
      this.track(this.add.image(x, GROUND_Y, SHEETS.tiles, TILE_GRASS).setOrigin(0, 0));
      this.track(this.add.image(x, GROUND_Y + 18, SHEETS.tiles, TILE_DIRT).setOrigin(0, 0).setCrop(0, 0, 18, 8));
    }
  }

  private ceiling(x1: number, x2: number): void {
    for (let x = x1; x < x2; x += 18) {
      this.track(this.add.image(x, 86, SHEETS.tiles, TILE_GRASS).setOrigin(0, 0).setFlipY(true));
    }
  }

  private hero(look: HeroLook, x: number): Phaser.GameObjects.Sprite {
    return this.track(this.add.sprite(x, GROUND_Y, look.sheet, look.idle).setOrigin(0.5, 1).setDepth(2));
  }

  private creature(look: (typeof LOOKS)[keyof typeof LOOKS], x: number): Phaser.GameObjects.Sprite {
    return this.track(this.add.sprite(x, GROUND_Y, look.sheet, look.frames[0]).setOrigin(0.5, 1).play(look.walkAnim));
  }

  private walk(s: Phaser.GameObjects.Sprite, look: HeroLook, toX: number, ms: number): void {
    s.setFlipX(toX < s.x).play(look.walkAnim);
    this.tweens.add({ targets: s, x: toX, duration: ms, onComplete: () => s.stop().setFrame(look.idle) });
  }

  /** A jump in an arc to `toX` that lands back on the floor. */
  private jump(s: Phaser.GameObjects.Sprite, look: HeroLook, toX: number, height: number, ms: number): void {
    const floor = s.y;
    s.stop().setFrame(look.jump).setFlipX(toX < s.x);
    this.tweens.add({ targets: s, x: toX, duration: ms });
    this.tweens.add({
      targets: s,
      y: floor - height,
      duration: ms / 2,
      ease: 'Sine.out',
      yoyo: true,
      onYoyo: () => s.setFrame(look.fall),
      onComplete: () => s.setFrame(look.idle),
    });
  }

  /** A jump that lands on a higher (or lower) spot `landY`, rising `rise` above the higher of the two. */
  private jumpTo(s: Phaser.GameObjects.Sprite, look: HeroLook, toX: number, landY: number, ms: number, rise = 30): void {
    const peak = Math.min(s.y, landY) - rise;
    s.stop().setFrame(look.jump).setFlipX(toX < s.x);
    this.tweens.add({ targets: s, x: toX, duration: ms });
    this.tweens.chain({
      targets: s,
      tweens: [
        { y: peak, duration: ms / 2, ease: 'Sine.out' },
        { y: landY, duration: ms / 2, ease: 'Sine.in', onStart: () => s.setFrame(look.fall), onComplete: () => s.setFrame(look.idle) },
      ],
    });
  }

  private attack(s: Phaser.GameObjects.Sprite, look: HeroLook): void {
    s.play(look.attackAnim);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.setFrame(look.idle));
    sfx.swing();
  }

  private hitAndPoof(target: Phaser.GameObjects.Sprite): void {
    sfx.hit();
    target.setTintFill(0xffffff);
    this.tweens.add({ targets: target, alpha: 0, scale: 1.5, duration: 220, onComplete: () => target.setVisible(false) });
  }

  private label(x: number, y: number, text: string): void {
    const t = this.track(this.add.text(x, y, text, { ...TEXT, fontSize: '9px', color: '#fff176' }).setOrigin(0.5).setDepth(5));
    this.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: 700, duration: 700 });
  }

  private bob(o: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: o, y: o.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** A mood icon over a creature, like the ones in the game. */
  private marker(owner: Phaser.GameObjects.Sprite, texture: string): void {
    const m = this.track(this.add.image(owner.x, owner.y - owner.displayHeight - 4, texture).setData('marker', true));
    this.tweens.add({ targets: m, y: m.y - 2, duration: 400, yoyo: true, repeat: -1 });
    // Follow a hopping mushroom.
    const follow = () => m.active && m.setY(owner.y - owner.displayHeight - 4);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    m.once(Phaser.GameObjects.Events.DESTROY, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow));
  }

  /** A copy of the game's top flip bar, above the little scene. Returns a function that sets its text. */
  private flipBar(): (text: string, flip: FlipState) => void {
    const icon = this.track(this.add.image(0, 64, FLIP_ICONS.normal).setOrigin(0, 0.5));
    const text = this.track(this.add.text(0, 64, '', { ...TEXT, fontSize: '10px' }).setOrigin(0, 0.5));
    return (s, flip) => {
      icon.setTexture(FLIP_ICONS[flip]);
      text.setText(s).setColor(s.startsWith('Next') ? '#fff176' : '#ffffff');
      const width = icon.width + 4 + text.width;
      icon.setX(VIEW.width / 2 - width / 2);
      text.setX(icon.x + icon.width + 4);
    };
  }

  private flash(): void {
    const f = this.track(this.add.rectangle(VIEW.width / 2, 126, VIEW.width - 24, 160, 0xffffff, 0.8).setDepth(4));
    this.tweens.add({ targets: f, alpha: 0, duration: 300 });
  }

  // ---- Pages and navigation ----

  private showPage(): void {
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    this.tweens.killTweensOf(this.demo);
    for (const o of this.demo) o.destroy();
    this.demo = [];
    const page = this.pages[this.index];
    this.titleText.setText(`${page.title}   (${this.index + 1}/${this.pages.length})`);
    this.dots.forEach((d, i) => d.setFillStyle(i === this.index ? COLORS.crown : 0xffffff, i === this.index ? 1 : 0.5));
    page.play();
    // Play the little scene again and again.
    this.timers.push(this.time.delayedCall(page.loopMs, () => this.showPage()));
  }

  private turn(d: number): void {
    const next = this.index + d;
    if (next < 0 || next >= this.pages.length) {
      if (next >= this.pages.length) this.leave();
      return;
    }
    sfx.menuMove();
    this.index = next;
    this.showPage();
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const t = this.add.text(x, y, label, TEXT).setOrigin(0.5);
    t.setInteractive({ useHandCursor: true })
      .on('pointerover', () => t.setColor('#fff176'))
      .on('pointerout', () => t.setColor('#ffffff'))
      .on('pointerdown', onClick);
  }

  private leave(): void {
    sfx.menuSelect();
    this.scene.start(SCENES.menu);
  }
}
