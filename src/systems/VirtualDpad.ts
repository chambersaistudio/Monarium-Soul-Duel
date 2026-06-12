import Phaser from 'phaser';
import type { InputSystem } from './InputSystem';
import { UI_THEME } from '../config/uiTheme';

const A = 0.76;
const JOY_R = 58;
const THUMB_R = 24;

export class VirtualDpad {
  private readonly scene: Phaser.Scene;
  private readonly input: InputSystem;
  private objects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private base!: Phaser.GameObjects.Graphics;
  private thumb!: Phaser.GameObjects.Graphics;
  private joyPointerId: number | null = null;
  private cx = 0;
  private cy = 0;

  private readonly onGlobalUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.joyPointerId === pointer.id) this.releaseStick();
  };

  private readonly onGlobalMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.joyPointerId !== pointer.id) return;
    // worldX/worldY: CSS-pixel scene coords regardless of the high-DPI camera
    // zoom (raw pointer.x/y are in canvas buffer pixels — see highDpi.ts)
    this.updateStick(pointer.worldX, pointer.worldY);
  };

  constructor(scene: Phaser.Scene, input: InputSystem) {
    this.scene = scene;
    this.input = input;
    this.build();
  }

  private build(): void {
    const { width: w, height: h } = this.scene.scale;
    this.cx = 88;
    this.cy = h - 96;

    this.base = this.scene.add.graphics().setDepth(100).setAlpha(A);
    this.drawBase(false);
    this.base.setInteractive(new Phaser.Geom.Circle(this.cx, this.cy, JOY_R + 18), Phaser.Geom.Circle.Contains);
    this.base.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.joyPointerId = p.id;
      this.updateStick(p.worldX, p.worldY);
    });
    this.objects.push(this.base);

    this.thumb = this.scene.add.graphics().setDepth(101).setAlpha(0.9);
    this.drawThumb(this.cx, this.cy, false);
    this.objects.push(this.thumb);

    const ax = w - 74, ay = h - 92;
    this.makeRoundBtn(ax, ay, 34, 'A', 0x42e69b, () => this.input.triggerTouchInteract(), () => {});
    this.makeRoundBtn(w - 136, h - 58, 24, 'MENU', UI_THEME.colors.gold, () => {
      const anyScene = this.scene as unknown as { openStartMenu?: () => void };
      if (typeof anyScene.openStartMenu === 'function') anyScene.openStartMenu();
      else this.scene.scene.start('ModeSelectScene');
    }, () => {});

    this.scene.input.on('pointerup', this.onGlobalUp);
    this.scene.input.on('pointermove', this.onGlobalMove);
  }

  private drawBase(active: boolean): void {
    this.base.clear();
    this.base.fillStyle(UI_THEME.colors.panelDeep, 0.58).fillCircle(this.cx, this.cy, JOY_R + 14);
    this.base.fillStyle(UI_THEME.colors.glass, active ? 0.72 : 0.52).fillCircle(this.cx, this.cy, JOY_R);
    this.base.lineStyle(2, active ? UI_THEME.colors.gold : UI_THEME.colors.purple, active ? 0.75 : 0.48).strokeCircle(this.cx, this.cy, JOY_R);
    this.base.lineStyle(1, 0xffffff, 0.12).strokeCircle(this.cx, this.cy, JOY_R - 16);
  }

  private drawThumb(x: number, y: number, active: boolean): void {
    this.thumb.clear();
    this.thumb.fillStyle(active ? UI_THEME.colors.gold : UI_THEME.colors.purple, active ? 0.25 : 0.18).fillCircle(x, y, THUMB_R + 8);
    this.thumb.fillStyle(UI_THEME.colors.panel, 0.82).fillCircle(x, y, THUMB_R);
    this.thumb.lineStyle(2, active ? UI_THEME.colors.gold : UI_THEME.colors.strokeDim, 0.72).strokeCircle(x, y, THUMB_R);
  }

  private updateStick(px: number, py: number): void {
    const rawX = px - this.cx;
    const rawY = py - this.cy;
    const len = Math.sqrt(rawX * rawX + rawY * rawY);
    const max = JOY_R;
    const clamped = len > max ? max / len : 1;
    const tx = rawX * clamped;
    const ty = rawY * clamped;
    const mag = Math.min(1, len / max);
    const deadzone = UI_THEME.mobile.joystickDeadzone;
    if (mag < deadzone) {
      this.input.setTouchMove(0, 0);
      this.drawThumb(this.cx, this.cy, true);
    } else {
      const scaled = (mag - deadzone) / (1 - deadzone);
      this.input.setTouchMove((rawX / (len || 1)) * scaled, (rawY / (len || 1)) * scaled);
      this.drawThumb(this.cx + tx, this.cy + ty, true);
    }
    this.drawBase(true);
  }

  private releaseStick(): void {
    this.joyPointerId = null;
    this.input.setTouchMove(0, 0);
    this.drawBase(false);
    this.drawThumb(this.cx, this.cy, false);
  }

  private makeRoundBtn(x: number, y: number, r: number, label: string, color: number, onDown: () => void, onUp: () => void): void {
    const bg = this.scene.add.graphics().setDepth(100).setAlpha(A);
    bg.fillStyle(color, 0.16).fillCircle(x, y, r + 8);
    bg.fillStyle(UI_THEME.colors.panelDeep, 0.72).fillCircle(x, y, r);
    bg.lineStyle(2, color, 0.7).strokeCircle(x, y, r);
    bg.setInteractive(new Phaser.Geom.Circle(x, y, r + 8), Phaser.Geom.Circle.Contains);
    bg.on('pointerdown', onDown);
    bg.on('pointerup', onUp);

    const lbl = this.scene.add.text(x, y, label, {
      fontSize: label.length > 1 ? '9px' : '22px', color: '#fff4c7', fontFamily: UI_THEME.fonts.family,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101).setAlpha(0.92);
    this.objects.push(bg, lbl);
  }

  setVisible(v: boolean): void { this.objects.forEach(o => o.setVisible(v)); }

  destroy(): void {
    this.scene.input.off('pointerup', this.onGlobalUp);
    this.scene.input.off('pointermove', this.onGlobalMove);
    this.objects.forEach(o => o.destroy());
    this.objects = [];
  }
}
