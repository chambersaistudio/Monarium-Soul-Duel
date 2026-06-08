import Phaser from 'phaser';
import { ClassicActor } from '../entities/ClassicActor';
import { ClassicBattleEngine } from '../systems/ClassicBattleEngine';
import { AudioManager } from '../systems/AudioManager';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS, BACK_COMMAND } from '../data/classicMoveData';
import { MINARI_ROSTER } from '../data/minariData';
import { CLASSIC_BATTLE_CONFIG } from '../config/classicBattleConfig';
import { AUDIO_KEYS } from '../config/audioConfig';
import { IS_TOUCH_DEVICE, SAFE_AREA_BOTTOM } from '../config/mobileConfig';
import type { ClassicBattlePhase, ClassicActorRole } from '../types/classic';
import type { ClassicBattleContext } from '../types/overworld';

// ── HUD button colour schemes ────────────────────────────────────────────────

interface BtnTheme { fill: number; selFill: number; border: number; accent: number }

const MAIN_BTN_THEMES: Record<string, BtnTheme> = {
  fight:   { fill: 0x2a0800, selFill: 0x6a1800, border: 0xff6622, accent: 0xff4400 },
  bag:     { fill: 0x061426, selFill: 0x0f2e5a, border: 0x3a88ff, accent: 0x2266dd },
  capture: { fill: 0x062010, selFill: 0x0f4422, border: 0x33cc77, accent: 0x228855 },
  run:     { fill: 0x14141e, selFill: 0x262636, border: 0x7788aa, accent: 0x556688 },
};

function dmgTypeTheme(type: string): BtnTheme {
  switch (type) {
    case 'physical': return { fill: 0x2d1500, selFill: 0x5a2a00, border: 0xcc6622, accent: 0xff7733 };
    case 'ember':    return { fill: 0x2d0800, selFill: 0x5a1000, border: 0xee3300, accent: 0xff5522 };
    case 'water':    return { fill: 0x001433, selFill: 0x002266, border: 0x2266ee, accent: 0x4488ff };
    case 'none':     return { fill: 0x0e1e2e, selFill: 0x1a3248, border: 0x5588aa, accent: 0x88aacc };
    default:         return { fill: 0x111128, selFill: 0x1e1e44, border: 0x4455aa, accent: 0x6677bb };
  }
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class ClassicSoulDuelScene extends Phaser.Scene {
  // Combatants
  private playerActor!: ClassicActor;
  private enemyActor!:  ClassicActor;
  private engine!:      ClassicBattleEngine;
  private audio!:       AudioManager;

  // Layout
  private groundY!:    number;
  private pAnchorX!:   number;
  private eAnchorX!:   number;
  private hpBarW!:     number;
  private hpBarH!:     number;
  private hudY!:       number;
  private hudH!:       number;

  // HP widgets
  private playerHpFill!: Phaser.GameObjects.Rectangle;
  private enemyHpFill!:  Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!:  Phaser.GameObjects.Text;

  // ── New battle HUD ─────────────────────────────────────────────────────────
  private hudGroup!:    Phaser.GameObjects.Container;
  private mainPanel!:   Phaser.GameObjects.Container;
  private movesPanel!:  Phaser.GameObjects.Container;
  private hudPhase:     'main' | 'moves' = 'main';
  private menuVisible   = false;

  // Main-panel state
  private mainCursor      = 0;
  private mainBtnGfxs:    Phaser.GameObjects.Graphics[] = [];
  private mainBtnTexts:   Phaser.GameObjects.Text[]     = [];
  private mainBtnW        = 0;
  private mainBtnH        = 0;
  private readonly MAIN_BTNS = [
    { key: 'fight',   label: 'FIGHT',   icon: '⚔' },
    { key: 'bag',     label: 'BAG',     icon: '🎒' },
    { key: 'capture', label: 'CAPTURE', icon: '◎'  },
    { key: 'run',     label: 'RUN',     icon: '↩'  },
  ] as const;

  // Moves-panel state
  private menuCursor      = 0;
  private prevCursor      = -1;
  private menuCommandIds: string[] = [];
  private moveBtnGfxs:    Phaser.GameObjects.Graphics[] = [];
  private moveBtnTexts:   Phaser.GameObjects.Text[]     = [];
  private moveBtnThemes:  BtnTheme[]                    = [];
  private moveBtnW        = 0;
  private moveBtnH        = 0;
  private readonly MOVE_COLS = 2;

  // Misc UI
  private phaseLabel!: Phaser.GameObjects.Text;
  private guardLabel!: Phaser.GameObjects.Text;

  // Input
  private upKey!:    Phaser.Input.Keyboard.Key;
  private downKey!:  Phaser.Input.Keyboard.Key;
  private leftKey!:  Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!:   Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'ClassicSoulDuelScene' }); }

  // ── Preload ────────────────────────────────────────────────────────────────

  preload(): void {
    const { background } = CLASSIC_BATTLE_CONFIG;
    this.load.image(`bg_${background}`, `assets/backgrounds/classic/${background}.png`);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    const { width: w, height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;

    // ── Layout ────────────────────────────────────────────────────────────────
    this.groundY  = Math.round(h * (mob ? 0.60 : 0.70));
    this.pAnchorX = Math.round(w * 0.20);
    this.eAnchorX = Math.round(w * 0.80);
    this.hpBarW   = mob ? Math.round(w * 0.28) : 200;
    this.hpBarH   = mob ? 18 : 14;
    this.hudH     = mob ? 92 : 100;
    this.hudY     = h - this.hudH - (mob ? SAFE_AREA_BOTTOM : 0);

    this.drawBackground(w, h);

    // ── Combatants — read from overworld battle context if present ─────────────
    const ctx          = this.registry.get('classic_battle_context') as ClassicBattleContext | null;
    const playerMinId  = ctx?.playerMinariId ?? 'flarepaw';
    const enemyMinId   = ctx?.enemyMinariId  ?? 'droplet';
    const playerData   = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData    = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];

    this.playerActor = new ClassicActor(
      this, this.pAnchorX, this.groundY - playerData.bodyHeight / 2, playerData, true,
    );
    this.enemyActor = new ClassicActor(
      this, this.eAnchorX, this.groundY - enemyData.bodyHeight / 2, enemyData, false,
    );

    // ── Engine ────────────────────────────────────────────────────────────────
    this.engine = new ClassicBattleEngine(this, this.playerActor, this.enemyActor, {
      onPhaseChange:     (p)             => this.onPhaseChange(p),
      onShowCommandMenu: ()              => this.showMenu(),
      onHideCommandMenu: ()              => this.hideMenu(),
      onDamageDealt:     (t, d, b, x, y) => this.onDamageDealt(t, d, b, x, y),
      onBattleEnd:       (winner)        => this.onBattleEnd(winner),
    });

    // ── Audio ─────────────────────────────────────────────────────────────────
    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.battle);

    // ── UI ────────────────────────────────────────────────────────────────────
    this.buildHpBars(w, playerData.name, enemyData.name);
    this.buildBattleHud(w, h, playerData.id);
    this.buildLabels(w);

    // ── Input ─────────────────────────────────────────────────────────────────
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.upKey    = this.input.keyboard!.addKey(K.UP);
    this.downKey  = this.input.keyboard!.addKey(K.DOWN);
    this.leftKey  = this.input.keyboard!.addKey(K.LEFT);
    this.rightKey = this.input.keyboard!.addKey(K.RIGHT);
    this.enterKey = this.input.keyboard!.addKey(K.ENTER);
    this.escKey   = this.input.keyboard!.addKey(K.ESC);

    this.cameras.main.fadeIn(500);
    this.time.delayedCall(800, () => this.engine.startBattle());
  }

  update(): void {
    this.playerActor.updateShadow();
    this.enemyActor.updateShadow();
    this.refreshHpBars();
    this.updateGuardLabel();

    if (!this.menuVisible) return;

    const jUp    = Phaser.Input.Keyboard.JustDown(this.upKey);
    const jDown  = Phaser.Input.Keyboard.JustDown(this.downKey);
    const jLeft  = Phaser.Input.Keyboard.JustDown(this.leftKey);
    const jRight = Phaser.Input.Keyboard.JustDown(this.rightKey);
    const jOk    = Phaser.Input.Keyboard.JustDown(this.enterKey);
    const jEsc   = Phaser.Input.Keyboard.JustDown(this.escKey);

    if (this.hudPhase === 'main') {
      const n = this.MAIN_BTNS.length;
      if (jLeft  || jUp)   { this.mainCursor = (this.mainCursor - 1 + n) % n; this.refreshMainCursor(); this.audio.playUi(AUDIO_KEYS.ui.move); }
      if (jRight || jDown) { this.mainCursor = (this.mainCursor + 1) % n;     this.refreshMainCursor(); this.audio.playUi(AUDIO_KEYS.ui.move); }
      if (jOk)             { this.activateMainBtn(this.mainCursor); }
    } else {
      const n = this.menuCommandIds.length;
      if (jLeft  || jUp)   { this.menuCursor = (this.menuCursor - 1 + n) % n; this.refreshMoveCursor(); }
      if (jRight || jDown) { this.menuCursor = (this.menuCursor + 1) % n;     this.refreshMoveCursor(); }
      if (jOk)  { this.confirmMove(); }
      if (jEsc) { this.audio.playUi(AUDIO_KEYS.ui.move); this.showMainPanel(); }

      if (this.menuCursor !== this.prevCursor) {
        if (this.prevCursor !== -1) this.audio.playUi(AUDIO_KEYS.ui.move);
        this.prevCursor = this.menuCursor;
      }
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const bgKey = `bg_${CLASSIC_BATTLE_CONFIG.background}`;
    if (this.textures.exists(bgKey)) {
      // Cover-scale: fill the viewport while preserving aspect ratio (edges crop, no stretch)
      const frame  = this.textures.getFrame(bgKey);
      const scale  = Math.max(w / frame.realWidth, h / frame.realHeight);
      this.add.image(w / 2, h / 2, bgKey).setDepth(0).setScale(scale);

      // Subtle top scrim so HP bars read against any background
      const topScrim = this.add.graphics().setDepth(1);
      topScrim.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.52, 0.52, 0, 0);
      topScrim.fillRect(0, 0, w, 90);

      // Slightly darken the floor zone to visually ground the characters
      const floorOv = this.add.graphics().setDepth(1);
      floorOv.fillStyle(0x000000, 0.28);
      floorOv.fillRect(0, this.groundY, w, h - this.groundY);
    } else {
      const bg = this.add.graphics().setDepth(0);
      for (let i = 0; i < h; i += 3) {
        const t = i / h;
        bg.fillStyle(Phaser.Display.Color.GetColor(
          Math.floor(Phaser.Math.Linear(10, 30, t)),
          Math.floor(Phaser.Math.Linear(5,  15, t)),
          Math.floor(Phaser.Math.Linear(20, 10, t)),
        ), 1);
        bg.fillRect(0, i, w, 3);
      }
      bg.fillStyle(0x1a1a2e, 1);
      bg.fillRect(0, this.groundY, w, h - this.groundY);
      bg.lineStyle(2, 0xff6600, 0.35);
      bg.lineBetween(0, this.groundY, w, this.groundY);
      for (let i = 1; i <= 4; i++) {
        bg.lineStyle(1, 0x333366, 0.4);
        bg.lineBetween(0, this.groundY + i * 15, w, this.groundY + i * 15);
      }
    }
  }

  // ── HP bars ────────────────────────────────────────────────────────────────

  private buildHpBars(w: number, playerName: string, enemyName: string): void {
    const mob  = IS_TOUCH_DEVICE;
    const d    = 20;
    const py   = mob ? 28 : 22;
    const nOff = mob ? -20 : -14;
    const nFs  = mob ? '15px' : '11px';
    const vFs  = mob ? '13px' : '10px';
    const px   = mob ? 14 : 20;

    this.add.text(px, py + nOff, playerName.toUpperCase(), { fontSize: nFs, color: '#ff9944', fontFamily: 'monospace' }).setDepth(d);
    this.add.rectangle(px, py, this.hpBarW, this.hpBarH, 0x222222).setOrigin(0, 0).setDepth(d);
    this.playerHpFill = this.add.rectangle(px, py, this.hpBarW, this.hpBarH, 0x44cc44).setOrigin(0, 0).setDepth(d + 1);
    this.playerHpText = this.add.text(px + this.hpBarW + 6, py + 1, '', { fontSize: vFs, color: '#aaaaaa', fontFamily: 'monospace' }).setDepth(d + 1);

    const ex = w - (mob ? 14 : 20) - this.hpBarW;
    this.add.text(ex, py + nOff, enemyName.toUpperCase(), { fontSize: nFs, color: '#44aaff', fontFamily: 'monospace' }).setDepth(d);
    this.add.rectangle(ex, py, this.hpBarW, this.hpBarH, 0x222222).setOrigin(0, 0).setDepth(d);
    this.enemyHpFill = this.add.rectangle(ex, py, this.hpBarW, this.hpBarH, 0x44cc44).setOrigin(0, 0).setDepth(d + 1);
    this.enemyHpText = this.add.text(ex - (mob ? 62 : 50), py + 1, '', { fontSize: vFs, color: '#aaaaaa', fontFamily: 'monospace' }).setDepth(d + 1);
  }

  private refreshHpBars(): void {
    const pr = Math.max(0, this.playerActor.hp / this.playerActor.maxHp);
    const er = Math.max(0, this.enemyActor.hp  / this.enemyActor.maxHp);
    this.playerHpFill.width = this.hpBarW * pr;
    this.enemyHpFill.width  = this.hpBarW * er;
    this.playerHpFill.setFillStyle(this.hpColor(pr));
    this.enemyHpFill.setFillStyle(this.hpColor(er));
    this.playerHpText.setText(`${Math.ceil(this.playerActor.hp)}/${this.playerActor.maxHp}`);
    this.enemyHpText.setText(`${Math.ceil(this.enemyActor.hp)}/${this.enemyActor.maxHp}`);
  }

  private hpColor(r: number): number {
    return r > 0.5 ? 0x44cc44 : r > 0.25 ? 0xddcc00 : 0xdd3322;
  }

  // ── Phase / guard labels ────────────────────────────────────────────────────

  private buildLabels(w: number): void {
    const mob = IS_TOUCH_DEVICE;
    // Phase label sits just above the HUD bar
    this.phaseLabel = this.add.text(w / 2, this.hudY - 14, '', {
      fontSize: mob ? '12px' : '11px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(15);

    this.guardLabel = this.add.text(0, 0, '🛡 GUARDING', {
      fontSize: mob ? '13px' : '11px', color: '#88ddff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25).setVisible(false);
  }

  private updateGuardLabel(): void {
    const ga = this.playerActor.isGuarding ? this.playerActor
             : this.enemyActor.isGuarding  ? this.enemyActor : null;
    if (ga) { this.guardLabel.setVisible(true).setPosition(ga.x, ga.y - 70); }
    else    { this.guardLabel.setVisible(false); }
  }

  private onPhaseChange(phase: ClassicBattlePhase): void {
    const map: Partial<Record<ClassicBattlePhase, string>> = {
      player_command:   'Choose your move...',
      approach_target:  'Approaching...',
      return_to_anchor: 'Returning...',
    };
    this.phaseLabel.setText(map[phase] ?? '');
  }

  // ── Battle HUD ─────────────────────────────────────────────────────────────

  private buildBattleHud(w: number, _h: number, playerId: string): void {
    const mob  = IS_TOUCH_DEVICE;
    const gap  = 8;
    const safeBot = mob ? SAFE_AREA_BOTTOM : 0;

    // ── Button size math ──────────────────────────────────────────────────────
    const nMain      = this.MAIN_BTNS.length;
    this.mainBtnW    = Math.floor((w - (nMain + 1) * gap) / nMain);
    this.mainBtnH    = this.hudH - 20;

    const moveset         = CLASSIC_COMMAND_SETS[playerId] ?? ['basic_attack'];
    this.menuCommandIds   = [...moveset, BACK_COMMAND];
    const nMoves          = this.menuCommandIds.length;
    const rows            = Math.ceil(nMoves / this.MOVE_COLS);
    this.moveBtnW         = Math.floor((w - (this.MOVE_COLS + 1) * gap) / this.MOVE_COLS);
    this.moveBtnH         = Math.floor((this.hudH - 10 - (rows - 1) * 6) / rows);

    this.moveBtnThemes = this.menuCommandIds.map(id => {
      if (id === BACK_COMMAND) return { fill: 0x0e0e1e, selFill: 0x1e1e38, border: 0x7788aa, accent: 0x9999cc };
      return dmgTypeTheme(CLASSIC_MOVES[id]?.damageType ?? '');
    });

    // ── HUD container ─────────────────────────────────────────────────────────
    this.hudGroup = this.add.container(0, this.hudY).setDepth(30).setVisible(false);

    // Background panel — extends into safe area at the bottom
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x07070f, 0.97);
    bgGfx.fillRect(0, 0, w, this.hudH + safeBot);
    // Neon divider line at the top
    bgGfx.lineStyle(2, 0xff6600, 0.6);
    bgGfx.lineBetween(0, 0, w, 0);
    bgGfx.lineStyle(1, 0xff9944, 0.12);
    bgGfx.lineBetween(0, 2, w, 2);
    this.hudGroup.add(bgGfx);

    // ── Main panel (Fight / Bag / Capture / Run) ──────────────────────────────
    this.mainPanel    = this.add.container(0, 0);
    this.mainBtnGfxs  = [];
    this.mainBtnTexts = [];

    this.MAIN_BTNS.forEach((cfg, i) => {
      const bx = gap + i * (this.mainBtnW + gap);
      const by = 10;
      const theme = MAIN_BTN_THEMES[cfg.key];

      const gfx = this.add.graphics();
      gfx.setPosition(bx, by);
      this.mainPanel.add(gfx);
      this.mainBtnGfxs.push(gfx);

      // Label (also serves as the interactive hit area for the full button)
      const lbl = this.add.text(
        bx + this.mainBtnW / 2,
        by + this.mainBtnH / 2,
        cfg.label,
        { fontSize: mob ? '17px' : '15px', color: '#888899', fontFamily: 'monospace', fontStyle: 'bold', align: 'center' },
      ).setOrigin(0.5);
      lbl.setInteractive(
        new Phaser.Geom.Rectangle(-this.mainBtnW / 2 - 4, -this.mainBtnH / 2 - 4, this.mainBtnW + 8, this.mainBtnH + 8),
        Phaser.Geom.Rectangle.Contains,
      );
      lbl.input!.cursor = 'pointer';
      lbl.on('pointerover',  () => { this.mainCursor = i; this.refreshMainCursor(); });
      lbl.on('pointerdown',  () => { this.mainCursor = i; this.refreshMainCursor(); this.activateMainBtn(i); });
      this.mainPanel.add(lbl);
      this.mainBtnTexts.push(lbl);

      // Colored accent dot top-left of each button
      const dot = this.add.graphics();
      dot.setPosition(bx + 10, by + 10);
      dot.fillStyle(theme.accent, 0.6);
      dot.fillCircle(0, 0, 4);
      this.mainPanel.add(dot);
    });

    this.hudGroup.add(this.mainPanel);

    // ── Moves panel ────────────────────────────────────────────────────────────
    this.movesPanel   = this.add.container(0, 0);
    this.moveBtnGfxs  = [];
    this.moveBtnTexts = [];

    this.menuCommandIds.forEach((id, i) => {
      const col  = i % this.MOVE_COLS;
      const row  = Math.floor(i / this.MOVE_COLS);
      const bx   = gap + col * (this.moveBtnW + gap);
      const by   = 5 + row * (this.moveBtnH + 6);
      const theme = this.moveBtnThemes[i];

      const gfx = this.add.graphics();
      gfx.setPosition(bx, by);
      this.movesPanel.add(gfx);
      this.moveBtnGfxs.push(gfx);

      // Accent bar (left edge colour strip)
      const accent = this.add.graphics();
      accent.setPosition(bx, by);
      accent.fillStyle(theme.accent, 0.5);
      accent.fillRoundedRect(0, 2, 4, this.moveBtnH - 4, 2);
      this.movesPanel.add(accent);

      const label = id === BACK_COMMAND
        ? '← BACK'
        : (CLASSIC_MOVES[id]?.displayName?.toUpperCase() ?? id.toUpperCase());
      const costTag = (id !== BACK_COMMAND && CLASSIC_MOVES[id]?.auraCost)
        ? `  ◆${CLASSIC_MOVES[id]!.auraCost}`
        : '';

      const lbl = this.add.text(
        bx + 14,
        by + this.moveBtnH / 2,
        label + costTag,
        { fontSize: mob ? '14px' : '13px', color: '#888899', fontFamily: 'monospace' },
      ).setOrigin(0, 0.5);
      lbl.setInteractive(
        new Phaser.Geom.Rectangle(-14, -this.moveBtnH / 2 - 4, this.moveBtnW + 4, this.moveBtnH + 8),
        Phaser.Geom.Rectangle.Contains,
      );
      lbl.input!.cursor = 'pointer';
      lbl.on('pointerover',  () => { this.menuCursor = i; this.refreshMoveCursor(); });
      lbl.on('pointerdown',  () => { this.menuCursor = i; this.refreshMoveCursor(); this.confirmMove(); });
      this.movesPanel.add(lbl);
      this.moveBtnTexts.push(lbl);
    });

    this.movesPanel.setVisible(false);
    this.hudGroup.add(this.movesPanel);

    // Initial draw
    this.refreshMainCursor();
    this.refreshMoveCursor();
  }

  // ── HUD button drawing helper ──────────────────────────────────────────────

  private drawHudBtn(
    gfx: Phaser.GameObjects.Graphics,
    w: number, h: number,
    theme: BtnTheme,
    selected: boolean,
  ): void {
    gfx.clear();
    gfx.fillStyle(selected ? theme.selFill : theme.fill, selected ? 1 : 0.85);
    gfx.fillRoundedRect(0, 0, w, h, 6);
    gfx.lineStyle(selected ? 2 : 1, theme.border, selected ? 0.85 : 0.22);
    gfx.strokeRoundedRect(0, 0, w, h, 6);
    if (selected) {
      // Inner top highlight
      gfx.lineStyle(1, 0xffffff, 0.1);
      gfx.lineBetween(8, 1, w - 8, 1);
    }
  }

  private refreshMainCursor(): void {
    this.mainBtnGfxs.forEach((gfx, i) => {
      this.drawHudBtn(gfx, this.mainBtnW, this.mainBtnH, MAIN_BTN_THEMES[this.MAIN_BTNS[i].key], i === this.mainCursor);
    });
    this.mainBtnTexts.forEach((t, i) => {
      t.setColor(i === this.mainCursor ? '#ffffff' : '#667788');
    });
  }

  private refreshMoveCursor(): void {
    this.moveBtnGfxs.forEach((gfx, i) => {
      this.drawHudBtn(gfx, this.moveBtnW, this.moveBtnH, this.moveBtnThemes[i], i === this.menuCursor);
    });
    this.moveBtnTexts.forEach((t, i) => {
      t.setColor(i === this.menuCursor ? '#ffffff' : '#667788');
    });
  }

  // ── HUD panel transitions ──────────────────────────────────────────────────

  private showMenu(): void {
    this.menuVisible = true;
    this.hudGroup.setVisible(true);
    this.showMainPanel();
  }

  private hideMenu(): void {
    this.menuVisible = false;
    this.hudGroup.setVisible(false);
  }

  private showMainPanel(): void {
    this.hudPhase    = 'main';
    this.mainCursor  = 0;
    this.mainPanel.setVisible(true);
    this.movesPanel.setVisible(false);
    this.refreshMainCursor();
  }

  private showMovesPanel(): void {
    this.hudPhase   = 'moves';
    this.menuCursor = 0;
    this.prevCursor = -1;
    this.mainPanel.setVisible(false);
    this.movesPanel.setVisible(true);
    this.refreshMoveCursor();
  }

  private activateMainBtn(index: number): void {
    const key = this.MAIN_BTNS[index].key;
    switch (key) {
      case 'fight':
        this.audio.playUi(AUDIO_KEYS.ui.confirm);
        this.showMovesPanel();
        break;
      default:
        this.audio.playUi(AUDIO_KEYS.ui.move);
        this.showPlaceholderOverlay(key.toUpperCase(), 'Coming soon!');
        break;
    }
  }

  private confirmMove(): void {
    if (!this.menuVisible) return;
    const id = this.menuCommandIds[this.menuCursor];
    if (id === BACK_COMMAND) {
      this.audio.playUi(AUDIO_KEYS.ui.move);
      this.showMainPanel();
      return;
    }
    this.audio.playUi(AUDIO_KEYS.ui.confirm);
    this.engine.submitPlayerMove(id);
  }

  // ── Placeholder overlay (Bag / Capture / Run) ──────────────────────────────

  private showPlaceholderOverlay(title: string, body: string): void {
    const { width: w, height: h } = this.scale;
    const bx = w / 2 - 180, by = h / 2 - 55;

    const panel = this.add.graphics().setDepth(80);
    panel.fillStyle(0x070714, 0.96);
    panel.fillRoundedRect(bx, by, 360, 110, 10);
    panel.lineStyle(2, 0x3a88ff, 0.5);
    panel.strokeRoundedRect(bx, by, 360, 110, 10);

    const t1 = this.add.text(w / 2, by + 28, title, {
      fontSize: '20px', color: '#ff9944', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(81);
    const t2 = this.add.text(w / 2, by + 60, body, {
      fontSize: '14px', color: '#aaaacc', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5).setDepth(81);
    const t3 = this.add.text(w / 2, by + 92, 'tap / ENTER to close', {
      fontSize: '11px', color: '#444466', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(81);

    const dismiss = (): void => {
      [panel, t1, t2, t3].forEach(o => o.destroy());
      this.input.off('pointerup', dismiss);
      this.input.keyboard!.off('keydown-ENTER', dismiss);
    };
    this.time.delayedCall(250, () => {
      this.input.once('pointerup', dismiss);
      this.input.keyboard!.once('keydown-ENTER', dismiss);
    });
  }

  // ── Damage / block display ─────────────────────────────────────────────────

  private onDamageDealt(
    target: ClassicActorRole, amount: number, blocked: boolean, wx: number, wy: number,
  ): void {
    const actor = target === 'player' ? this.playerActor : this.enemyActor;
    if (blocked) {
      this.spawnBlockedDisplay(wx, wy, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.guardBlock);
    } else {
      this.spawnDamageNumber(wx, wy, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.attackHit);
      this.audio.playSfx(AUDIO_KEYS.sfx.hurtImpact, 0.6);
      this.audio.playCreatureHurt(actor.actorId);
    }
  }

  private spawnDamageNumber(wx: number, wy: number, amount: number): void {
    const mob = IS_TOUCH_DEVICE;
    const txt = this.add.text(wx, wy, `-${amount}`, {
      fontSize: mob ? '30px' : '22px', color: '#ffdd44',
      fontStyle: 'bold', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: txt, y: wy - 60, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => txt.destroy() });
  }

  private spawnBlockedDisplay(wx: number, wy: number, amount: number): void {
    const mob = IS_TOUCH_DEVICE;
    const h1 = this.add.text(wx, wy - 10, 'BLOCKED!', {
      fontSize: mob ? '20px' : '16px', color: '#88ddff',
      fontStyle: 'bold', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    const h2 = this.add.text(wx, wy + 14, `-${amount}`, {
      fontSize: mob ? '16px' : '13px', color: '#aaccee',
      fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);
    for (const o of [h1, h2]) {
      this.tweens.add({ targets: o, y: o.y - 50, alpha: 0, duration: 1100, ease: 'Cubic.Out', onComplete: () => o.destroy() });
    }
  }

  // ── Battle end ─────────────────────────────────────────────────────────────

  private onBattleEnd(winner: ClassicActorRole): void {
    const { width: w, height: h } = this.scale;
    const mob   = IS_TOUCH_DEVICE;
    const isWin = winner === 'player';
    const colour = isWin ? '#ffcc44' : '#ff4444';

    this.audio.stopBgm();
    this.audio.playSfx(isWin ? AUDIO_KEYS.sfx.victory : AUDIO_KEYS.sfx.defeat, 1.0);

    const panel = this.add.graphics().setDepth(60);
    panel.fillStyle(0x000000, 0.65);
    panel.fillRect(0, 0, w, h);

    this.add.text(w / 2, h / 2 - 50, isWin ? 'VICTORY!' : 'DEFEAT', {
      fontSize: mob ? '72px' : '56px', color: colour,
      fontStyle: 'bold', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(61);

    this.add.text(w / 2, h / 2 + 20, isWin ? 'Your Monari triumphed!' : 'Your Monari was defeated.', {
      fontSize: mob ? '22px' : '18px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(61);

    const rt = this.add.text(w / 2, h / 2 + 70, 'Tap or press ENTER to return', {
      fontSize: mob ? '16px' : '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(61);
    this.tweens.add({ targets: rt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const ctx = this.registry.get('classic_battle_context') as ClassicBattleContext | null;

    this.time.delayedCall(600, () => {
      const goBack = (): void => {
        this.input.off('pointerup', goBack);
        if (ctx?.returnMap) {
          this.registry.set('classic_current_map', ctx.returnMap);
          this.registry.set('classic_spawn_name',  ctx.returnSpawn ?? 'default');
          this.registry.remove('classic_battle_context');
          this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
            if (p === 1) this.scene.start('ClassicOverworldScene');
          });
        } else {
          this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
            if (p === 1) this.scene.start('ModeSelectScene');
          });
        }
      };
      this.input.keyboard!.once('keydown-ENTER', goBack);
      this.input.once('pointerup', goBack);
    });
  }
}
