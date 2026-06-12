import Phaser from 'phaser';
import { applyHighDpiCanvas } from '../config/highDpi';
import { MINARI_ROSTER } from '../data/minariData';
import { UI_THEME, elementColor, elementLabel } from '../config/uiTheme';
import { drawGlassPanel } from '../ui/phaserUi';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';
import type { BattleStatOverrides, ClassicBattleContext } from '../types/overworld';

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
  private overlay?: HTMLDivElement;
  private playerOverrides: BattleStatOverrides = {};
  private enemyOverrides: BattleStatOverrides = {};
  private debugEnabled = false;

  constructor() { super({ key: 'BattleLabSetupScene' }); }

  create(): void {
    applyHighDpiCanvas(this.game, 'battle-lab-setup:create');
    this.playerIdx   = 0;
    this.enemyIdx    = 1;
    this.playerLevel = 7;
    this.enemyLevel  = 7;
    this.objects     = [];
    this.playerOverrides = {};
    this.enemyOverrides = {};
    this.debugEnabled = false;

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    this.cameras.main.setBackgroundColor('#05050a');
    this.showDomOverlay();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hideDomOverlay());
    this.cameras.main.fadeIn(300);
  }


  private statValue(side: 'player' | 'enemy', stat: keyof BattleStatOverrides): number {
    const id = SELECTABLE_MONARI[side === 'player' ? this.playerIdx : this.enemyIdx];
    const base = MINARI_ROSTER[id]?.stats;
    const fallback = stat === 'defense' ? base?.defense : stat === 'speed' ? base?.speed : base?.power;
    const overrides = side === 'player' ? this.playerOverrides : this.enemyOverrides;
    return overrides[stat] ?? fallback ?? 50;
  }

  private setStatValue(side: 'player' | 'enemy', stat: keyof BattleStatOverrides, value: number): number {
    const overrides = side === 'player' ? this.playerOverrides : this.enemyOverrides;
    overrides[stat] = Phaser.Math.Clamp(Math.round(value), 1, 150);
    // Deliberately no renderDomOverlay() here: rebuilding the overlay's
    // innerHTML mid-drag destroys the range input under the user's finger and
    // resets the card's scroll position. The slider handler updates its own
    // value label in place instead.
    return overrides[stat];
  }

  private showDomOverlay(): void {
    this.hideDomOverlay();
    this.overlay = document.createElement('div');
    this.overlay.id = 'battle-lab-dom-overlay';
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));box-sizing:border-box;background:radial-gradient(circle at 50% 10%,rgba(122,74,255,.26),transparent 34%),rgba(4,4,12,.94);color:#fff4c7;font-family:Rajdhani,Orbitron,sans-serif;';
    document.body.appendChild(this.overlay);
    this.renderDomOverlay();
  }

  private hideDomOverlay(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private renderDomOverlay(): void {
    if (!this.overlay) return;
    // Rebuilding innerHTML resets the scrollable card; keep the user's place.
    const prevScroll = this.overlay.querySelector('.blab-card')?.scrollTop ?? 0;
    const buildSide = (side: 'player' | 'enemy') => {
      const idx = side === 'player' ? this.playerIdx : this.enemyIdx;
      const level = side === 'player' ? this.playerLevel : this.enemyLevel;
      const ids = SELECTABLE_MONARI.map((id, i) => `<button data-side="${side}" data-pick="${i}" class="blab-pill ${idx === i ? 'active' : ''}">${MINARI_ROSTER[id]?.name ?? id}</button>`).join('');
      const stats: Array<[keyof BattleStatOverrides,string]> = [['attack','Attack'],['specialAttack','Sp. Attack'],['defense','Defense'],['specialDefense','Sp. Defense'],['speed','Speed']];
      return `<section class="blab-panel"><h2>${side === 'player' ? 'Player' : 'Enemy'}</h2><div class="blab-picks">${ids}</div><div class="blab-level"><button data-side="${side}" data-level="-1">−</button><b>Lv. ${level}</b><button data-side="${side}" data-level="1">+</button></div><div class="blab-stats">${stats.map(([key,label]) => `<label><span>${label}</span><input type="range" min="1" max="150" value="${this.statValue(side,key)}" data-side="${side}" data-stat="${key}"><b>${this.statValue(side,key)}</b></label>`).join('')}</div></section>`;
    };
    this.overlay.innerHTML = `<style>
      .blab-card{width:min(94vw,980px);max-height:92vh;overflow:auto;border:1px solid rgba(255,190,108,.5);border-radius:28px;background:rgba(6,6,18,.96);box-shadow:0 20px 70px rgba(0,0,0,.55),0 0 32px rgba(122,74,255,.18);padding:18px;box-sizing:border-box}.blab-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.blab-head h1{margin:0;font-family:Orbitron, Rajdhani, sans-serif;color:#ffbf72}.blab-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.blab-panel{border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(255,255,255,.055);padding:14px}.blab-panel h2{margin:0 0 10px;color:#fff4c7}.blab-picks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.blab-pill,.blab-actions button,.blab-level button{border:1px solid rgba(255,190,108,.45);border-radius:999px;background:rgba(122,74,255,.18);color:#fff4c7;font-weight:900;min-height:38px}.blab-pill.active{background:rgba(255,142,64,.28);box-shadow:0 0 16px rgba(255,142,64,.25)}.blab-level{display:flex;align-items:center;justify-content:center;gap:12px;margin:12px 0}.blab-level button{width:42px}.blab-stats{display:grid;gap:8px}.blab-stats label{display:grid;grid-template-columns:92px 1fr 34px;gap:8px;align-items:center}.blab-stats input[type=range]{touch-action:none;width:100%;min-height:34px;margin:0}.blab-stats span{color:#ffcf8a;font-weight:800}.blab-stats b{text-align:right}.blab-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}.blab-debug{display:flex;gap:8px;align-items:center;color:#cfc7ff}.blab-actions button{padding:0 18px}.blab-note{color:#9e96c9;font-size:14px}@media(max-width:720px){.blab-grid{grid-template-columns:1fr}.blab-card{padding:14px}.blab-head{display:block}.blab-stats label{grid-template-columns:84px 1fr 30px}}
    </style><div class="blab-card"><div class="blab-head"><div><h1>Battle Lab</h1><div class="blab-note">Choose Monari, levels, stat test values, and enable formula debug.</div></div><label class="blab-debug"><input type="checkbox" id="blab-debug" ${this.debugEnabled ? 'checked' : ''}> Debug formula</label></div><div class="blab-grid">${buildSide('player')}${buildSide('enemy')}</div><div class="blab-actions"><button id="blab-back">Back</button><button id="blab-start">Start Battle</button></div></div>`;
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(btn => btn.onclick = () => { const side = btn.dataset.side as 'player'|'enemy'; if (side === 'player') this.playerIdx = Number(btn.dataset.pick); else this.enemyIdx = Number(btn.dataset.pick); this.audio.playUi(AUDIO_KEYS.ui.move); this.renderDomOverlay(); });
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(btn => btn.onclick = () => { const side = btn.dataset.side as 'player'|'enemy'; const delta = Number(btn.dataset.level); if (side === 'player') this.playerLevel = Phaser.Math.Clamp(this.playerLevel + delta, MIN_LEVEL, MAX_LEVEL); else this.enemyLevel = Phaser.Math.Clamp(this.enemyLevel + delta, MIN_LEVEL, MAX_LEVEL); this.renderDomOverlay(); });
    this.overlay.querySelectorAll<HTMLInputElement>('[data-stat]').forEach(input => input.oninput = () => {
      const value = this.setStatValue(input.dataset.side as 'player'|'enemy', input.dataset.stat as keyof BattleStatOverrides, Number(input.value));
      const label = input.parentElement?.querySelector('b');
      if (label) label.textContent = String(value);
    });
    this.overlay.querySelector<HTMLInputElement>('#blab-debug')!.onchange = (e) => { this.debugEnabled = (e.currentTarget as HTMLInputElement).checked; };
    this.overlay.querySelector<HTMLButtonElement>('#blab-back')!.onclick = () => { this.hideDomOverlay(); this.scene.start('ModeSelectScene'); };
    this.overlay.querySelector<HTMLButtonElement>('#blab-start')!.onclick = () => this.startBattle();
    const card = this.overlay.querySelector('.blab-card');
    if (card) card.scrollTop = prevScroll;
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
      labDebug:       this.debugEnabled,
      playerStatOverrides: this.playerOverrides,
      enemyStatOverrides:  this.enemyOverrides,
    };
    this.hideDomOverlay();
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
