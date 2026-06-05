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
    const compact = w < 760;

    // Player / enemy labels stay inside the canvas-safe HUD panel.
    this.addText('player_name', 'FLAREPAW', 24, h - 170, {
      fontSize: '12px', color: '#ff9a3d', fontStyle: 'bold', fontFamily: 'monospace'
    });
    this.addText('enemy_name', 'DROPLET', w - 24, h - 170, {
      fontSize: '12px', color: '#66d7ff', fontStyle: 'bold', fontFamily: 'monospace', align: 'right'
    }).setOrigin(1, 0);

    this.addText('player_values', '', 24, h - 156, {
      fontSize: '10px', color: '#dce7d3', fontFamily: 'monospace'
    });
    this.addText('enemy_values', '', w - 24, h - 156, {
      fontSize: '10px', color: '#dce7d3', fontFamily: 'monospace', align: 'right'
    }).setOrigin(1, 0);

    this.addText('state_chip_training', '', w / 2, h - 174, {
      fontSize: '10px', color: '#7dffb2', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_guard', '', w / 2 - 82, h - 152, {
      fontSize: '10px', color: '#7aa7ff', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_flame_guard', '', w / 2 + 82, h - 152, {
      fontSize: '10px', color: '#ffb15e', fontStyle: 'bold', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);
    this.addText('state_chip_anim', '', w / 2, h - 130, {
      fontSize: '10px', color: '#cccccc', fontFamily: 'monospace', align: 'center'
    }).setOrigin(0.5, 0);

    // Special slots label and slots; positions are recalculated during update for mobile-friendly wrapping.
    this.addText('slots_label', 'SPECIAL SLOT', 24, h - 86, {
      fontSize: '10px', color: '#d7c777', fontStyle: 'bold', fontFamily: 'monospace'
    });

    for (let i = 0; i < 4; i++) {
      this.addText(`slot_${i}`, `[${i + 1}] ---`, 24 + (i % (compact ? 2 : 4)) * 160, h - 68 + Math.floor(i / (compact ? 2 : 4)) * 20, {
        fontSize: '11px', color: '#888888', fontFamily: 'monospace'
      });
    }

    // Ability / ultimate ready indicators double as a compact battle control legend.
    this.addText('ability_ready', '', w / 2 - 130, h - 42, {
      fontSize: '10px', color: '#ff8800', fontFamily: 'monospace'
    });
    this.addText('ultimate_ready', '', w / 2 + 24, h - 42, {
      fontSize: '10px', color: '#ffdd00', fontFamily: 'monospace'
    });
    this.addText('controls_hint', '←/→ MOVE  ↑ JUMP  ↓/S GUARD  J ATTACK  K SPECIAL  L DODGE', w / 2, h - 22, {
      fontSize: compact ? '9px' : '10px', color: '#adb8c7', fontFamily: 'monospace', align: 'center'
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
    const h = this.height;

    const panelX = 14;
    const panelY = h - 184;
    const panelW = w - 28;
    const panelH = 170;
    const compact = w < 760;
    const playerBarW = compact ? Math.min(210, w * 0.34) : 230;
    const enemyBarW = playerBarW;
    const playerX = 24;
    const enemyX = w - 24 - enemyBarW;
    const hpY = h - 138;
    const auraY = h - 112;
    const soulY = h - 91;

    // Contained, mobile-first HUD surface.
    this.graphics.fillStyle(0x050711, 0.74);
    this.graphics.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    this.graphics.lineStyle(1, 0x27324a, 0.95);
    this.graphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);

    // ── Player bars (left side) ──
    this.drawBar(playerX, hpY, playerBarW, 16, playerStats.hp, playerStats.maxHp, 0x2ee86f, 0x114421);
    this.drawBar(playerX, auraY, playerBarW, 12, playerStats.aura, playerStats.maxAura, 0x4a73ff, 0x112266);
    this.drawBar(playerX, soulY, Math.floor(playerBarW * 0.74), 8, playerStats.soulbond, playerStats.maxSoulbond, 0xffcc33, 0x665500);

    // ── Enemy bars (right side) ──
    this.drawBar(enemyX, hpY, enemyBarW, 16, enemyStats.hp, enemyStats.maxHp, 0xff5252, 0x661111);
    this.drawBar(enemyX, auraY, enemyBarW, 12, enemyStats.aura, enemyStats.maxAura, 0x4a73ff, 0x112266);

    const playerValues = this.texts.get('player_values');
    if (playerValues) {
      playerValues.setText(`HP ${Math.ceil(playerStats.hp)}/${playerStats.maxHp}  AU ${Math.floor(playerStats.aura)}/${playerStats.maxAura}`);
    }
    const enemyValues = this.texts.get('enemy_values');
    if (enemyValues) {
      enemyValues.setText(`HP ${Math.ceil(enemyStats.hp)}/${enemyStats.maxHp}  AU ${Math.floor(enemyStats.aura)}/${enemyStats.maxAura}`);
    }

    // ── Read-only gameplay state chips ──
    this.updateChip('state_chip_training', hudState.trainingModeActive === true ? 'TRAINING MODE' : '');
    this.updateChip('state_chip_guard', hudState.guardActive === true ? 'GUARD ACTIVE' : 'GUARD READY', hudState.guardActive === true);
    this.updateChip('state_chip_flame_guard', hudState.flameGuardActive === true ? 'FLAME GUARD' : 'FLAME GUARD OFF', hudState.flameGuardActive === true);
    const animText = hudState.currentAnimationState ? `STATE ${hudState.currentAnimationState.toUpperCase()}` : '';
    const animChip = this.texts.get('state_chip_anim');
    if (animChip) animChip.setText(animText);

    // ── Special slots ──
    const slotColumns = compact ? 2 : 4;
    const slotW = compact ? Math.min(188, (w - 56) / 2) : Math.min(172, (w - 72) / 4);
    const slotsStartX = 24;
    const slotsStartY = h - 76;
    const slotGapX = compact ? 8 : 12;
    const slotGapY = 20;
    const slotsLabel = this.texts.get('slots_label');
    if (slotsLabel) {
      const selectedMove = specials[selectedSlot];
      slotsLabel.setText(selectedMove ? `SPECIAL SLOT ${selectedSlot + 1}: ${selectedMove.name}` : `SPECIAL SLOT ${selectedSlot + 1}`);
      slotsLabel.setPosition(slotsStartX, h - 91);
    }

    for (let i = 0; i < 4; i++) {
      const move = specials[i];
      const isSelected = i === selectedSlot;
      const slotText = this.texts.get(`slot_${i}`);
      const col = i % slotColumns;
      const row = Math.floor(i / slotColumns);
      const bx = slotsStartX + col * (slotW + slotGapX);
      const by = slotsStartY + row * slotGapY;
      if (slotText) {
        const label = move ? `[${i + 1}] ${move.name}` : `[${i + 1}] ---`;
        slotText.setText(label);
        slotText.setPosition(bx + 8, by + 2);
        slotText.setStyle({
          fontSize: compact ? '10px' : '11px',
          color: isSelected ? '#fff7a8' : '#9aa3b2',
          fontFamily: 'monospace',
          fontStyle: isSelected ? 'bold' : 'normal'
        });

        this.graphics.fillStyle(isSelected ? 0x4a3b09 : 0x111723, isSelected ? 0.96 : 0.84);
        this.graphics.fillRoundedRect(bx, by, slotW, 17, 6);
        this.graphics.lineStyle(1, isSelected ? 0xffdd55 : 0x2d3850, isSelected ? 1 : 0.8);
        this.graphics.strokeRoundedRect(bx, by, slotW, 17, 6);
        if (isSelected) {
          this.graphics.fillStyle(0xffdd55, 1);
          this.graphics.fillTriangle(bx + 4, by + 5, bx + 4, by + 13, bx + 10, by + 9);
        }
      }
    }

    // Form duration bar sits above the lower control hint without overlapping slots.
    if (formActive) {
      this.graphics.fillStyle(0xff4400, 0.35);
      this.graphics.fillRoundedRect(playerX, h - 52, playerBarW, 5, 3);
      this.graphics.fillStyle(0xff8800, 1);
      this.graphics.fillRoundedRect(playerX, h - 52, playerBarW * Math.min(formTimeRemaining / 8000, 1), 5, 3);
    }

    // Ability / ultimate indicators
    const abilityText = this.texts.get('ability_ready');
    if (abilityText) {
      if (formActive) {
        abilityText.setText('[I] FORM ACTIVE').setStyle({ fontSize: '11px', color: '#ff8800', fontFamily: 'monospace' });
      } else {
        abilityText.setText(abilityReady ? '[I] ABILITY RDY' : '[I] ABILITY').setStyle({
          fontSize: '11px', color: abilityReady ? '#ff8800' : '#555555', fontFamily: 'monospace'
        });
      }
    }
    const ultText = this.texts.get('ultimate_ready');
    if (ultText) {
      ultText.setText(ultimateReady ? '[U] SOULBURST!' : '[U] ULTIMATE').setStyle({
        fontSize: '11px', color: ultimateReady ? '#ffdd00' : '#555555', fontFamily: 'monospace'
      });
    }
  }

  private updateChip(key: string, text: string, active = true): void {
    const chip = this.texts.get(key);
    if (!chip) return;
    chip.setText(text);
    chip.setAlpha(text ? (active ? 1 : 0.58) : 0);
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
