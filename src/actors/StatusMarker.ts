// A small icon bobbing over a creature's head that shows its mood: a heart over calm enemies
// (friend/foe swap), an angry mark over hostile mushrooms, a water drop over a thirsty seed pod.
import Phaser from 'phaser';
import type { GravityDir } from '../systems/flips';

export class StatusMarker {
  private readonly image: Phaser.GameObjects.Image;

  constructor(
    private readonly owner: Phaser.GameObjects.Image & { body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody },
    texture: string,
    private readonly gravity: () => GravityDir = () => 1,
  ) {
    const scene = owner.scene;
    this.image = scene.add.image(owner.x, owner.y, texture).setDepth(owner.depth + 1).setVisible(false);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    owner.once(Phaser.GameObjects.Events.DESTROY, () => this.destroy());
  }

  set visible(on: boolean) {
    this.image.setVisible(on);
    if (on) this.follow();
  }

  private follow(): void {
    if (!this.image.visible || !this.owner.active) return;
    const b = this.owner.body;
    const bob = Math.sin(this.owner.scene.time.now / 180) * 1.5;
    // "Above the head" is below the creature when the world is upside-down.
    const up = this.gravity() > 0;
    const y = up ? b.top - 7 + bob : b.bottom + 7 - bob;
    this.image.setPosition(Math.round(b.center.x), Math.round(y)).setFlipY(!up);
  }

  destroy(): void {
    this.owner.scene?.events.off(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    this.image.destroy();
  }
}
