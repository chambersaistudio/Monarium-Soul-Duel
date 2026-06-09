import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme';

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private pointerId: number | null = null;
  private center = new Phaser.Math.Vector2(0, 0);
  private vector = new Phaser.Math.Vector2(0, 0);
  private readonly radius = 52;
  private readonly deadzone = 0.18;
  private enabled: boolean;

  constructor(scene: Phaser.Scene, force = false) {
    this.scene = scene;
    this.enabled = force || this.detectTouchDevice();
    const h = scene.scale.height;
    this.center.set(86, h - 88);

    this.root = scene.add.container(0, 0).setDepth(320).setVisible(this.enabled);
    this.base = scene.add.graphics();
    this.knob = scene.add.graphics();
    this.label = scene.add.text(this.center.x, this.center.y + 60, 'MOVE', {
      fontSize: '9px', color: '#dfd7ff', fontFamily: UI_THEME.fonts.bold
    }).setOrigin(0.5).setAlpha(0.8);
    this.root.add([this.base, this.knob, this.label]);
    this.drawBase();
    this.drawKnob(this.center.x, this.center.y);

    if (!this.enabled) return;

    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('pointerupoutside', this.handlePointerUp, this);
  }

  get movement(): { x: number; y: number } {
    return { x: this.vector.x, y: this.vector.y };
  }

  get isEnabled(): boolean { return this.enabled; }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.root.destroy(true);
  }

  private detectTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.center.x, this.center.y);
    if (dist > this.radius * 1.7) return;
    this.pointerId = pointer.id;
    this.updateVector(pointer.x, pointer.y);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== pointer.id) return;
    this.updateVector(pointer.x, pointer.y);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== pointer.id) return;
    this.pointerId = null;
    this.vector.set(0, 0);
    this.drawKnob(this.center.x, this.center.y);
  }

  private updateVector(x: number, y: number): void {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const dist = Math.min(this.radius, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);
    const magnitude = dist / this.radius;

    if (magnitude < this.deadzone) this.vector.set(0, 0);
    else this.vector.set(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);

    this.drawKnob(this.center.x + Math.cos(angle) * dist, this.center.y + Math.sin(angle) * dist);
  }

  private drawBase(): void {
    const g = this.base;
    g.clear();
    g.fillStyle(UI_THEME.colors.aether, 0.11);
    g.fillCircle(this.center.x, this.center.y, this.radius + 9);
    g.fillGradientStyle(0x241633, 0x171224, 0x080712, 0x1d1230, 0.72, 0.62, 0.46, 0.54);
    g.fillCircle(this.center.x, this.center.y, this.radius);
    g.lineStyle(2, UI_THEME.colors.aetherBright, 0.42);
    g.strokeCircle(this.center.x, this.center.y, this.radius);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeCircle(this.center.x, this.center.y, this.radius - 10);
  }

  private drawKnob(x: number, y: number): void {
    const g = this.knob;
    g.clear();
    g.fillStyle(UI_THEME.colors.aether, 0.2);
    g.fillCircle(x, y, 25);
    g.fillGradientStyle(0xffd37a, 0xb996ff, 0x8f5cff, 0x241633, 0.92, 0.86, 0.82, 0.9);
    g.fillCircle(x, y, 18);
    g.lineStyle(1, 0xffffff, 0.55);
    g.strokeCircle(x, y, 18);
  }
}
