import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // No external assets needed — everything is procedural via Phaser graphics
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
