import Phaser from 'phaser';
import type { FighterStats } from '../types/minari';
import type { MoveData } from '../types/combat';

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

    // Player name label
    this.addText('player_name', 'Flarepaw', 24, h - 130, {
      fontSize: '13px', color: '#ff7700', fontStyle: 'bold', fontFamily: 'monospace'
    });
    // Enemy name label
    this.addText('enemy_name', 'Droplet', w - 24, h - 130, {
      fontSize: '13px', color: '#00aaff', fontStyle: 'bold', fontFamily: 'monospace', align: 'right'
    }).setOrigin(1, 0);

    // Special slots label
    this.addText('slots_label', 'SPECIALS:', 24, h - 64, {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace'
    });

    // Slot names (4 slots)
    for (let i = 0; i < 4; i++) {
      this.addText(`slot_${i}`, `[${i + 1}] ---`, 24 + i * 160, h - 50, {
        fontSize: '11px', color: '#888888', fontFamily: 'monospace'
      });
    }

    // Ability / ultimate ready indicators
    this.addText('ability_ready', '', w / 2 - 80, h - 64, {
      fontSize: '11px', color: '#ff8800', fontFamily: 'monospace'
    });
    this.addText('ultimate_ready', '', w / 2 + 20, h - 64, {
      fontSize: '11px', color: '#ffdd00', fontFamily: 'monospace'
    });

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
    formTimeRemaining: number
  ): void {
    this.graphics.clear();
    const w = this.width;
    const h = this.height;

    // ── Player bars (left side) ──
    this.drawBar(20, h - 120, 220, 14, playerStats.hp, playerStats.maxHp, 0x22aa22, 0x115511, 'HP');
    this.drawBar(20, h - 100, 180, 10, playerStats.aura, playerStats.maxAura, 0x2244cc, 0x112266, 'AU');
    this.drawBar(20, h - 84, 140, 8, playerStats.soulbond, playerStats.maxSoulbond, 0xddaa00, 0x665500, 'SB');

    // ── Enemy bars (right side) ──
    this.drawBar(w - 240, h - 120, 220, 14, enemyStats.hp, enemyStats.maxHp, 0xcc2222, 0x661111, 'HP');
    this.drawBar(w - 200, h - 100, 180, 10, enemyStats.aura, enemyStats.maxAura, 0x2244cc, 0x112266, 'AU');

    // ── HP/Aura numeric text ──
    // (bars already show percentage visually; skip text to keep it clean)

    // ── Special slots ──
    for (let i = 0; i < 4; i++) {
      const move = specials[i];
      const isSelected = i === selectedSlot;
      const slotText = this.texts.get(`slot_${i}`);
      if (slotText) {
        const label = move ? `[${i + 1}] ${move.name}` : `[${i + 1}] ---`;
        slotText.setText(label);
        slotText.setStyle({
          fontSize: '11px',
          color: isSelected ? '#ffff00' : '#888888',
          fontFamily: 'monospace',
          fontStyle: isSelected ? 'bold' : 'normal'
        });

        // Slot background
        const bx = 20 + i * 165;
        const by = h - 68;
        this.graphics.fillStyle(isSelected ? 0x443300 : 0x1a1a1a, 0.8);
        this.graphics.fillRect(bx - 4, by - 2, 158, 18);
        if (isSelected) {
          this.graphics.lineStyle(1, 0xffdd00, 1);
          this.graphics.strokeRect(bx - 4, by - 2, 158, 18);
        }
      }
    }

    // Form duration bar
    if (formActive) {
      this.graphics.fillStyle(0xff4400, 0.4);
      this.graphics.fillRect(20, h - 70, 220, 5);
      this.graphics.fillStyle(0xff8800, 1);
      // formTimeRemaining in ms, duration 8000
      this.graphics.fillRect(20, h - 70, 220 * Math.min(formTimeRemaining / 8000, 1), 5);
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

  private drawBar(
    x: number, y: number,
    maxW: number, h: number,
    value: number, maxValue: number,
    fillColor: number, bgColor: number,
    label: string
  ): void {
    const pct = Math.max(0, Math.min(1, value / maxValue));
    this.graphics.fillStyle(0x111111, 0.9);
    this.graphics.fillRect(x - 1, y - 1, maxW + 2, h + 2);
    this.graphics.fillStyle(bgColor, 1);
    this.graphics.fillRect(x, y, maxW, h);
    this.graphics.fillStyle(fillColor, 1);
    this.graphics.fillRect(x, y, Math.floor(maxW * pct), h);
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
