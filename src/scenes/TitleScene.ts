import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; color: number; alpha: number;
}

export class TitleScene extends Phaser.Scene {
  private particles: Particle[] = [];
  private bgGfx!: Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private audio!: AudioManager;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private protoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private lineGfx!: Phaser.GameObjects.Graphics;
  private debugText: Phaser.GameObjects.Text | null = null;
  private starting = false;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.particles = [];
    this.starting = false;
    const w = this.scale.width;
    const h = this.scale.height;

    this.bgGfx = this.add.graphics().setDepth(0);
    this.particleGfx = this.add.graphics().setDepth(1);

    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 20,
        vy: -(Math.random() * 15 + 5),
        r: Math.random() * 3 + 1,
        color: [0xff6600, 0xff4400, 0xffaa00, 0xcc88ff][Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.6 + 0.2,
      });
    }

    this.titleText = this.add.text(0, 0, 'MONARIUM', {
      fontSize: '72px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff3300', blur: 30, fill: true },
    }).setOrigin(0.5).setDepth(2);

    this.subtitleText = this.add.text(0, 0, 'SOUL DUEL', {
      fontSize: '28px', color: '#ffaa44', fontStyle: 'bold', fontFamily: 'monospace',
      letterSpacing: 12, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);

    this.protoText = this.add.text(0, 0, 'PROTOTYPE', {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace', letterSpacing: 8,
    }).setOrigin(0.5).setDepth(2);

    this.lineGfx = this.add.graphics().setDepth(2);

    this.promptText = this.add.text(0, 0, 'Tap or Press ENTER to Start', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);

    this.tweens.add({ targets: this.promptText, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    this.controlsText = this.add.text(0, 0,
      'Controls: Arrows=Move  J=Attack  K=Special  L=Dodge  I=Ability  U=Ultimate  1-4=Slots',
      { fontSize: '10px', color: '#555555', fontFamily: 'monospace', align: 'center' },
    ).setOrigin(0.5).setDepth(2);

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      this.debugText = this.add.text(0, 0, '', {
        fontSize: '9px', color: '#777777', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5, 1).setDepth(3);
    }

    this.layoutStartScreen();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutStartScreen, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutStartScreen, this);
    });

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    // Tap / click anywhere also advances (mobile and desktop)
    this.input.once('pointerup', () => this.startGame());
  }

  private layoutStartScreen(): void {
    const w = Math.max(1, this.scale.width || this.scale.gameSize.width);
    const h = Math.max(1, this.scale.height || this.scale.gameSize.height);
    const cx = w / 2;
    const cy = h / 2;
    const compact = h < 420 || w < 520;
    const titleOffset = compact ? Math.min(76, h * 0.24) : 120;
    const titleSize = Math.floor(Math.min(compact ? 46 : 72, Math.max(30, w / 9)));
    const subtitleSize = Math.floor(Math.min(compact ? 20 : 28, Math.max(16, w / 22)));
    const promptY = Math.min(h - 72, cy + (compact ? 64 : 80));
    const lineW = Math.min(300, Math.max(170, w - 64));

    this.drawBackground();
    this.titleText.setPosition(cx, cy - titleOffset).setFontSize(titleSize);
    this.subtitleText.setPosition(cx, cy - (compact ? 22 : 40)).setFontSize(subtitleSize);
    this.protoText.setPosition(cx, cy + (compact ? 10 : 0)).setFontSize(compact ? 11 : 14);
    this.promptText.setPosition(cx, promptY).setFontSize(compact ? 15 : 20);
    this.controlsText
      .setPosition(cx, h - 30)
      .setFontSize(compact ? 8 : 10)
      .setWordWrapWidth(Math.max(220, w - 36));

    this.lineGfx.clear();
    this.lineGfx.lineStyle(1, 0xff6600, 0.4);
    this.lineGfx.lineBetween(cx - lineW / 2, cy + (compact ? 28 : 25), cx + lineW / 2, cy + (compact ? 28 : 25));

    if (this.debugText) {
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const orientation = w >= h ? 'landscape' : 'portrait';
      this.debugText
        .setPosition(cx, h - 6)
        .setText([
          `viewport ${Math.round(window.visualViewport?.width ?? window.innerWidth)}x${Math.round(window.visualViewport?.height ?? window.innerHeight)} ${orientation}`,
          `scale ${Math.round(w)}x${Math.round(h)} css ${Math.round(rect.width)}x${Math.round(rect.height)} internal ${canvas.width}x${canvas.height}`,
          `camera zoom ${this.cameras.main.zoom.toFixed(2)} ui center ${Math.round(cx)},${Math.round(cy)}`,
        ]);
    }
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress === 1) this.scene.start('ModeSelectScene');
    });
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

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.startGame();

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
