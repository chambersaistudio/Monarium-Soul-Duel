import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Loading bar
    const barBg = this.add.rectangle(w / 2, h / 2, 300, 20, 0x222222);
    const bar = this.add.rectangle(w / 2 - 150, h / 2, 0, 16, 0xff6600);
    bar.setOrigin(0, 0.5);

    this.add.text(w / 2, h / 2 - 40, 'MONARIUM', {
      fontSize: '32px',
      color: '#ff6600',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Simulate load progress (no real files to load in placeholder mode)
    let progress = 0;
    const timer = this.time.addEvent({
      delay: 16,
      repeat: 30,
      callback: () => {
        progress += 1 / 30;
        bar.width = 296 * Math.min(progress, 1);
        if (progress >= 1) {
          this.scene.start('TitleScene');
        }
      }
    });

    void barBg; void timer;
  }
}
