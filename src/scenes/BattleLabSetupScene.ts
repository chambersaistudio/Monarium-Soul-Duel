import Phaser from 'phaser';
import { applyHighDpiCanvas } from '../config/highDpi';
import { MINARI_ROSTER } from '../data/minariData';
import { UI_THEME, elementColor, elementLabel } from '../config/uiTheme';
import { drawGlassPanel } from '../ui/phaserUi';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';
import type { ClassicBattleContext } from '../types/overworld';

const SELECTABLE_MONARI = ['flarepaw', 'droplet', 'sproutodon', 'umbravine'] as const;
const MIN_LEVEL = 1;
const MAX_LEVEL = 50;

export class BattleLabSetupScene extends Phaser.Scene {
  private playerIdx   = 0;
  private enemyIdx    = 1;
  private playerLevel = 7;
  private enemyLevel  = 7;

  private objects: Phaser.GameObjects.GameObject[] = [];
  private audio!: AudioManager;

  constructor() { super({ key: 'BattleLabSetupScene' }); }

  create(): void {
    applyHighDpiCanvas(this.game, 'battle-lab-setup:create');
    this.playerIdx   = 0;
    this.enemyIdx    = 1;
    this.playerLevel = 7;
    this.enemyLevel  = 7;
    this.objects     = [];

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    this.buildUI();
    this.cameras.main.fadeIn(300);
  }

  private obj<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private rebuild(): void {
    this.objects.forEach(o => o.destroy());
    this.objects = [];
    this.buildUI();
  }

  private buildUI(): void {
    const { width: w, height: h } = this.scale;

    // Background
    const bg = this.obj(this.add.graphics());
    for (let i = 0; i < h; i += 4) {
      const t = i / h;
      bg.fillStyle(Phaser.Display.Color.GetColor(
        Math.floor(Phaser.Math.Linear(6, 14, t)),
        Math.floor(Phaser.Math.Linear(4, 8, t)),
        Math.floor(Phaser.Math.Linear(18, 10, t)),
      ), 1);
      bg.fillRect(0, i, w, 4);
    }

    // Title
    this.obj(this.add.text(w / 2, 34, 'BATTLE LAB', {
      fontSize: '32px', color: '#ff8c00', fontStyle: 'bold', fontFamily: UI_THEME.fonts.family,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2));
    this.obj(this.add.text(w / 2, 66, 'Choose your combatants and start the fight', {
      fontSize: '13px', color: '#8888aa', fontFamily: UI_THEME.fonts.family,
    }).setOrigin(0.5).setDepth(2));

    const colW   = (w - 80) / 2;
    const startY = 92;

    // Player column
    this.buildSelectorColumn('Player', 40, startY, colW, h - startY - 80, true);
    // Enemy column
    this.buildSelectorColumn('Enemy', 40 + colW + 20, startY, colW, h - startY - 80, false);

    // Bottom buttons
    const btnY = h - 52;
    this.buildButton(w / 2 - 108, btnY, 100, 38, 'Back', '#888899', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('ModeSelectScene');
      });
    });
    this.buildButton(w / 2 + 8, btnY, 100, 38, 'Start Battle', '#ffcc44', () => this.startBattle());

    // ESC = back
    this.input.keyboard!.once('keydown-ESC', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('ModeSelectScene');
      });
    });
  }

  private buildSelectorColumn(
    label: string,
    x: number, y: number, cw: number, ch: number,
    isPlayer: boolean,
  ): void {
    const panG = this.obj(this.add.graphics().setDepth(1));
    drawGlassPanel(panG, x, y, cw, ch, {
      radius:  20,
      fill:    UI_THEME.colors.panelDeep,
      stroke:  isPlayer ? UI_THEME.colors.gold : UI_THEME.colors.purple,
      glow:    isPlayer ? UI_THEME.colors.gold : UI_THEME.colors.purple,
      alpha:   0.88,
    });

    this.obj(this.add.text(x + cw / 2, y + 22, label, {
      fontSize: '16px', color: isPlayer ? '#fff0b8' : '#ccc0ff',
      fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2));

    // Monari grid — 2×2
    const gridX   = x + 12;
    const gridY   = y + 44;
    const cellW   = (cw - 32) / 2;
    const cellH   = 68;

    SELECTABLE_MONARI.forEach((id, i) => {
      const cx  = gridX + (i % 2) * (cellW + 8);
      const cy  = gridY + Math.floor(i / 2) * (cellH + 6);
      const sel = isPlayer ? this.playerIdx === i : this.enemyIdx === i;
      const data = MINARI_ROSTER[id];
      const col  = elementColor(data?.element ?? 'neutral');

      const cardG = this.obj(this.add.graphics().setDepth(2));
      drawGlassPanel(cardG, cx, cy, cellW, cellH, {
        radius: 12,
        fill:   sel ? 0x1a1050 : UI_THEME.colors.glass,
        stroke: sel ? col : 0x334466,
        glow:   sel ? col : 0x222233,
        alpha:  0.82,
      });

      this.obj(this.add.text(cx + cellW / 2, cy + 20, data?.name ?? id, {
        fontSize: '13px', color: sel ? '#ffffff' : '#aaa8cc',
        fontFamily: UI_THEME.fonts.family, fontStyle: sel ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(3));

      this.obj(this.add.text(cx + cellW / 2, cy + 40, elementLabel(data?.element ?? 'neutral'), {
        fontSize: '10px', color: '#' + col.toString(16).padStart(6, '0'),
        fontFamily: UI_THEME.fonts.family,
      }).setOrigin(0.5).setDepth(3));

      if (sel) {
        this.obj(this.add.text(cx + cellW / 2, cy + 55, '✓ Selected', {
          fontSize: '9px', color: '#88ffcc', fontFamily: UI_THEME.fonts.family,
        }).setOrigin(0.5).setDepth(3));
      }

      cardG.setInteractive(new Phaser.Geom.Rectangle(cx, cy, cellW, cellH), Phaser.Geom.Rectangle.Contains);
      cardG.on('pointerdown', () => {
        if (isPlayer) this.playerIdx = i;
        else          this.enemyIdx  = i;
        this.audio.playUi(AUDIO_KEYS.ui.move);
        this.rebuild();
      });
    });

    // Level control
    const lvlY = y + ch - 48;
    const curLevel = isPlayer ? this.playerLevel : this.enemyLevel;

    this.obj(this.add.text(x + cw / 2 - 30, lvlY + 14, `Lv. ${curLevel}`, {
      fontSize: '18px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3));

    this.buildButton(x + 16, lvlY, 30, 30, '−', '#cc8866', () => {
      if (isPlayer) this.playerLevel = Math.max(MIN_LEVEL, this.playerLevel - 1);
      else          this.enemyLevel  = Math.max(MIN_LEVEL, this.enemyLevel  - 1);
      this.rebuild();
    });
    this.buildButton(x + cw - 46, lvlY, 30, 30, '+', '#66cc88', () => {
      if (isPlayer) this.playerLevel = Math.min(MAX_LEVEL, this.playerLevel + 1);
      else          this.enemyLevel  = Math.min(MAX_LEVEL, this.enemyLevel  + 1);
      this.rebuild();
    });
  }

  private buildButton(
    x: number, y: number, bw: number, bh: number,
    label: string, color: string, cb: () => void,
  ): void {
    const g = this.obj(this.add.graphics().setDepth(3));
    drawGlassPanel(g, x, y, bw, bh, {
      radius: 10, fill: UI_THEME.colors.glass,
      stroke: 0x445566, glow: 0x223344, alpha: 0.85,
    });
    g.setInteractive(new Phaser.Geom.Rectangle(x, y, bw, bh), Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => { this.audio.playUi(AUDIO_KEYS.ui.confirm); cb(); });
    g.on('pointerover',  () => g.setAlpha(0.7));
    g.on('pointerout',   () => g.setAlpha(1.0));
    this.obj(this.add.text(x + bw / 2, y + bh / 2, label, {
      fontSize: bw > 60 ? '14px' : '16px', color, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4));
  }

  private startBattle(): void {
    const ctx: ClassicBattleContext = {
      returnMap:      'starter_village',
      returnSpawn:    'default',
      playerMinariId: SELECTABLE_MONARI[this.playerIdx],
      enemyMinariId:  SELECTABLE_MONARI[this.enemyIdx],
      bondable:       false,
      battleType:     'lab',
      playerLevel:    this.playerLevel,
      enemyLevel:     this.enemyLevel,
      labMode:        true,
    };
    this.registry.set('classic_battle_context', ctx);
    this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p !== 1) return;
      applyHighDpiCanvas(this.game, 'battle-lab:start-battle:sync-now');
      requestAnimationFrame(() => {
        applyHighDpiCanvas(this.game, 'battle-lab:start-battle:sync-raf');
        window.setTimeout(() => {
          applyHighDpiCanvas(this.game, 'battle-lab:start-battle:sync-settled');
          this.scene.start('ClassicSoulDuelScene');
        }, 80);
      });
    });
  }
}
