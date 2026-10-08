// The castle door (spec): it shows four slots that fill as powers are earned, and opens only for
// a hero who has all four.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { TILE } from '../config';
import { POWER_ICONS } from '../gfx/placeholderTextures';
import { SHEETS } from '../gfx/sprites';
import type { Point } from '../systems/CheckpointTracker';
import { ELEMENTS, type Element } from '../systems/powers';

/** Kenney's wooden door: top and bottom halves. */
const DOOR_TOP = 130;
const DOOR_BOTTOM = 150;

export class BossDoor extends Phaser.GameObjects.Zone {
  declare body: Phaser.Physics.Arcade.StaticBody;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private opened = false;

  constructor(scene: Phaser.Scene, at: Point, owned: readonly Element[]) {
    super(scene, at.x, at.y - TILE, TILE, TILE * 2);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    const top = scene.add.image(at.x, at.y - TILE * 1.5, SHEETS.tiles, DOOR_TOP);
    const bottom = scene.add.image(at.x, at.y - TILE * 0.5, SHEETS.tiles, DOOR_BOTTOM);
    this.parts.push(top, bottom);
    // Four slots in a row in front of the wall above the door.
    ELEMENTS.forEach((e, i) => {
      const x = at.x - 21 + i * 14;
      const y = at.y - TILE * 2 - 10;
      this.parts.push(scene.add.rectangle(x, y, 12, 12, 0x10141c, 0.8).setStrokeStyle(1, 0xffffff).setDepth(3));
      if (owned.includes(e)) this.parts.push(scene.add.image(x, y, POWER_ICONS[e]).setDepth(3));
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Swings open: the door fades away and stops blocking. */
  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.body.enable = false;
    sfx.powerUp();
    this.scene.tweens.add({ targets: this.parts.slice(0, 2), alpha: 0, y: '-=8', duration: 500 });
  }
}
