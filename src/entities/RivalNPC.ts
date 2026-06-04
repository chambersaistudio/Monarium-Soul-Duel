import Phaser from 'phaser';

export class RivalNPC extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private indicator: Phaser.GameObjects.Text;
  interactionRadius = 90;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 0, 28, 10, 0x000000, 0.3);
    scene.add.existing(this.shadow);

    this.gfx = scene.add.graphics();
    this.drawRival();
    this.add(this.gfx);

    // Interaction indicator
    this.indicator = scene.add.text(0, -60, '[E] Talk', {
      fontSize: '12px', color: '#ffff88', fontFamily: 'monospace',
      backgroundColor: '#000000aa', padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    this.indicator.setAlpha(0);
    this.add(this.indicator);

    scene.add.existing(this);
    this.setDepth(4);
  }

  private drawRival(): void {
    const g = this.gfx;
    g.clear();
    // Rival: blue/white character
    g.fillStyle(0x2255cc, 1);
    g.fillRoundedRect(-12, -20, 24, 32, 6);
    g.fillStyle(0x4488ff, 1);
    g.fillCircle(0, -26, 12);
    g.fillStyle(0x001144, 1);
    g.fillTriangle(-8, -34, 8, -34, -4, -20);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-4, -27, 3);
    g.fillStyle(0x000033, 1);
    g.fillCircle(-4, -27, 1.5);
    g.fillStyle(0x001144, 1);
    g.fillRoundedRect(-10, 10, 9, 14, 3);
    g.fillRoundedRect(1, 10, 9, 14, 3);
  }

  showIndicator(show: boolean): void {
    this.indicator.setAlpha(show ? 1 : 0);
  }

  isNear(px: number, py: number): boolean {
    const dx = this.x - px;
    const dy = this.y - py;
    return Math.sqrt(dx * dx + dy * dy) < this.interactionRadius;
  }

  update(): void {
    this.shadow.setPosition(this.x, this.y + 26);
  }

  override destroy(): void {
    this.shadow.destroy();
    super.destroy();
  }
}
