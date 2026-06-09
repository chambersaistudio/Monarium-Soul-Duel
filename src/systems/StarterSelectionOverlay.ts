import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme';
import { STARTER_MONARI, getRenzoStarter } from '../data/monariDex';
import type { MonariDexEntry } from '../types/monari';

export class StarterSelectionOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private graphics: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private selectedId = 'flarepaw';
  private onConfirm?: (playerStarter: MonariDexEntry, renzoStarter: MonariDexEntry) => void;
  private onCancel?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(280).setVisible(false);
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);
  }

  get visible(): boolean { return this.container.visible; }

  show(onConfirm: (playerStarter: MonariDexEntry, renzoStarter: MonariDexEntry) => void, onCancel?: () => void): void {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.container.setVisible(true);
    this.render();
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private render(): void {
    this.clearTexts();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const cardW = Math.min(250, (w - 100) / 3);
    const cardH = 300;
    const gap = 18;
    const totalW = cardW * 3 + gap * 2;
    const startX = (w - totalW) / 2;
    const y = 118;

    this.graphics.clear();
    this.graphics.fillStyle(0x03040a, 0.72);
    this.graphics.fillRect(0, 0, w, h);
    this.graphics.fillStyle(UI_THEME.colors.aether, 0.12);
    this.graphics.fillRoundedRect(42, 42, w - 84, h - 84, 28);
    this.graphics.lineStyle(2, UI_THEME.colors.aetherBright, 0.45);
    this.graphics.strokeRoundedRect(42, 42, w - 84, h - 84, 28);

    this.addText(w / 2, 62, 'Choose Your Starter Monari', 26, '#fff8ea', UI_THEME.fonts.bold).setOrigin(0.5, 0);
    this.addText(w / 2, 94, 'Aqua beats Ember  •  Ember beats Terra  •  Terra beats Aqua', 13, '#d8d0eb', UI_THEME.fonts.body).setOrigin(0.5, 0);

    STARTER_MONARI.forEach((entry, i) => {
      this.drawStarterCard(entry, startX + i * (cardW + gap), y, cardW, cardH, entry.id === this.selectedId);
    });

    const selected = STARTER_MONARI.find(entry => entry.id === this.selectedId) ?? STARTER_MONARI[0];
    const renzo = getRenzoStarter(selected.id);
    this.addText(w / 2, h - 104, `Renzo will choose ${renzo.name} (${renzo.element})`, 14, '#ffdca8', UI_THEME.fonts.bold).setOrigin(0.5, 0);
    this.drawButton(w / 2 - 112, h - 70, 160, 36, 'CONFIRM', true, () => {
      this.hide();
      this.onConfirm?.(selected, renzo);
    });
    this.drawButton(w / 2 + 112, h - 70, 160, 36, 'CANCEL', false, () => {
      this.hide();
      this.onCancel?.();
    });
  }

  private drawStarterCard(entry: MonariDexEntry, x: number, y: number, w: number, h: number, selected: boolean): void {
    const accent = this.elementColor(entry.element);
    this.graphics.fillStyle(accent, selected ? 0.2 : 0.08);
    this.graphics.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 22);
    this.graphics.fillGradientStyle(0x241633, 0x171224, 0x090812, 0x1c1230, 0.95, 0.88, 0.84, 0.88);
    this.graphics.fillRoundedRect(x, y, w, h, 18);
    this.graphics.lineStyle(selected ? 3 : 1, selected ? UI_THEME.colors.gold : accent, selected ? 0.95 : 0.45);
    this.graphics.strokeRoundedRect(x, y, w, h, 18);

    this.graphics.fillStyle(accent, 0.26);
    this.graphics.fillCircle(x + w / 2, y + 58, 42);
    this.graphics.fillStyle(0xffffff, 0.12);
    this.graphics.fillCircle(x + w / 2 - 10, y + 46, 14);
    this.addText(x + w / 2, y + 34, this.elementIcon(entry.element), 34, '#fff8ea', UI_THEME.fonts.bold).setOrigin(0.5, 0);

    this.addText(x + w / 2, y + 102, entry.name, 18, '#fff8ea', UI_THEME.fonts.bold).setOrigin(0.5, 0);
    this.addText(x + w / 2, y + 128, `${entry.element} • ${entry.rarity} • Lv. ${entry.level}`, 12, '#ffdca8', UI_THEME.fonts.bold).setOrigin(0.5, 0);
    this.addText(x + w / 2, y + 148, entry.role, 11, '#d8d0eb', UI_THEME.fonts.body).setOrigin(0.5, 0);

    const stats = [
      ['HP', entry.baseStats.hp], ['ATK', entry.baseStats.attack], ['SPA', entry.baseStats.specialAttack],
      ['DEF', entry.baseStats.defense], ['SPD', entry.baseStats.specialDefense], ['SPE', entry.baseStats.speed], ['AUR', entry.baseStats.aura]
    ] as const;
    stats.forEach(([label, value], idx) => this.drawStatBar(x + 22, y + 176 + idx * 15, w - 44, label, value, accent));

    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.once('pointerdown', () => { this.selectedId = entry.id; this.render(); });
    this.container.add(zone);
  }

  private drawStatBar(x: number, y: number, w: number, label: string, value: number, color: number): void {
    this.addText(x, y - 2, label, 8, '#d8d0eb', UI_THEME.fonts.bold).setOrigin(0, 0);
    this.graphics.fillStyle(0x070812, 0.8);
    this.graphics.fillRoundedRect(x + 34, y, w - 34, 7, 4);
    this.graphics.fillStyle(color, 0.95);
    this.graphics.fillRoundedRect(x + 34, y, (w - 34) * Math.min(value / 80, 1), 7, 4);
  }

  private drawButton(x: number, y: number, w: number, h: number, label: string, primary: boolean, cb: () => void): void {
    const accent = primary ? UI_THEME.colors.gold : UI_THEME.colors.aetherBright;
    this.graphics.fillStyle(accent, 0.16);
    this.graphics.fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, h + 6, 18);
    this.graphics.fillGradientStyle(primary ? 0x553116 : 0x241633, 0x151422, 0x0e0b18, primary ? 0x3d2656 : 0x1c1230, 0.94, 0.84, 0.74, 0.84);
    this.graphics.fillRoundedRect(x - w / 2, y, w, h, 18);
    this.graphics.lineStyle(1, accent, 0.72);
    this.graphics.strokeRoundedRect(x - w / 2, y, w, h, 18);
    this.addText(x, y + 9, label, 12, '#fff8ea', UI_THEME.fonts.bold).setOrigin(0.5, 0);
    const zone = this.scene.add.zone(x - w / 2, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.once('pointerdown', cb);
    this.container.add(zone);
  }

  private addText(x: number, y: number, text: string, size: number, color: string, fontFamily: string): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, { fontSize: `${size}px`, color, fontFamily });
    this.texts.push(t);
    this.container.add(t);
    return t;
  }

  private clearTexts(): void {
    this.texts.forEach(t => t.destroy());
    this.texts = [];
    this.container.each((child: Phaser.GameObjects.GameObject) => {
      if (child instanceof Phaser.GameObjects.Zone) child.destroy();
    });
    this.container.removeAll(false);
    this.container.add(this.graphics);
  }

  private elementColor(element: string): number {
    if (element === 'Ember') return UI_THEME.colors.ember;
    if (element === 'Aqua') return UI_THEME.colors.aqua;
    return UI_THEME.colors.terra;
  }

  private elementIcon(element: string): string {
    if (element === 'Ember') return '🔥';
    if (element === 'Aqua') return '💧';
    return '🌿';
  }
}
