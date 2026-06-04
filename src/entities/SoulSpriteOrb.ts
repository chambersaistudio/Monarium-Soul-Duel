import Phaser from 'phaser';

const ORB_COLORS = [0x88ffee, 0xffaa44, 0xcc88ff, 0x44ffaa, 0xff8866];

export class SoulSpriteOrb extends Phaser.GameObjects.Container {
  private glow: Phaser.GameObjects.Arc;
  private core: Phaser.GameObjects.Arc;
  private baseY: number;
  private floatOffset: number;
  private floatSpeed: number;
  private time: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, colorIndex: number = 0) {
    super(scene, x, y);
    this.baseY = y;
    this.floatOffset = Math.random() * Math.PI * 2;
    this.floatSpeed = 0.8 + Math.random() * 0.6;

    const color = ORB_COLORS[colorIndex % ORB_COLORS.length];

    this.glow = scene.add.arc(0, 0, 18, 0, 360, false, color, 0.2);
    this.core = scene.add.arc(0, 0, 9, 0, 360, false, color, 0.9);

    this.add([this.glow, this.core]);
    scene.add.existing(this);
    this.setDepth(3);

    // Pulsing tween on glow
    scene.tweens.add({
      targets: this.glow,
      scaleX: 1.4, scaleY: 1.4,
      alpha: 0.05,
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  update(delta: number): void {
    this.time += delta / 1000;
    this.y = this.baseY + Math.sin(this.time * this.floatSpeed + this.floatOffset) * 12;
  }
}
