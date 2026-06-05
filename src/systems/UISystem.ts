import Phaser from 'phaser';
import type { FighterStats } from '../types/minari';
import type { MoveData } from '../types/combat';

export interface BattleHUDState {
  currentAnimationState?: string;
  guardActive?: boolean;
  flameGuardActive?: boolean;
  trainingModeActive?: boolean;
}

const UI_FONT = '"Segoe UI", "Avenir Next", Arial, sans-serif';
const UI_FONT_BOLD = '"Segoe UI Semibold", "Avenir Next", Arial, sans-serif';

export class UISystem {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private texts: Map<string, Phaser.GameObjects.Text> = new Map();
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);
    this.createStaticUI();
  }

  private createStaticUI(): void {
    const w = this.width;
    const h = this.height;

    // Top HUD: keeps lower battle space clear for fighters and controls.
    this.addText('player_name', 'FLAREPAW', 24, 16, {
      fontSize: '13px', color: '#ffd1a6', fontStyle: 'bold', fontFamily: UI_FONT_BOLD
    });
    this.addText('enemy_name', 'DROPLET', w - 24, 16, {
      fontSize: '13px', color: '#b7ecff', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'right'
    }).setOrigin(1, 0);

    this.addText('player_values', '', 24, 31, {
      fontSize: '10px', color: '#f5ecff', fontFamily: UI_FONT
    });
    this.addText('enemy_values', '', w - 24, 31, {
      fontSize: '10px', color: '#f5ecff', fontFamily: UI_FONT, align: 'right'
    }).setOrigin(1, 0);

    this.addText('state_chip_training', '', w / 2, 10, {
      fontSize: '9px', color: '#d8ffe9', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_guard', '', w / 2 - 60, 30, {
      fontSize: '9px', color: '#dce7ff', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_flame_guard', '', w / 2 + 60, 30, {
      fontSize: '9px', color: '#ffe0bd', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_anim', '', w / 2, 50, {
      fontSize: '9px', color: '#d8d2ef', fontFamily: UI_FONT, align: 'center'
    }).setOrigin(0.5, 0);

    this.addText('slots_label', 'SLOT', w / 2, 71, {
      fontSize: '10px', color: '#fff2bd', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'center'
    }).setOrigin(0.5, 0);

    for (let i = 0; i < 4; i++) {
      this.addText(`slot_${i}`, `${i + 1}`, w / 2 - 54 + i * 36, 92, {
        fontSize: '9px', color: '#b8adc8', fontFamily: UI_FONT_BOLD, align: 'center'
      }).setOrigin(0.5, 0);
    }

    this.addText('ability_ready', '', w / 2 - 106, 112, {
      fontSize: '9px', color: '#ffb565', fontFamily: UI_FONT_BOLD
    });
    this.addText('ultimate_ready', '', w / 2 + 12, 112, {
      fontSize: '9px', color: '#ffe680', fontFamily: UI_FONT_BOLD
    });
    this.addText('controls_hint', '', w / 2, h - 22, {
      fontSize: '9px', color: '#dfd7ff', fontFamily: UI_FONT, align: 'center'
    }).setOrigin(0.5, 0);

    ['MOVE', 'JUMP', 'GUARD', 'ATTACK', 'SPECIAL', 'DODGE'].forEach((label, i) => {
      this.addText(`control_${i}`, label, w / 2 - 205 + i * 82, h - 34, {
        fontSize: '9px', color: '#f7f0ff', fontFamily: UI_FONT_BOLD, align: 'center'
      }).setOrigin(0.5, 0);
    });

    // Announce / event text (center screen)
    this.addText('announce', '', w / 2, h / 2 - 60, {
      fontSize: '30px', color: '#fff7ff', fontStyle: 'bold', fontFamily: UI_FONT_BOLD, align: 'center',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(200);
  }

  private addText(
    key: string,
    content: string,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, content, style);
    t.setDepth(101);
    this.texts.set(key, t);
    return t;
  }

  update(
    playerStats: FighterStats,
    enemyStats: FighterStats,
    selectedSlot: number,
    specials: MoveData[],
    abilityReady: boolean,
    ultimateReady: boolean,
    formActive: boolean,
    formTimeRemaining: number,
    hudState: BattleHUDState = {}
  ): void {
    this.graphics.clear();
    const w = this.width;
    const compact = w < 760;

    const playerBarW = compact ? Math.min(190, w * 0.32) : 230;
    const enemyBarW = playerBarW;
    const playerX = 24;
    const enemyX = w - 24 - enemyBarW;
    const hpY = 48;
    const auraY = 70;
    const soulY = 88;

    // Lightweight bar backplates only; no large lower overlay.
    this.drawHudBackplate(playerX - 10, 10, playerBarW + 20, 92, 0xff8a30, 0x8f5cff);
    this.drawHudBackplate(enemyX - 10, 10, enemyBarW + 20, 76, 0x66d7ff, 0x8f5cff);

    // ── Player bars (left side) ──
    this.drawBar(playerX, hpY, playerBarW, 15, playerStats.hp, playerStats.maxHp, 0x35f08a, 0xb7ffd4, 0x172124, 0x39f3a2);
    this.drawBar(playerX, auraY, playerBarW, 11, playerStats.aura, playerStats.maxAura, 0x8b5cff, 0x57d6ff, 0x17122b, 0x8f5cff);
    this.drawBar(playerX, soulY, Math.floor(playerBarW * 0.72), 7, playerStats.soulbond, playerStats.maxSoulbond, 0xffb24d, 0xffe58f, 0x251606, 0xff8a30);

    // ── Enemy bars (right side) ──
    this.drawBar(enemyX, hpY, enemyBarW, 15, enemyStats.hp, enemyStats.maxHp, 0xff5b8f, 0xffadc7, 0x2a101c, 0xff6ca3);
    this.drawBar(enemyX, auraY, enemyBarW, 11, enemyStats.aura, enemyStats.maxAura, 0x42cfff, 0xa7efff, 0x0d2034, 0x42cfff);

    const playerValues = this.texts.get('player_values');
    if (playerValues) {
      playerValues.setText(`HP ${Math.ceil(playerStats.hp)}/${playerStats.maxHp}  AU ${Math.floor(playerStats.aura)}/${playerStats.maxAura}`);
    }
    const enemyValues = this.texts.get('enemy_values');
    if (enemyValues) {
      enemyValues.setText(`HP ${Math.ceil(enemyStats.hp)}/${enemyStats.maxHp}  AU ${Math.floor(enemyStats.aura)}/${enemyStats.maxAura}`);
    }

    // ── Compact read-only status badges in the top center ──
    this.drawBadge('state_chip_training', hudState.trainingModeActive === true ? '✦ TRAINING' : '', w / 2, 9, 88, 0x173020, 0x8bffd0, true);
    this.drawBadge('state_chip_guard', hudState.guardActive === true ? '◇ GUARD' : '◇', w / 2 - 56, 29, 62, 0x201747, 0xa989ff, hudState.guardActive === true);
    this.drawBadge('state_chip_flame_guard', hudState.flameGuardActive === true ? '✦ FLAME' : '✦', w / 2 + 56, 29, 66, 0x47210c, 0xffb260, hudState.flameGuardActive === true);
    const animText = hudState.currentAnimationState ? hudState.currentAnimationState.toUpperCase() : '';
    this.drawBadge('state_chip_anim', animText, w / 2, 49, Math.max(52, animText.length * 7 + 18), 0x1b1432, 0x9d7cff, false);

    // ── Current special slot: visible but compact ──
    const selectedMove = specials[selectedSlot];
    const selectedName = selectedMove ? selectedMove.name : '---';
    const slotLabel = `SLOT ${selectedSlot + 1}: ${selectedName}`;
    this.drawBadge('slots_label', slotLabel, w / 2, 70, Math.min(compact ? 196 : 250, Math.max(108, slotLabel.length * 6 + 22)), 0x3c2458, 0xffc66b, true);

    for (let i = 0; i < 4; i++) {
      const isSelected = i === selectedSlot;
      const slotText = this.texts.get(`slot_${i}`);
      const x = w / 2 - 54 + i * 36;
      if (slotText) {
        slotText.setText(`${i + 1}`);
        slotText.setPosition(x, 92);
        slotText.setStyle({
          fontSize: '9px',
          color: isSelected ? '#241100' : '#d5c7ef',
          fontFamily: UI_FONT_BOLD,
          fontStyle: isSelected ? 'bold' : 'normal'
        });
        this.graphics.fillGradientStyle(isSelected ? 0xffd37a : 0x251a38, isSelected ? 0xffaa55 : 0x1b1429, isSelected ? 0xb45cff : 0x110d1e, isSelected ? 0xff7a35 : 0x181126, isSelected ? 1 : 0.72);
        this.graphics.fillRoundedRect(x - 13, 89, 26, 16, 8);
        this.graphics.lineStyle(1, isSelected ? 0xffe4ad : 0x6d58a8, isSelected ? 1 : 0.45);
        this.graphics.strokeRoundedRect(x - 13, 89, 26, 16, 8);
      }
    }

    // Form duration bar is attached to the player HUD, not the battle floor.
    if (formActive) {
      this.graphics.fillStyle(0x35102a, 0.58);
      this.graphics.fillRoundedRect(playerX, 101, playerBarW, 4, 2);
      this.graphics.fillGradientStyle(0xff9b4a, 0xffdd8c, 0xb45cff, 0xff7a35, 1);
      this.graphics.fillRoundedRect(playerX, 101, playerBarW * Math.min(formTimeRemaining / 8000, 1), 4, 2);
    }

    // Ability / ultimate indicators
    const abilityText = this.texts.get('ability_ready');
    if (abilityText) {
      abilityText.setPosition(w / 2 - 106, 112);
      if (formActive) {
        abilityText.setText('I  FORM').setStyle({ fontSize: '9px', color: '#ffbf7c', fontFamily: UI_FONT_BOLD, fontStyle: 'bold' });
      } else {
        abilityText.setText(abilityReady ? 'I  READY' : 'I  ABILITY').setStyle({
          fontSize: '9px', color: abilityReady ? '#ffbf7c' : '#9185a8', fontFamily: UI_FONT_BOLD, fontStyle: abilityReady ? 'bold' : 'normal'
        });
      }
    }
    const ultText = this.texts.get('ultimate_ready');
    if (ultText) {
      ultText.setPosition(w / 2 + 12, 112);
      ultText.setText(ultimateReady ? 'U  SOULBURST' : 'U  ULT').setStyle({
        fontSize: '9px', color: ultimateReady ? '#ffe98f' : '#9185a8', fontFamily: UI_FONT_BOLD, fontStyle: ultimateReady ? 'bold' : 'normal'
      });
    }

    this.drawControlPills();
  }

  private drawHudBackplate(x: number, y: number, w: number, h: number, accent: number, glow: number): void {
    this.graphics.fillStyle(glow, 0.09);
    this.graphics.fillRoundedRect(x - 4, y - 3, w + 8, h + 8, 15);
    this.graphics.fillGradientStyle(0x241633, 0x161827, 0x0b0d18, 0x171023, 0.78, 0.72, 0.64, 0.68);
    this.graphics.fillRoundedRect(x, y, w, h, 13);
    this.graphics.fillStyle(0xffffff, 0.08);
    this.graphics.fillRoundedRect(x + 5, y + 4, w - 10, Math.max(10, h * 0.34), 10);
    this.graphics.lineStyle(1, accent, 0.62);
    this.graphics.strokeRoundedRect(x, y, w, h, 13);
    this.graphics.lineStyle(1, 0xffffff, 0.12);
    this.graphics.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 12);
  }

  private drawBadge(
    key: string,
    text: string,
    centerX: number,
    y: number,
    width: number,
    fillColor: number,
    accentColor: number,
    active: boolean
  ): void {
    const badge = this.texts.get(key);
    if (!badge) return;

    badge.setText(text);
    badge.setPosition(centerX, y + 2);
    badge.setAlpha(text ? (active ? 1 : 0.68) : 0);
    badge.setStyle({
      fontSize: key === 'slots_label' ? '10px' : '9px',
      color: active ? '#fff8ea' : '#d8d0eb',
      fontFamily: active ? UI_FONT_BOLD : UI_FONT,
      fontStyle: active ? 'bold' : 'normal',
      align: 'center'
    });

    if (!text) return;
    this.graphics.fillStyle(accentColor, active ? 0.18 : 0.08);
    this.graphics.fillRoundedRect(centerX - width / 2 - 3, y - 2, width + 6, 19, 10);
    this.graphics.fillGradientStyle(fillColor, 0x251832, 0x120d20, fillColor, active ? 0.92 : 0.6, active ? 0.82 : 0.54, active ? 0.72 : 0.46, active ? 0.76 : 0.48);
    this.graphics.fillRoundedRect(centerX - width / 2, y, width, 15, 8);
    this.graphics.fillStyle(0xffffff, active ? 0.11 : 0.06);
    this.graphics.fillRoundedRect(centerX - width / 2 + 4, y + 2, width - 8, 4, 4);
    this.graphics.lineStyle(1, accentColor, active ? 0.9 : 0.42);
    this.graphics.strokeRoundedRect(centerX - width / 2, y, width, 15, 8);
  }

  private drawControlPills(): void {
    const labels = ['MOVE', 'JUMP', 'GUARD', 'ATTACK', 'SPECIAL', 'DODGE'];
    const w = this.width;
    const h = this.height;
    const pillW = 66;
    const gap = 10;
    const startX = w / 2 - ((labels.length * pillW + (labels.length - 1) * gap) / 2) + pillW / 2;
    const y = h - 40;

    labels.forEach((_, i) => {
      const x = startX + i * (pillW + gap);
      const text = this.texts.get(`control_${i}`);
      if (text) {
        text.setPosition(x, y + 7);
        text.setStyle({ fontSize: '9px', color: '#f7f0ff', fontFamily: UI_FONT_BOLD, align: 'center' });
        text.setAlpha(0.82);
      }
      this.graphics.fillStyle(0x8f5cff, 0.12);
      this.graphics.fillRoundedRect(x - pillW / 2 - 2, y - 2, pillW + 4, 25, 13);
      this.graphics.fillGradientStyle(0x241633, 0x151422, 0x0e0b18, 0x1c1230, 0.66, 0.58, 0.46, 0.54);
      this.graphics.fillRoundedRect(x - pillW / 2, y, pillW, 21, 11);
      this.graphics.lineStyle(1, 0xb996ff, 0.32);
      this.graphics.strokeRoundedRect(x - pillW / 2, y, pillW, 21, 11);
    });
  }

  private drawBar(
    x: number, y: number,
    maxW: number, h: number,
    value: number, maxValue: number,
    fillStart: number, fillEnd: number,
    bgColor: number, glowColor: number
  ): void {
    const pct = Math.max(0, Math.min(1, value / maxValue));
    const fillW = Math.floor(maxW * pct);

    this.graphics.fillStyle(glowColor, 0.16);
    this.graphics.fillRoundedRect(x - 3, y - 3, maxW + 6, h + 6, h / 2 + 3);
    this.graphics.fillGradientStyle(0x070812, bgColor, 0x090715, bgColor, 0.96, 0.92, 0.92, 0.82);
    this.graphics.fillRoundedRect(x, y, maxW, h, h / 2);

    if (fillW > 0) {
      this.graphics.fillGradientStyle(fillStart, fillEnd, Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(fillStart),
        Phaser.Display.Color.ValueToColor(0x000000),
        100,
        22
      ).color, fillStart, 1, 1, 0.92, 0.96);
      this.graphics.fillRoundedRect(x, y, fillW, h, Math.min(h / 2, fillW / 2));
      this.graphics.fillStyle(0xffffff, 0.2);
      this.graphics.fillRoundedRect(x + 3, y + 2, Math.max(0, fillW - 6), Math.max(1, h * 0.28), h / 3);
    }

    this.graphics.lineStyle(1, 0xffffff, 0.18);
    this.graphics.strokeRoundedRect(x, y, maxW, h, h / 2);
    this.graphics.lineStyle(1, glowColor, 0.5);
    this.graphics.strokeRoundedRect(x - 1, y - 1, maxW + 2, h + 2, h / 2 + 1);
  }

  showAnnounce(text: string, duration: number = 2000): void {
    const t = this.texts.get('announce');
    if (!t) return;
    t.setText(text).setAlpha(1);
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: duration - 500,
      duration: 500
    });
  }

  showAnnounceImmediate(text: string): void {
    const t = this.texts.get('announce');
    if (t) t.setText(text).setAlpha(1);
  }

  hideAnnounce(): void {
    const t = this.texts.get('announce');
    if (t) t.setAlpha(0);
  }

  destroy(): void {
    this.graphics.destroy();
    this.texts.forEach(t => t.destroy());
    this.texts.clear();
  }
}
