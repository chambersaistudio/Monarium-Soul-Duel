import Phaser from 'phaser';
import type { FighterStats } from '../types/minari';
import type { MoveData } from '../types/combat';

export interface BattleHUDState {
  currentAnimationState?: string;
  guardActive?: boolean;
  flameGuardActive?: boolean;
  trainingModeActive?: boolean;
}

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
      fontSize: '12px', color: '#ff9a3d', fontStyle: 'bold', fontFamily: 'monospace'
    });
    this.addText('enemy_name', 'DROPLET', w - 24, 16, {
      fontSize: '12px', color: '#66d7ff', fontStyle: 'bold', fontFamily: 'monospace', align: 'right'
    }).setOrigin(1, 0);

    this.addText('player_values', '', 24, 31, {
      fontSize: '10px', color: '#dce7d3', fontFamily: 'monospace'
    });
    this.addText('enemy_values', '', w - 24, 31, {
      fontSize: '10px', color: '#dce7d3', fontFamily: 'monospace', align: 'right'
    }).setOrigin(1, 0);

    this.addText('state_chip_training', '', w / 2, 10, {
      fontSize: '9px', color: '#7dffb2', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_guard', '', w / 2 - 60, 30, {
      fontSize: '9px', color: '#7aa7ff', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_flame_guard', '', w / 2 + 60, 30, {
      fontSize: '9px', color: '#ffb15e', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_anim', '', w / 2, 50, {
      fontSize: '9px', color: '#cccccc', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);

    this.addText('slots_label', 'SLOT', w / 2, 71, {
      fontSize: '10px', color: '#fff0a6', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);

    for (let i = 0; i < 4; i++) {
      this.addText(`slot_${i}`, `${i + 1}`, w / 2 - 54 + i * 36, 92, {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace', align: 'center'
      }).setOrigin(0.5, 0);
    }

    this.addText('ability_ready', '', w / 2 - 106, 112, {
      fontSize: '9px', color: '#ff8800', fontFamily: 'monospace'
    });
    this.addText('ultimate_ready', '', w / 2 + 12, 112, {
      fontSize: '9px', color: '#ffdd00', fontFamily: 'monospace'
    });
    this.addText('controls_hint', '←/→ MOVE  ↑ JUMP  ↓/S GUARD  J ATTACK  K SPECIAL  L DODGE', w / 2, h - 22, {
      fontSize: '9px', color: '#adb8c7', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);

    // Announce / event text (center screen)
    this.addText('announce', '', w / 2, h / 2 - 60, {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'monospace', align: 'center',
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
    this.drawHudBackplate(playerX - 10, 10, playerBarW + 20, 92, 0xff8a30);
    this.drawHudBackplate(enemyX - 10, 10, enemyBarW + 20, 76, 0x66d7ff);

    // ── Player bars (left side) ──
    this.drawBar(playerX, hpY, playerBarW, 15, playerStats.hp, playerStats.maxHp, 0x2ee86f, 0x114421);
    this.drawBar(playerX, auraY, playerBarW, 11, playerStats.aura, playerStats.maxAura, 0x4a73ff, 0x112266);
    this.drawBar(playerX, soulY, Math.floor(playerBarW * 0.72), 7, playerStats.soulbond, playerStats.maxSoulbond, 0xffcc33, 0x665500);

    // ── Enemy bars (right side) ──
    this.drawBar(enemyX, hpY, enemyBarW, 15, enemyStats.hp, enemyStats.maxHp, 0xff5252, 0x661111);
    this.drawBar(enemyX, auraY, enemyBarW, 11, enemyStats.aura, enemyStats.maxAura, 0x4a73ff, 0x112266);

    const playerValues = this.texts.get('player_values');
    if (playerValues) {
      playerValues.setText(`HP ${Math.ceil(playerStats.hp)}/${playerStats.maxHp}  AU ${Math.floor(playerStats.aura)}/${playerStats.maxAura}`);
    }
    const enemyValues = this.texts.get('enemy_values');
    if (enemyValues) {
      enemyValues.setText(`HP ${Math.ceil(enemyStats.hp)}/${enemyStats.maxHp}  AU ${Math.floor(enemyStats.aura)}/${enemyStats.maxAura}`);
    }

    // ── Compact read-only status badges in the top center ──
    this.drawBadge('state_chip_training', hudState.trainingModeActive === true ? 'TRAINING' : '', w / 2, 9, 72, 0x113822, 0x7dffb2, true);
    this.drawBadge('state_chip_guard', hudState.guardActive === true ? 'GUARD' : 'G', w / 2 - 52, 29, 44, 0x13224a, 0x7aa7ff, hudState.guardActive === true);
    this.drawBadge('state_chip_flame_guard', hudState.flameGuardActive === true ? 'FLAME' : 'FG', w / 2 + 52, 29, 52, 0x4a220d, 0xffb15e, hudState.flameGuardActive === true);
    const animText = hudState.currentAnimationState ? hudState.currentAnimationState.toUpperCase() : '';
    this.drawBadge('state_chip_anim', animText, w / 2, 49, Math.max(46, animText.length * 7 + 14), 0x171c27, 0xb8c0d4, false);

    // ── Current special slot: visible but compact ──
    const selectedMove = specials[selectedSlot];
    const selectedName = selectedMove ? selectedMove.name : '---';
    const slotLabel = `SLOT ${selectedSlot + 1}: ${selectedName}`;
    this.drawBadge('slots_label', slotLabel, w / 2, 70, Math.min(compact ? 190 : 240, Math.max(94, slotLabel.length * 6 + 18)), 0x3b310f, 0xffdd55, true);

    for (let i = 0; i < 4; i++) {
      const isSelected = i === selectedSlot;
      const slotText = this.texts.get(`slot_${i}`);
      const x = w / 2 - 54 + i * 36;
      if (slotText) {
        slotText.setText(`${i + 1}`);
        slotText.setPosition(x, 92);
        slotText.setStyle({
          fontSize: '9px',
          color: isSelected ? '#1a1300' : '#9aa3b2',
          fontFamily: 'monospace',
          fontStyle: isSelected ? 'bold' : 'normal'
        });
        this.graphics.fillStyle(isSelected ? 0xffdd55 : 0x111723, isSelected ? 1 : 0.76);
        this.graphics.fillRoundedRect(x - 12, 90, 24, 14, 5);
        this.graphics.lineStyle(1, isSelected ? 0xfff2a0 : 0x2d3850, 0.9);
        this.graphics.strokeRoundedRect(x - 12, 90, 24, 14, 5);
      }
    }

    // Form duration bar is attached to the player HUD, not the battle floor.
    if (formActive) {
      this.graphics.fillStyle(0xff4400, 0.35);
      this.graphics.fillRoundedRect(playerX, 101, playerBarW, 4, 2);
      this.graphics.fillStyle(0xff8800, 1);
      this.graphics.fillRoundedRect(playerX, 101, playerBarW * Math.min(formTimeRemaining / 8000, 1), 4, 2);
    }

    // Ability / ultimate indicators
    const abilityText = this.texts.get('ability_ready');
    if (abilityText) {
      abilityText.setPosition(w / 2 - 106, 112);
      if (formActive) {
        abilityText.setText('[I] FORM').setStyle({ fontSize: '9px', color: '#ff8800', fontFamily: 'monospace', fontStyle: 'bold' });
      } else {
        abilityText.setText(abilityReady ? '[I] READY' : '[I] ABILITY').setStyle({
          fontSize: '9px', color: abilityReady ? '#ff8800' : '#656b78', fontFamily: 'monospace', fontStyle: abilityReady ? 'bold' : 'normal'
        });
      }
    }
    const ultText = this.texts.get('ultimate_ready');
    if (ultText) {
      ultText.setPosition(w / 2 + 12, 112);
      ultText.setText(ultimateReady ? '[U] SOULBURST' : '[U] ULT').setStyle({
        fontSize: '9px', color: ultimateReady ? '#ffdd00' : '#656b78', fontFamily: 'monospace', fontStyle: ultimateReady ? 'bold' : 'normal'
      });
    }
  }

  private drawHudBackplate(x: number, y: number, w: number, h: number, accent: number): void {
    this.graphics.fillStyle(0x050711, 0.52);
    this.graphics.fillRoundedRect(x, y, w, h, 10);
    this.graphics.lineStyle(1, accent, 0.22);
    this.graphics.strokeRoundedRect(x, y, w, h, 10);
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
    badge.setAlpha(text ? (active ? 1 : 0.62) : 0);
    badge.setStyle({
      fontSize: key === 'slots_label' ? '10px' : '9px',
      color: active ? '#fff7d0' : '#b7bfcd',
      fontFamily: 'monospace',
      fontStyle: active ? 'bold' : 'normal',
      align: 'center'
    });

    if (!text) return;
    this.graphics.fillStyle(fillColor, active ? 0.82 : 0.5);
    this.graphics.fillRoundedRect(centerX - width / 2, y, width, 15, 6);
    this.graphics.lineStyle(1, accentColor, active ? 0.95 : 0.38);
    this.graphics.strokeRoundedRect(centerX - width / 2, y, width, 15, 6);
  }

  private drawBar(
    x: number, y: number,
    maxW: number, h: number,
    value: number, maxValue: number,
    fillColor: number, bgColor: number
  ): void {
    const pct = Math.max(0, Math.min(1, value / maxValue));
    this.graphics.fillStyle(0x000000, 0.35);
    this.graphics.fillRect(x, y + h + 1, maxW, 2);
    this.graphics.fillStyle(0x111111, 0.9);
    this.graphics.fillRect(x - 1, y - 1, maxW + 2, h + 2);
    this.graphics.fillStyle(bgColor, 1);
    this.graphics.fillRect(x, y, maxW, h);
    this.graphics.fillStyle(fillColor, 1);
    this.graphics.fillRect(x, y, Math.floor(maxW * pct), h);
    this.graphics.lineStyle(1, 0xffffff, 0.08);
    this.graphics.strokeRect(x, y, maxW, h);

    // A tiny highlight keeps compact bars readable without adding more text objects.
    this.graphics.fillStyle(0xffffff, 0.18);
    this.graphics.fillRect(x + 4, y + Math.max(2, Math.floor(h / 2) - 1), Math.min(12, maxW - 8), 1);
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
