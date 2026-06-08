import Phaser from 'phaser';
import type { InputSystem } from './InputSystem';

const S = 54;   // button size (game units)
const A = 0.72; // resting alpha

type DirKey = 'left' | 'right' | 'up' | 'down';

export class VirtualDpad {
  private readonly scene: Phaser.Scene;
  private readonly input: InputSystem;
  private objects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private pressed: Record<DirKey, boolean> = { left: false, right: false, up: false, down: false };

  // Bound so we can unregister it in destroy()
  private readonly onGlobalUp = (): void => {
    this.pressed.left = this.pressed.right = this.pressed.up = this.pressed.down = false;
    this.input.setTouchMove(0, 0);
  };

  constructor(scene: Phaser.Scene, input: InputSystem) {
    this.scene = scene;
    this.input = input;
    this.build();
  }

  private build(): void {
    const { width: w, height: h } = this.scene.scale;

    // ── D-pad (bottom-left) ───────────────────────────────────────────────
    const cx = 88, cy = h - 90;

    const dirs: Array<{ key: DirKey; label: string; x: number; y: number }> = [
      { key: 'left',  label: '◀', x: cx - S,  y: cy },
      { key: 'right', label: '▶', x: cx + S,  y: cy },
      { key: 'up',    label: '▲', x: cx,       y: cy - S },
      { key: 'down',  label: '▼', x: cx,       y: cy + S },
    ];

    for (const d of dirs) {
      const key = d.key;
      this.makeSquareBtn(d.x, d.y, d.label,
        () => { this.pressed[key] = true;  this.flush(); },
        () => { this.pressed[key] = false; this.flush(); },
      );
    }

    // ── Centre dimple (decorative) ────────────────────────────────────────
    const dimple = this.scene.add.graphics().setDepth(100).setAlpha(0.4);
    dimple.fillStyle(0x1a1a3a, 1);
    dimple.fillCircle(cx, cy, 18);
    this.objects.push(dimple);

    // ── A / Interact button (bottom-right) ────────────────────────────────
    const ax = w - 72, ay = h - 88;
    this.makeRoundBtn(ax, ay, 'A', () => this.input.triggerTouchInteract(), () => {});

    // ── Back button (top-left, small) ────────────────────────────────────
    const bx = 28, by = 28;
    const bbg = this.scene.add.graphics().setDepth(100).setAlpha(0.55);
    bbg.fillStyle(0x111122, 0.8);
    bbg.fillRoundedRect(bx - 24, by - 14, 48, 28, 6);
    bbg.lineStyle(1, 0x333366, 0.6);
    bbg.strokeRoundedRect(bx - 24, by - 14, 48, 28, 6);
    bbg.setInteractive(
      new Phaser.Geom.Rectangle(bx - 24, by - 14, 48, 28),
      Phaser.Geom.Rectangle.Contains,
    );
    bbg.on('pointerdown', () => {
      this.scene.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.scene.start('ModeSelectScene');
      });
    });
    const btxt = this.scene.add.text(bx, by, '< MENU', {
      fontSize: '10px', color: '#556688', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101).setAlpha(0.8);
    this.objects.push(bbg, btxt);

    // Release all when any pointer lifts anywhere
    this.scene.input.on('pointerup', this.onGlobalUp);
  }

  private makeSquareBtn(
    x: number, y: number, label: string,
    onDown: () => void, onUp: () => void,
  ): void {
    const half = S / 2;
    const bg = this.scene.add.graphics().setDepth(100).setAlpha(A);
    bg.fillStyle(0x12122a, 0.85);
    bg.fillRoundedRect(x - half, y - half, S, S, 10);
    bg.lineStyle(1, 0x3344aa, 0.6);
    bg.strokeRoundedRect(x - half, y - half, S, S, 10);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(x - half, y - half, S, S),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on('pointerdown', onDown);
    bg.on('pointerup',   onUp);
    bg.on('pointerout',  onUp);

    const lbl = this.scene.add.text(x, y, label, {
      fontSize: '20px', color: '#6677bb', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101).setAlpha(A + 0.1);

    this.objects.push(bg, lbl);
  }

  private makeRoundBtn(
    x: number, y: number, label: string,
    onDown: () => void, onUp: () => void,
  ): void {
    const r = 32;
    const bg = this.scene.add.graphics().setDepth(100).setAlpha(A);
    bg.fillStyle(0x12301a, 0.9);
    bg.fillCircle(x, y, r);
    bg.lineStyle(2, 0x336644, 0.7);
    bg.strokeCircle(x, y, r);
    bg.setInteractive(
      new Phaser.Geom.Circle(x, y, r),
      Phaser.Geom.Circle.Contains,
    );
    bg.on('pointerdown', onDown);
    bg.on('pointerup',   onUp);

    const lbl = this.scene.add.text(x, y, label, {
      fontSize: '22px', color: '#44bb66', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(A + 0.1);

    this.objects.push(bg, lbl);
  }

  private flush(): void {
    const dx = (this.pressed.right ? 1 : 0) - (this.pressed.left ? 1 : 0);
    const dy = (this.pressed.down  ? 1 : 0) - (this.pressed.up   ? 1 : 0);
    this.input.setTouchMove(dx, dy);
  }

  setVisible(v: boolean): void {
    this.objects.forEach(o => o.setVisible(v));
  }

  destroy(): void {
    this.scene.input.off('pointerup', this.onGlobalUp);
    this.objects.forEach(o => o.destroy());
    this.objects = [];
  }
}
