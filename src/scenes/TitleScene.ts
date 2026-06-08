import Phaser from 'phaser';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; color: number; alpha: number;
}

export class TitleScene extends Phaser.Scene {
  private particles: Particle[] = [];
  private bgGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.bgGfx = this.add.graphics().setDepth(0);
    this.drawBackground();

    this.particleGfx = this.add.graphics().setDepth(1);

    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 20,
        vy: -(Math.random() * 15 + 5),
        r: Math.random() * 3 + 1,
        color: [0xff6600, 0xff4400, 0xffaa00, 0xcc88ff][Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.6 + 0.2
      });
    }

    this.add.text(w / 2, h / 2 - 120, 'MONARIUM', {
      fontSize: '72px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff3300', blur: 30, fill: true }
    }).setOrigin(0.5).setDepth(2);

    this.add.text(w / 2, h / 2 - 40, 'SOUL DUEL', {
      fontSize: '28px', color: '#ffaa44', fontStyle: 'bold', fontFamily: 'monospace',
      letterSpacing: 12, stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(2);

    this.add.text(w / 2, h / 2, 'PROTOTYPE', {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace', letterSpacing: 8
    }).setOrigin(0.5).setDepth(2);

    const line = this.add.graphics().setDepth(2);
    line.lineStyle(1, 0xff6600, 0.4);
    line.lineBetween(w / 2 - 150, h / 2 + 25, w / 2 + 150, h / 2 + 25);

    const prompt = this.add.text(w / 2, h / 2 + 80, 'Press ENTER to Start', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(2);

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    this.add.text(w / 2, h - 30,
      'Controls: Arrows=Move  J=Attack  K=Special  L=Dodge  I=Ability  U=Ultimate  1-4=Slots',
      { fontSize: '10px', color: '#555555', fontFamily: 'monospace' }
    ).setOrigin(0.5).setDepth(2);

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  private drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.bgGfx;
    g.clear();
    for (let i = 0; i < h; i += 4) {
      const t = i / h;
      const r = Math.floor(Phaser.Math.Linear(8, 20, t));
      const gv = Math.floor(Phaser.Math.Linear(4, 8, t));
      const b = Math.floor(Phaser.Math.Linear(18, 6, t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, i, w, 4);
    }
    g.fillStyle(0xff4400, 0.05);
    g.fillCircle(w / 2, h / 2 - 80, 200);
  }

  update(_time: number, delta: number): void {
    const w = this.scale.width;
    const h = this.scale.height;

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress === 1) this.scene.start('ModeSelectScene');
      });
    }

    this.particleGfx.clear();
    for (const p of this.particles) {
      p.x += p.vx * delta / 1000;
      p.y += p.vy * delta / 1000;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      this.particleGfx.fillStyle(p.color, p.alpha);
      this.particleGfx.fillCircle(p.x, p.y, p.r);
    }
  }
}
