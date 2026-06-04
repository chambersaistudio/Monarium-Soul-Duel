import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  damage: number = 0;
  ownerId: string = '';
  active: boolean = false;
  lifetime: number = 2000;
  private elapsed: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  fire(
    x: number, y: number,
    velX: number, velY: number,
    damage: number,
    ownerId: string,
    color: number,
    radius: number
  ): void {
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    this.damage = damage;
    this.ownerId = ownerId;
    this.elapsed = 0;
    this.lifetime = 2000;

    // Draw circular projectile texture
    const g = this.scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(radius, radius, radius);
    const key = `proj_${color}_${radius}`;
    if (!this.scene.textures.exists(key)) {
      g.generateTexture(key, radius * 2, radius * 2);
    }
    g.destroy();
    this.setTexture(key);
    this.setDisplaySize(radius * 2, radius * 2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(velX, velY);
    body.setCircle(radius);
  }

  update(delta: number): void {
    if (!this.active) return;
    this.elapsed += delta;
    if (this.elapsed >= this.lifetime || !Phaser.Geom.Rectangle.Overlaps(
      this.scene.physics.world.bounds,
      this.getBounds()
    )) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }
}
