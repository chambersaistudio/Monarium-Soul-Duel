import Phaser from 'phaser';

export class OverworldPlayer extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private phBody!: Phaser.Physics.Arcade.Body;
  readonly speed = 180;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 0, 28, 10, 0x000000, 0.3);
    scene.add.existing(this.shadow);

    this.gfx = scene.add.graphics();
    this.drawCharacter(1);
    this.add(this.gfx);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.phBody = this.body as Phaser.Physics.Arcade.Body;
    this.phBody.setCollideWorldBounds(true);
    this.phBody.setSize(28, 44);
    this.phBody.setOffset(-14, -22);
    this.phBody.setGravityY(0);

    this.setDepth(5);
  }

  private drawCharacter(facing: number): void {
    const g = this.gfx;
    g.clear();
    // Amari: purple/dark character
    g.fillStyle(0x6633aa, 1);
    g.fillRoundedRect(-12, -20, 24, 32, 6);
    // Head
    g.fillStyle(0x9955dd, 1);
    g.fillCircle(0, -26, 12);
    // Hair accent
    g.fillStyle(0x221133, 1);
    g.fillTriangle(-8, -34, 8, -34, facing * 4, -20);
    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(facing * 4, -27, 3);
    g.fillStyle(0x220033, 1);
    g.fillCircle(facing * 4, -27, 1.5);
    // Legs
    g.fillStyle(0x221133, 1);
    g.fillRoundedRect(-10, 10, 9, 14, 3);
    g.fillRoundedRect(1, 10, 9, 14, 3);
  }

  move(dx: number, dy: number): void {
    this.phBody.setVelocity(dx * this.speed, dy * this.speed);
    if (dx !== 0) this.drawCharacter(dx > 0 ? 1 : -1);
  }

  stopMove(): void {
    this.phBody.setVelocity(0, 0);
  }

  update(): void {
    this.shadow.setPosition(this.x, this.y + 26);
  }

  override destroy(): void {
    this.shadow.destroy();
    super.destroy();
  }
}
