import Phaser from 'phaser';
import { ClassicActor } from '../entities/ClassicActor';
import { ClassicBattleEngine } from '../systems/ClassicBattleEngine';
import { SoulSyncSystem } from '../systems/SoulSyncSystem';
import { AudioManager } from '../systems/AudioManager';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS, BACK_COMMAND } from '../data/classicMoveData';
import { MINARI_ROSTER } from '../data/minariData';
import { PLAYER_PROFILE } from '../data/playerProfile';
import { CLASSIC_BATTLE_CONFIG } from '../config/classicBattleConfig';
import { UI_THEME, elementColor } from '../config/uiTheme';
import {
  BATTLE_UI_BUTTONS, BATTLE_UI_FRAMES, battleUiButtonKey, battleUiFrameKey, elementIconKey, genderIconKey, getElementIconPath, getGenderIconPath,
  getMonariVisualPaths, getCharacterVisualPaths, visualCandidates,
} from '../config/assetManifest';
import { preloadVisualCandidates, bestLoadedVisualKey, drawGlassPanel, ensurePlaceholderTexture } from '../ui/phaserUi';
import { AUDIO_KEYS } from '../config/audioConfig';
import { IS_TOUCH_DEVICE, SAFE_AREA_BOTTOM } from '../config/mobileConfig';
import type { ClassicBattlePhase, ClassicActorRole } from '../types/classic';
import type { ClassicBattleContext } from '../types/overworld';
import type { BattleHUDData, PlayerProfile, SoulSyncTier, SoulRankTier } from '../types/progression';

// ── HUD button colour schemes ────────────────────────────────────────────────

interface BtnTheme { fill: number; selFill: number; border: number; accent: number }

const MAIN_BTN_THEMES: Record<string, BtnTheme> = {
  fight:   { fill: 0x2a0800, selFill: 0x6a1800, border: 0xff6622, accent: 0xff4400 },
  bag:     { fill: 0x061426, selFill: 0x0f2e5a, border: 0x3a88ff, accent: 0x2266dd },
  capture: { fill: 0x062010, selFill: 0x0f4422, border: 0x33cc77, accent: 0x228855 },
  run:     { fill: 0x14141e, selFill: 0x262636, border: 0x7788aa, accent: 0x556688 },
};

function elementLabelForMove(type?: string): string {
  switch (type) {
    case 'ember': return 'Ember';
    case 'water': return 'Aqua';
    case 'physical': return 'Physical';
    case 'none': return 'Guard';
    default: return 'Neutral';
  }
}

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
  private bottomBarW!: number;
  private hpBarH!:     number;
  private auraBarH!:   number;
  private hudY!:       number;
  private hudH!:       number;

  // HP widgets
  private playerHpFill!:   Phaser.GameObjects.Rectangle;
  private enemyHpFill!:    Phaser.GameObjects.Rectangle;
  private playerHpText!:   Phaser.GameObjects.Text;
  private enemyHpText!:    Phaser.GameObjects.Text;
  private playerAuraText!: Phaser.GameObjects.Text;
  private enemyAuraText!:  Phaser.GameObjects.Text;
  private playerSyncText!: Phaser.GameObjects.Text;
  private enemySyncText!:  Phaser.GameObjects.Text;
  private turnBadgeText!:  Phaser.GameObjects.Text;
  private turnNumber = 1;

  // Aura widgets
  private playerAuraFill!: Phaser.GameObjects.Rectangle;
  private enemyAuraFill!:  Phaser.GameObjects.Rectangle;

  // ── New battle HUD ─────────────────────────────────────────────────────────
  private hudGroup!:    Phaser.GameObjects.Container;
  private mainPanel!:   Phaser.GameObjects.Container;
  private movesPanel!:  Phaser.GameObjects.Container;
  private hudPhase:     'main' | 'moves' = 'main';
  private menuVisible   = false;

  // Main-panel state
  private mainCursor      = 0;
  private mainBtnGfxs:    Phaser.GameObjects.Graphics[] = [];
  private mainBtnImages:  Phaser.GameObjects.Image[]    = [];
  private mainBtnTexts:   Phaser.GameObjects.Text[]     = [];
  private mainBtnW        = 0;
  private mainBtnH        = 0;
  private readonly MAIN_BTNS = [
    { key: 'fight',   label: 'FIGHT',   icon: '⚔' },
    { key: 'bag',     label: 'BAG',     icon: '🎒' },
    { key: 'capture', label: 'BOND', icon: '◎'  },
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

  // Soul Sync systems (one per active Monari)
  private playerSyncSys!: SoulSyncSystem;
  private enemySyncSys!:  SoulSyncSystem;

  // Sync bar widgets
  private playerSyncFill!: Phaser.GameObjects.Rectangle;
  private enemySyncFill!:  Phaser.GameObjects.Rectangle;
  private soulbondFill!:   Phaser.GameObjects.Rectangle;
  private bottomSyncFill!: Phaser.GameObjects.Rectangle;
  private soulbondText!:   Phaser.GameObjects.Text;
  private bottomSyncText!: Phaser.GameObjects.Text;
  private syncBarH!:       number;

  // Misc UI
  private phaseLabel!:       Phaser.GameObjects.Text;
  private playerGuardLabel!: Phaser.GameObjects.Text;
  private enemyGuardLabel!:  Phaser.GameObjects.Text;

  // Input
  private upKey!:    Phaser.Input.Keyboard.Key;
  private downKey!:  Phaser.Input.Keyboard.Key;
  private leftKey!:  Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!:   Phaser.Input.Keyboard.Key;

  // Battle context (read once in create, used in capture)
  private battleCtx: ClassicBattleContext | null = null;

  constructor() { super({ key: 'ClassicSoulDuelScene' }); }

  // ── Preload ────────────────────────────────────────────────────────────────

  preload(): void {
    const { background } = CLASSIC_BATTLE_CONFIG;
    this.load.image(`bg_${background}`, `assets/backgrounds/classic/${background}.png`);
    ['flarepaw', 'droplet', 'sproutodon', 'umbravine', 'umbrelette', 'uvee'].forEach(id => {
      preloadVisualCandidates(this, 'monari', id, visualCandidates(getMonariVisualPaths(id)));
    });
    ['player', 'renzo', 'warren_ellis'].forEach(id => {
      preloadVisualCandidates(this, 'character', id, visualCandidates(getCharacterVisualPaths(id)));
    });
    (Object.keys(BATTLE_UI_FRAMES) as Array<keyof typeof BATTLE_UI_FRAMES>).forEach(key => {
      this.load.image(battleUiFrameKey(key), BATTLE_UI_FRAMES[key]);
    });
    (Object.keys(BATTLE_UI_BUTTONS) as Array<keyof typeof BATTLE_UI_BUTTONS>).forEach(key => {
      this.load.image(battleUiButtonKey(key), BATTLE_UI_BUTTONS[key]);
    });
    ['fire', 'water', 'flora', 'wind', 'thunder', 'stone', 'steel', 'light', 'dark', 'aether', 'ice', 'neutral'].forEach(icon => {
      this.load.image(elementIconKey(icon), getElementIconPath(icon));
    });
    ['male', 'female', 'unknown'].forEach(gender => {
      this.load.image(genderIconKey(gender), getGenderIconPath(gender));
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    const { width: w, height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;

    this.battleCtx = this.registry.get('classic_battle_context') as ClassicBattleContext | null;
    const profile  = this.registry.get('player_profile') as PlayerProfile | null;

    // ── Layout ────────────────────────────────────────────────────────────────
    this.groundY  = Math.round(h * (mob ? 0.60 : 0.70));
    this.pAnchorX = Math.round(w * 0.20);
    this.eAnchorX = Math.round(w * 0.80);
    this.hpBarW   = mob ? Math.round(w * 0.28) : 200;
    this.hpBarH   = mob ? 18 : 14;
    this.auraBarH = mob ? 8  : 6;
    this.syncBarH = mob ? 6  : 5;
    this.hudH     = mob ? 140 : 148;
    this.hudY     = h - this.hudH - (mob ? SAFE_AREA_BOTTOM : 0);

    this.drawBackground(w, h);

    // ── Combatants ────────────────────────────────────────────────────────────
    const playerMinId  = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId   = this.battleCtx?.enemyMinariId  ?? 'droplet';
    const playerData   = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData    = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];

    const playerBond   = profile?.bonds[playerMinId];
    const playerBondLv = playerBond?.bondLevel ?? 1;

    // Soul Sync — enemy always starts at bond level 1 (wild / rival default)
    this.playerSyncSys = new SoulSyncSystem(playerMinId, playerBondLv);
    this.enemySyncSys  = new SoulSyncSystem(enemyMinId,  1);

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
      const frame  = this.textures.getFrame(bgKey);
      const scale  = Math.max(w / frame.realWidth, h / frame.realHeight);
      this.add.image(w / 2, h / 2, bgKey).setDepth(0).setScale(scale);

      const topScrim = this.add.graphics().setDepth(1);
      topScrim.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.52, 0.52, 0, 0);
      topScrim.fillRect(0, 0, w, 90);

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

  // ── HP + Aura bars ─────────────────────────────────────────────────────────

  private textureOrPlaceholder(key: string, color: number = UI_THEME.colors.purple): string {
    return this.textures.exists(key) ? key : ensurePlaceholderTexture(this, key, color);
  }

  private addUiFrameImage(key: string, x: number, y: number, w: number, h: number, depth: number, fallbackStroke: number): void {
    if (this.textures.exists(key)) {
      this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h).setDepth(depth);
      return;
    }
    const g = this.add.graphics().setDepth(depth);
    drawGlassPanel(g, x, y, w, h, { radius: 12, fill: UI_THEME.colors.panelDeep, stroke: fallbackStroke, glow: fallbackStroke, alpha: 0.86 });
  }

  private buildHpBars(w: number, playerName: string, enemyName: string): void {
    const mob  = IS_TOUCH_DEVICE;
    const d    = 20;
    const cardW = mob ? Math.round(w * 0.38) : Math.min(330, Math.round(w * 0.21));
    const cardH = mob ? 72 : 76;
    this.hpBarW   = cardW - 114;
    this.hpBarH   = mob ? 9 : 8;
    this.auraBarH = mob ? 7 : 6;
    this.syncBarH = 5;

    const profile = this.registry.get('player_profile') as PlayerProfile | null;
    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId = this.battleCtx?.enemyMinariId ?? 'droplet';
    const playerData = MINARI_ROSTER[playerMinId] ?? MINARI_ROSTER['flarepaw'];
    const enemyData = MINARI_ROSTER[enemyMinId] ?? MINARI_ROSTER['droplet'];
    const playerLevel = profile?.monariLevels[playerMinId]?.level ?? 7;
    const enemyLevel = profile?.monariLevels[enemyMinId]?.level ?? 7;
    const bondLv = profile?.bonds[playerMinId]?.bondLevel ?? 1;

    const drawCard = (x: number, y: number, side: 'player' | 'enemy', name: string, id: string, level: number, bond: number) => {
      const data = MINARI_ROSTER[id];
      const frameKey = battleUiFrameKey(side === 'player' ? 'panelMonariLeft' : 'panelMonariRight');
      this.addUiFrameImage(frameKey, x, y, cardW, cardH, d + 3, side === 'player' ? 0x8c5cff : 0x27a8ff);

      const left = side === 'player';
      const contentX = left ? x + 26 : x + 18;
      const nameX = left ? x + 56 : x + cardW - 56;
      const barX = left ? x + 62 : x + cardW - 62 - this.hpBarW;
      const iconX = left ? x + 28 : x + cardW - 28;
      const genderX = left ? x + cardW - 22 : x + 22;
      const levelX = left ? x + cardW - 55 : x + 55;
      const elementKey = this.textureOrPlaceholder(elementIconKey(data?.element), elementColor(data?.element));
      this.add.image(iconX, y + 22, elementKey).setDisplaySize(18, 18).setDepth(d + 5);
      const genderKey = this.textureOrPlaceholder(genderIconKey(data?.gender), 0x54c8ff);
      this.add.image(genderX, y + 22, genderKey).setDisplaySize(14, 14).setDepth(d + 5);

      this.add.text(nameX, y + 13, name.toUpperCase(), {
        fontSize: mob ? '12px' : '14px', color: '#f6f0ff', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold',
      }).setOrigin(left ? 0 : 1, 0).setDepth(d + 5);
      this.add.text(levelX, y + 16, `Lv. ${level}`, {
        fontSize: mob ? '9px' : '10px', color: '#ffd76a', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold',
      }).setOrigin(left ? 1 : 0, 0).setDepth(d + 5);

      const by = y + 36;
      const labelX = left ? contentX : x + cardW - contentX;
      const labelOrigin = left ? 0 : 1;
      ['HP', 'AURA', 'SOUL SYNC'].forEach((label, i) => this.add.text(labelX, by + i * 14 - 2, label, {
        fontSize: '8px', color: i === 0 ? '#7cff64' : i === 1 ? '#d06aff' : '#ffd76a', fontFamily: UI_THEME.fonts.secondary, fontStyle: 'bold',
      }).setOrigin(labelOrigin, 0).setDepth(d + 5));

      const track = (yy: number, hh: number) => {
        this.add.rectangle(barX, yy, this.hpBarW, hh, 0x050614, 0.88).setOrigin(0, 0).setDepth(d + 1);
        this.add.rectangle(barX, yy, this.hpBarW, hh, 0x0e1026, 0.8).setOrigin(0, 0).setDepth(d + 1);
      };
      track(by, this.hpBarH); track(by + 14, this.auraBarH); track(by + 28, this.syncBarH);

      const badgeW = 60;
      const badgeX = left ? x + cardW - badgeW - 18 : x + 18;
      const badge = this.add.graphics().setDepth(d + 4);
      badge.fillStyle(UI_THEME.colors.gold, 0.13).fillRoundedRect(badgeX, y + cardH - 17, badgeW, 12, 6);
      badge.lineStyle(1, UI_THEME.colors.gold, 0.42).strokeRoundedRect(badgeX, y + cardH - 17, badgeW, 12, 6);
      this.add.text(badgeX + badgeW / 2, y + cardH - 11, `Bond Lv. ${bond}`, {
        fontSize: '8px', color: '#fff0b8', fontFamily: UI_THEME.fonts.secondary, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(d + 5);
      return { bx: barX, by };
    };

    const topY = mob ? 14 : 18;
    const p = drawCard(24, topY, 'player', playerName, playerMinId, playerLevel, bondLv);
    const e = drawCard(w - cardW - 24, topY, 'enemy', enemyName, enemyMinId, enemyLevel, 1);

    this.playerHpFill = this.add.rectangle(p.bx, p.by, this.hpBarW, this.hpBarH, UI_THEME.bars.hp).setOrigin(0, 0).setDepth(d + 2);
    this.playerAuraFill = this.add.rectangle(p.bx, p.by + 14, this.hpBarW, this.auraBarH, 0xd06aff).setOrigin(0, 0).setDepth(d + 2);
    this.playerSyncFill = this.add.rectangle(p.bx, p.by + 28, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 2);
    this.playerHpText = this.add.text(p.bx + this.hpBarW + 5, p.by - 2, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(0, 0).setDepth(d + 5);
    this.playerAuraText = this.add.text(p.bx + this.hpBarW + 5, p.by + 12, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(0, 0).setDepth(d + 5);
    this.playerSyncText = this.add.text(p.bx + this.hpBarW + 5, p.by + 26, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(0, 0).setDepth(d + 5);

    this.enemyHpFill = this.add.rectangle(e.bx, e.by, this.hpBarW, this.hpBarH, UI_THEME.bars.hp).setOrigin(0, 0).setDepth(d + 2);
    this.enemyAuraFill = this.add.rectangle(e.bx, e.by + 14, this.hpBarW, this.auraBarH, 0xd06aff).setOrigin(0, 0).setDepth(d + 2);
    this.enemySyncFill = this.add.rectangle(e.bx, e.by + 28, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 2);
    this.enemyHpText = this.add.text(e.bx - 5, e.by - 2, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(1, 0).setDepth(d + 5);
    this.enemyAuraText = this.add.text(e.bx - 5, e.by + 12, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(1, 0).setDepth(d + 5);
    this.enemySyncText = this.add.text(e.bx - 5, e.by + 26, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.secondary,
    }).setOrigin(1, 0).setDepth(d + 5);

    const turnW = mob ? 70 : 76;
    const turnH = mob ? 78 : 86;
    const turnX = w / 2 - turnW / 2;
    this.addUiFrameImage(battleUiFrameKey('turnBadge'), turnX, 0, turnW, turnH, d + 3, UI_THEME.colors.purple);
    this.add.text(w / 2, mob ? 18 : 22, 'TURN', {
      fontSize: mob ? '10px' : '11px', color: '#c65cff', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(d + 5);
    this.turnBadgeText = this.add.text(w / 2, mob ? 41 : 48, '01', {
      fontSize: mob ? '25px' : '30px', color: '#f6f0ff', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold',
      stroke: '#8c5cff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d + 5);

    const playerKey = bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold);
    const hud = this.add.graphics().setDepth(d);
    drawGlassPanel(hud, 18, this.hudY - (mob ? 62 : 58), 210, 46, { radius: 8, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.purple, glow: UI_THEME.colors.purple, alpha: 0.72 });
    this.add.image(43, this.hudY - (mob ? 39 : 35), playerKey).setDisplaySize(34, 34).setDepth(d + 2);
    this.add.text(70, this.hudY - (mob ? 53 : 49), PLAYER_PROFILE.displayName.toUpperCase(), { fontSize: '12px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold' }).setDepth(d + 2);
    this.add.text(70, this.hudY - (mob ? 34 : 30), `✦ SOUL RANK ${profile?.soulRank.level ?? 1}`, { fontSize: '10px', color: '#d9c7ff', fontFamily: UI_THEME.fonts.secondary }).setDepth(d + 2);
  }

  private refreshHpBars(): void {
    const pr = Math.max(0, this.playerActor.hp / this.playerActor.maxHp);
    const er = Math.max(0, this.enemyActor.hp  / this.enemyActor.maxHp);
    this.playerHpFill.width = this.hpBarW * pr;
    this.enemyHpFill.width  = this.hpBarW * er;
    this.playerHpFill.setFillStyle(this.hpColor(pr));
    this.enemyHpFill.setFillStyle(this.hpColor(er));
    this.playerHpText.setText(`${Math.ceil(this.playerActor.hp)} / ${this.playerActor.maxHp}`);
    this.enemyHpText.setText(`${Math.ceil(this.enemyActor.hp)} / ${this.enemyActor.maxHp}`);

    // Aura bars
    const par = Math.max(0, this.playerActor.aura / this.playerActor.maxAura);
    const ear = Math.max(0, this.enemyActor.aura  / this.enemyActor.maxAura);
    this.playerAuraFill.width = this.hpBarW * par;
    this.enemyAuraFill.width  = this.hpBarW * ear;
    this.playerAuraText.setText(`${Math.ceil(this.playerActor.aura)} / ${this.playerActor.maxAura}`);
    this.enemyAuraText.setText(`${Math.ceil(this.enemyActor.aura)} / ${this.enemyActor.maxAura}`);

    // Sync bars
    const playerSyncValue = this.playerSyncSys.getSyncValue();
    const enemySyncValue = this.enemySyncSys.getSyncValue();
    this.playerSyncFill.width = this.hpBarW * (playerSyncValue / 100);
    this.enemySyncFill.width  = this.hpBarW * (enemySyncValue  / 100);
    this.playerSyncFill.setFillStyle(this.syncColor(this.playerSyncSys.getTier()));
    this.enemySyncFill.setFillStyle(this.syncColor(this.enemySyncSys.getTier()));
    this.playerSyncText.setText(`${Math.round(playerSyncValue)} / 100`);
    this.enemySyncText.setText(`${Math.round(enemySyncValue)} / 100`);

    if (this.bottomSyncFill && this.soulbondFill) {
      const profile = this.registry.get('player_profile') as PlayerProfile | null;
      const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
      const bond = profile?.bonds[playerMinId];
      const bondValue = bond ? Phaser.Math.Clamp(bond.bondXP, 0, bond.bondXPToNext) : 0;
      const bondMax = bond?.bondXPToNext ?? 100;
      this.soulbondFill.width = this.bottomBarW * Phaser.Math.Clamp(bondValue / bondMax, 0, 1);
      this.bottomSyncFill.width = this.bottomBarW * Phaser.Math.Clamp(playerSyncValue / 100, 0, 1);
      this.soulbondText.setText(`${Math.round(bondValue)} / ${bondMax}`);
      this.bottomSyncText.setText(`${Math.round(playerSyncValue)} / 100`);
    }
  }

  private syncColor(tier: SoulSyncTier): number {
    switch (tier) {
      case 'locked_in': return UI_THEME.bars.soulSync;
      case 'stable':    return UI_THEME.bars.soulSyncDeep;
      case 'shaken':    return 0xffc64a;
      case 'broken':    return 0x8f6a2a;
    }
  }

  private hpColor(r: number): number {
    return r > 0.5 ? UI_THEME.bars.hp : r > 0.25 ? UI_THEME.bars.hpWarn : UI_THEME.bars.hpDanger;
  }

  // ── Phase / guard labels ────────────────────────────────────────────────────

  private buildLabels(w: number): void {
    const mob = IS_TOUCH_DEVICE;
    this.phaseLabel = this.add.text(w / 2, this.hudY - 14, '', {
      fontSize: mob ? '12px' : '11px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(15);

    // Two separate guard labels — one per actor — so enemy guard is always clear.
    const guardStyle = {
      fontSize: mob ? '13px' : '11px', color: '#88ddff', fontFamily: 'monospace',
      backgroundColor: '#001e2ecc', padding: { x: 6, y: 3 },
      stroke: '#000000', strokeThickness: 2,
    };
    this.playerGuardLabel = this.add.text(this.pAnchorX, 0, '[ GUARD ]', guardStyle)
      .setOrigin(0.5).setDepth(25).setVisible(false);
    this.enemyGuardLabel  = this.add.text(this.eAnchorX, 0, '[ GUARD ]', guardStyle)
      .setOrigin(0.5).setDepth(25).setVisible(false);
  }

  private updateGuardLabel(): void {
    if (this.playerActor.isGuarding) {
      this.playerGuardLabel.setVisible(true).setY(this.playerActor.y - 80);
    } else {
      this.playerGuardLabel.setVisible(false);
    }
    if (this.enemyActor.isGuarding) {
      this.enemyGuardLabel.setVisible(true).setY(this.enemyActor.y - 80);
    } else {
      this.enemyGuardLabel.setVisible(false);
    }
  }

  private onPhaseChange(phase: ClassicBattlePhase): void {
    if (phase === 'player_command' && this.turnBadgeText) {
      this.turnBadgeText.setText(String(this.turnNumber).padStart(2, '0'));
      this.turnNumber += 1;
    }
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
    const gap  = mob ? 10 : 18;
    const safeBot = mob ? SAFE_AREA_BOTTOM : 0;

    const nMain      = this.MAIN_BTNS.length;
    this.mainBtnW    = Math.floor((w - (nMain + 1) * gap) / nMain);
    this.mainBtnH    = mob ? 54 : 62;

    const moveset         = CLASSIC_COMMAND_SETS[playerId] ?? ['basic_attack'];
    this.menuCommandIds   = [...moveset, BACK_COMMAND];
    const nMoves          = this.menuCommandIds.length;
    const rows            = Math.ceil(nMoves / this.MOVE_COLS);
    this.moveBtnW         = Math.floor((w - (this.MOVE_COLS + 1) * gap) / this.MOVE_COLS);
    this.moveBtnH         = Math.floor((this.mainBtnH + 4 - (rows - 1) * 6) / rows);

    this.moveBtnThemes = this.menuCommandIds.map(id => {
      if (id === BACK_COMMAND) return { fill: 0x0e0e1e, selFill: 0x1e1e38, border: 0x7788aa, accent: 0x9999cc };
      return dmgTypeTheme(CLASSIC_MOVES[id]?.damageType ?? '');
    });

    // ── HUD container ─────────────────────────────────────────────────────────
    this.hudGroup = this.add.container(0, this.hudY).setDepth(30).setVisible(false);

    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x07070f, 0.97);
    bgGfx.fillRect(0, 0, w, this.hudH + safeBot);
    bgGfx.lineStyle(2, 0xff6600, 0.6);
    bgGfx.lineBetween(0, 0, w, 0);
    bgGfx.lineStyle(1, 0xff9944, 0.12);
    bgGfx.lineBetween(0, 2, w, 2);
    this.hudGroup.add(bgGfx);

    const bottomY = this.mainBtnH + 18;
    this.bottomBarW = Math.min(390, Math.floor((w - 160) / 2));
    const barH = mob ? 34 : 38;
    const leftBarX = mob ? 14 : 28;
    const rightBarX = w - leftBarX - this.bottomBarW - 86;
    const leftFrame = this.add.container(leftBarX, bottomY);
    const rightFrame = this.add.container(rightBarX, bottomY);
    this.hudGroup.add(leftFrame);
    this.hudGroup.add(rightFrame);

    const addBottomFrame = (parent: Phaser.GameObjects.Container, frameKey: string, label: string, fillColor: number, textSide: 'left' | 'right') => {
      const g = this.add.graphics();
      parent.add(g);
      if (this.textures.exists(frameKey)) {
        parent.add(this.add.image(0, 0, frameKey).setOrigin(0, 0).setDisplaySize(this.bottomBarW + 86, barH));
      } else {
        drawGlassPanel(g, 0, 0, this.bottomBarW + 86, barH, { radius: 8, fill: UI_THEME.colors.panelDeep, stroke: fillColor, glow: fillColor, alpha: 0.78 });
      }
      parent.add(this.add.text(54, 7, label, { fontSize: '12px', color: fillColor === UI_THEME.colors.purple ? '#d85cff' : '#26c9ff', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold' }));
      parent.add(this.add.rectangle(54, 24, this.bottomBarW, 8, 0x050614, 0.9).setOrigin(0, 0));
      const fill = this.add.rectangle(54, 24, this.bottomBarW * 0.5, 8, fillColor, 0.95).setOrigin(0, 0);
      parent.add(fill);
      const txt = this.add.text(textSide === 'left' ? 54 + this.bottomBarW + 12 : 54 + this.bottomBarW + 12, 17, '0 / 100', { fontSize: '13px', color: '#d8d3ef', fontFamily: UI_THEME.fonts.secondary });
      parent.add(txt);
      return { fill, txt };
    };

    const soulbond = addBottomFrame(leftFrame, battleUiFrameKey('soulbondBar'), 'SOULBOND', UI_THEME.colors.purple, 'left');
    this.soulbondFill = soulbond.fill;
    this.soulbondText = soulbond.txt;
    const soulsync = addBottomFrame(rightFrame, battleUiFrameKey('soulsyncBar'), 'SOUL SYNC', 0x26c9ff, 'right');
    this.bottomSyncFill = soulsync.fill;
    this.bottomSyncText = soulsync.txt;

    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId = this.battleCtx?.enemyMinariId ?? 'droplet';
    const pPortrait = bestLoadedVisualKey(this, 'monari', playerMinId, elementColor(MINARI_ROSTER[playerMinId]?.element));
    const ePortrait = bestLoadedVisualKey(this, 'monari', enemyMinId, elementColor(MINARI_ROSTER[enemyMinId]?.element));
    this.hudGroup.add(this.add.image(w / 2 - 34, bottomY + barH / 2, pPortrait).setDisplaySize(42, 42));
    this.hudGroup.add(this.add.text(w / 2, bottomY + barH / 2, '∞', { fontSize: '34px', color: '#dbd8ff', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold' }).setOrigin(0.5));
    this.hudGroup.add(this.add.image(w / 2 + 34, bottomY + barH / 2, ePortrait).setDisplaySize(42, 42));

    // ── Main panel ────────────────────────────────────────────────────────────
    this.mainPanel    = this.add.container(0, 0);
    this.mainBtnGfxs  = [];
    this.mainBtnImages = [];
    this.mainBtnTexts = [];

    this.MAIN_BTNS.forEach((cfg, i) => {
      const bx = gap + i * (this.mainBtnW + gap);
      const by = 10;
      const theme = MAIN_BTN_THEMES[cfg.key];

      const gfx = this.add.graphics();
      gfx.setPosition(bx, by);
      this.mainPanel.add(gfx);
      this.mainBtnGfxs.push(gfx);

      const imgKey = battleUiButtonKey(cfg.key === 'capture' ? 'bond' : cfg.key);
      const img = this.add.image(bx + this.mainBtnW / 2, by + this.mainBtnH / 2, this.textureOrPlaceholder(imgKey, theme.border))
        .setDisplaySize(this.mainBtnW, this.mainBtnH)
        .setAlpha(this.textures.exists(imgKey) ? 0.98 : 0);
      this.mainPanel.add(img);
      this.mainBtnImages.push(img);

      const lbl = this.add.text(
        bx + this.mainBtnW / 2 + 22, by + this.mainBtnH / 2,
        cfg.label,
        { fontSize: mob ? '20px' : '24px', color: '#f2eefc', fontFamily: UI_THEME.fonts.primary, fontStyle: 'bold', align: 'center' },
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

      const dot = this.add.graphics();
      dot.setPosition(bx + 10, by + 10);
      dot.fillStyle(theme.accent, 0.6);
      dot.fillCircle(0, 0, 4);
      this.mainPanel.add(dot);
    });

    this.hudGroup.add(this.mainPanel);

    // ── Moves panel ───────────────────────────────────────────────────────────
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

      const accent = this.add.graphics();
      accent.setPosition(bx, by);
      accent.fillStyle(theme.accent, 0.5);
      accent.fillRoundedRect(0, 2, 4, this.moveBtnH - 4, 2);
      this.movesPanel.add(accent);

      const label = id === BACK_COMMAND
        ? '← BACK'
        : (CLASSIC_MOVES[id]?.displayName?.toUpperCase() ?? id.toUpperCase());
      const move = id !== BACK_COMMAND ? CLASSIC_MOVES[id] : undefined;
      const costTag = move ? `  • Aura ${move.auraCost ?? 0} • ${elementLabelForMove(move.damageType)}` : '';

      const lbl = this.add.text(
        bx + 14, by + this.moveBtnH / 2,
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

    this.refreshMainCursor();
    this.refreshMoveCursor();
  }

  // ── HUD button drawing ─────────────────────────────────────────────────────

  private drawHudBtn(
    gfx: Phaser.GameObjects.Graphics,
    w: number, h: number,
    theme: BtnTheme,
    selected: boolean,
    dimmed = false,
  ): void {
    gfx.clear();
    gfx.fillStyle(selected ? theme.accent : theme.fill, selected && !dimmed ? 0.20 : 0.08);
    gfx.fillRoundedRect(-3, -3, w + 6, h + 6, UI_THEME.buttons.radius + 3);
    gfx.fillStyle(selected ? theme.selFill : theme.fill, dimmed ? UI_THEME.buttons.disabledAlpha : selected ? UI_THEME.buttons.selectedAlpha : UI_THEME.buttons.alpha);
    gfx.fillRoundedRect(0, 0, w, h, UI_THEME.buttons.radius);
    gfx.lineStyle(selected ? 2 : 1, theme.border, dimmed ? 0.18 : selected ? 0.9 : 0.38);
    gfx.strokeRoundedRect(0, 0, w, h, UI_THEME.buttons.radius);
    if (selected && !dimmed) {
      gfx.lineStyle(1, 0xffffff, 0.16);
      gfx.lineBetween(12, 2, w - 12, 2);
    }
  }

  private refreshMainCursor(): void {
    this.mainBtnGfxs.forEach((gfx, i) => {
      this.drawHudBtn(gfx, this.mainBtnW, this.mainBtnH, MAIN_BTN_THEMES[this.MAIN_BTNS[i].key], i === this.mainCursor);
    });
    this.mainBtnImages.forEach((img, i) => {
      const locked = this.MAIN_BTNS[i].key === 'capture' && (!this.battleCtx?.bondable || this.battleCtx?.battleType !== 'wild');
      img.setAlpha(locked ? 0.42 : i === this.mainCursor ? 1 : 0.88);
      img.setTint(locked ? 0x777799 : 0xffffff);
    });
    this.mainBtnTexts.forEach((t, i) => {
      const locked = this.MAIN_BTNS[i].key === 'capture' && (!this.battleCtx?.bondable || this.battleCtx?.battleType !== 'wild');
      t.setColor(locked ? '#6f6a90' : i === this.mainCursor ? '#ffffff' : '#d7d2ea');
    });
  }

  private refreshMoveCursor(): void {
    this.moveBtnGfxs.forEach((gfx, i) => {
      const id = this.menuCommandIds[i];
      const cost = (id !== BACK_COMMAND) ? (CLASSIC_MOVES[id]?.auraCost ?? 0) : 0;
      const dimmed = (cost > 0 && this.playerActor.aura < cost);
      this.drawHudBtn(gfx, this.moveBtnW, this.moveBtnH, this.moveBtnThemes[i], i === this.menuCursor, dimmed);
    });
    this.moveBtnTexts.forEach((t, i) => {
      const id = this.menuCommandIds[i];
      const cost = (id !== BACK_COMMAND) ? (CLASSIC_MOVES[id]?.auraCost ?? 0) : 0;
      const dimmed = cost > 0 && this.playerActor.aura < cost;
      t.setColor(dimmed ? '#444455' : i === this.menuCursor ? '#ffffff' : '#667788');
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
      case 'capture':
        this.audio.playUi(AUDIO_KEYS.ui.confirm);
        this.handleCaptureAttempt();
        break;
      case 'run':
        this.audio.playUi(AUDIO_KEYS.ui.confirm);
        this.handleRun();
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

  // ── Capture ────────────────────────────────────────────────────────────────

  private handleCaptureAttempt(): void {
    if (!this.battleCtx?.bondable || this.battleCtx?.battleType !== 'wild') {
      this.showInfoOverlay('CAPTURE', "Can't capture a rival's Monari!");
      return;
    }
    const hpRatio    = this.enemyActor.hp / this.enemyActor.maxHp;
    const catchChance = Math.max(0.05, 0.85 - 0.7 * hpRatio);

    if (Math.random() < catchChance) {
      this.captureSuccess();
    } else {
      this.captureFail();
    }
  }

  private captureSuccess(): void {
    const minariId   = this.battleCtx?.enemyMinariId ?? 'droplet';
    const minariName = MINARI_ROSTER[minariId]?.name ?? minariId;

    const party = (this.registry.get('classic_party') as string[] | null) ?? [];
    if (!party.includes(minariId)) {
      party.push(minariId);
      this.registry.set('classic_party', party);
    }

    this.showCaptureResult(true, minariName, () => {
      this.hideMenu();
      this.engine.forfeit();
    });
  }

  private captureFail(): void {
    const minariId   = this.battleCtx?.enemyMinariId ?? 'droplet';
    const minariName = MINARI_ROSTER[minariId]?.name ?? minariId;
    this.showCaptureResult(false, minariName, () => {
      this.hideMenu();
      this.engine.submitCaptureFailed();
    });
  }

  private showCaptureResult(success: boolean, name: string, onClose: () => void): void {
    const { width: w, height: h } = this.scale;
    const bx = w / 2 - 180, by = h / 2 - 55;

    const colour = success ? '#44dd88' : '#ff4444';
    const title  = success ? `${name} was bonded!` : `${name} broke free!`;
    const body   = success ? 'Added to your party.' : 'It escaped the bond. Enemy attacks!';

    const panel = this.add.graphics().setDepth(80);
    panel.fillStyle(0x070714, 0.96);
    panel.fillRoundedRect(bx, by, 360, 110, 10);
    panel.lineStyle(2, success ? 0x33cc77 : 0xdd4444, 0.6);
    panel.strokeRoundedRect(bx, by, 360, 110, 10);

    const t1 = this.add.text(w / 2, by + 30, title, {
      fontSize: '19px', color: colour, fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(81);
    const t2 = this.add.text(w / 2, by + 62, body, {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5).setDepth(81);
    const t3 = this.add.text(w / 2, by + 92, 'tap / ENTER to continue', {
      fontSize: '10px', color: '#444466', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(81);

    const dismiss = (): void => {
      [panel, t1, t2, t3].forEach(o => o.destroy());
      this.input.off('pointerup', dismiss);
      this.input.keyboard!.off('keydown-ENTER', dismiss);
      onClose();
    };
    this.time.delayedCall(300, () => {
      this.input.once('pointerup', dismiss);
      this.input.keyboard!.once('keydown-ENTER', dismiss);
    });
  }

  // ── Run ────────────────────────────────────────────────────────────────────

  private handleRun(): void {
    const ctx = this.registry.get('classic_battle_context') as ClassicBattleContext | null;
    if (ctx?.battleType === 'rival') {
      this.showInfoOverlay('RUN', "Can't flee from a Rival battle!");
      return;
    }
    this.hideMenu();
    this.onBattleEnd('enemy');
  }

  // ── Info overlay ───────────────────────────────────────────────────────────

  private showInfoOverlay(title: string, body: string): void {
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

  // Keep old name for backward compat with any callers
  private showPlaceholderOverlay(title: string, body: string): void {
    this.showInfoOverlay(title, body);
  }

  // ── Damage / block display ─────────────────────────────────────────────────

  private onDamageDealt(
    target: ClassicActorRole, amount: number, blocked: boolean, wx: number, wy: number,
  ): void {
    const actor       = target === 'player' ? this.playerActor : this.enemyActor;
    const attackerSys = target === 'player' ? this.enemySyncSys  : this.playerSyncSys;
    const defenderSys = target === 'player' ? this.playerSyncSys : this.enemySyncSys;

    if (blocked) {
      defenderSys.onGuardSuccess();
      this.spawnBlockedDisplay(wx, wy, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.guardBlock);
    } else {
      attackerSys.onLandAttack();
      const isCrit = amount > 30; // rough threshold for crit-level hit
      if (isCrit) defenderSys.onTakeCrit();
      else        defenderSys.onTakeHeavyHit();
      this.spawnDamageNumber(wx, wy, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.attackHit);
      this.audio.playSfx(AUDIO_KEYS.sfx.hurtImpact, 0.6);
      this.audio.playCreatureHurt(actor.actorId);
    }
  }

  /** Returns a snapshot of all data the battle HUD needs to display. */
  getHUDData(): BattleHUDData {
    const profile       = this.registry.get('player_profile') as PlayerProfile | null;
    const playerMinId   = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId    = this.battleCtx?.enemyMinariId  ?? 'droplet';
    const playerData    = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData     = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];
    const playerBondLv  = profile?.bonds[playerMinId]?.bondLevel ?? 1;
    const soulRank      = profile?.soulRank;
    const playerSync    = this.playerSyncSys.getState();
    const enemySync     = this.enemySyncSys.getState();

    return {
      playerMonariId:    playerMinId,
      playerMonariName:  playerData.name,
      playerHp:          this.playerActor.hp,
      playerMaxHp:       this.playerActor.maxHp,
      playerAura:        this.playerActor.aura,
      playerMaxAura:     this.playerActor.maxAura,
      playerSync:        playerSync.sync,
      playerSyncTier:    playerSync.tier,
      playerBondLevel:   playerBondLv,
      bonderSoulRankLevel: soulRank?.level ?? 1,
      bonderSoulRankTier:  (soulRank?.tier ?? 'novice') as SoulRankTier,
      enemyMonariId:     enemyMinId,
      enemyMonariName:   enemyData.name,
      enemyHp:           this.enemyActor.hp,
      enemyMaxHp:        this.enemyActor.maxHp,
      enemyAura:         this.enemyActor.aura,
      enemyMaxAura:      this.enemyActor.maxAura,
      enemySync:         enemySync.sync,
      enemySyncTier:     enemySync.tier,
    };
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
