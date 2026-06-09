import Phaser from 'phaser';
import { ClassicActor } from '../entities/ClassicActor';
import { ClassicBattleEngine } from '../systems/ClassicBattleEngine';
import { SoulSyncSystem } from '../systems/SoulSyncSystem';
import { AudioManager } from '../systems/AudioManager';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS, BACK_COMMAND } from '../data/classicMoveData';
import { MINARI_ROSTER } from '../data/minariData';
import { PLAYER_PROFILE } from '../data/playerProfile';
import { CLASSIC_BATTLE_CONFIG } from '../config/classicBattleConfig';
import { DAMAGE_FORMULA } from '../config/combatFormulaConfig';
import { UI_THEME, elementColor } from '../config/uiTheme';
import { getMonariVisualPaths, getCharacterVisualPaths, visualCandidates } from '../config/assetManifest';
import { preloadVisualCandidates, bestLoadedVisualKey, drawGlassPanel } from '../ui/phaserUi';
import { AUDIO_KEYS } from '../config/audioConfig';
import { IS_TOUCH_DEVICE, SAFE_AREA_BOTTOM } from '../config/mobileConfig';
import { getEffectivenessMessage } from '../config/elementEffectivenessConfig';
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
    case 'fire':    return 'Fire';
    case 'water':   return 'Water';
    case 'flora':   return 'Flora';
    case 'wind':    return 'Wind';
    case 'thunder': return 'Thunder';
    case 'stone':   return 'Stone';
    case 'steel':   return 'Steel';
    case 'light':   return 'Light';
    case 'dark':    return 'Dark';
    case 'aether':  return 'Aether';
    case 'ice':     return 'Ice';
    case 'none':    return 'Guard';
    default:        return 'Neutral';
  }
}

function dmgTypeTheme(type: string): BtnTheme {
  switch (type) {
    case 'fire':    return { fill: 0x2d0800, selFill: 0x5a1000, border: 0xee3300, accent: 0xff5522 };
    case 'water':   return { fill: 0x001433, selFill: 0x002266, border: 0x2266ee, accent: 0x4488ff };
    case 'flora':   return { fill: 0x0d1f00, selFill: 0x1a3d00, border: 0x44aa22, accent: 0x66cc33 };
    case 'wind':    return { fill: 0x002222, selFill: 0x004444, border: 0x44cccc, accent: 0x66eedd };
    case 'thunder': return { fill: 0x1a1400, selFill: 0x332800, border: 0xddaa00, accent: 0xffcc00 };
    case 'stone':   return { fill: 0x1a1510, selFill: 0x332a20, border: 0x887766, accent: 0xaa9977 };
    case 'steel':   return { fill: 0x101820, selFill: 0x203040, border: 0x7799aa, accent: 0x99bbcc };
    case 'light':   return { fill: 0x1e1a00, selFill: 0x3d3500, border: 0xeedd77, accent: 0xfff0aa };
    case 'dark':    return { fill: 0x11002a, selFill: 0x220055, border: 0x7733cc, accent: 0x9955ee };
    case 'aether':  return { fill: 0x00101e, selFill: 0x001e3c, border: 0x3366dd, accent: 0x5588ff };
    case 'ice':     return { fill: 0x001422, selFill: 0x002244, border: 0x66ccff, accent: 0x88ddff };
    case 'none':    return { fill: 0x0e1e2e, selFill: 0x1a3248, border: 0x5588aa, accent: 0x88aacc };
    default:        return { fill: 0x111128, selFill: 0x1e1e44, border: 0x4455aa, accent: 0x6677bb };
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
  private auraBarH!:   number;
  private hudY!:       number;
  private hudH!:       number;

  // HP widgets
  private playerHpFill!:   Phaser.GameObjects.Rectangle;
  private enemyHpFill!:    Phaser.GameObjects.Rectangle;
  private playerHpText!:   Phaser.GameObjects.Text;
  private enemyHpText!:    Phaser.GameObjects.Text;

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

  // Last hit metadata from engine (set by onHitMeta, read by onDamageDealt)
  private lastHitMeta = { isCrit: false, typeAdvantage: false, typeModifier: 1, typeResisted: false };

  // Sync bar widgets
  private playerSyncFill!: Phaser.GameObjects.Rectangle;
  private enemySyncFill!:  Phaser.GameObjects.Rectangle;
  private syncBarH!:       number;

  // Misc UI
  private phaseLabel!:       Phaser.GameObjects.Text;
  private playerGuardLabel!: Phaser.GameObjects.Text;
  private enemyGuardLabel!:  Phaser.GameObjects.Text;
  private battleCallout!:    Phaser.GameObjects.Text;

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
    this.hudH     = mob ? 92 : 100;
    this.hudY     = h - this.hudH - (mob ? SAFE_AREA_BOTTOM : 0);

    this.drawBackground(w, h);

    // ── Combatants ────────────────────────────────────────────────────────────
    const playerMinId  = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId   = this.battleCtx?.enemyMinariId  ?? 'droplet';
    const playerData   = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData    = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];

    const playerBond   = profile?.bonds[playerMinId];
    const playerBondLv = playerBond?.bondLevel ?? 1;
    const playerLevel  = profile?.monariLevels[playerMinId]?.level ?? DAMAGE_FORMULA.DEFAULT_ENEMY_LEVEL;
    const enemyLevel   = DAMAGE_FORMULA.DEFAULT_ENEMY_LEVEL;

    // Soul Sync — enemy always starts at bond level 1 (wild / rival default)
    this.playerSyncSys = new SoulSyncSystem(playerMinId, playerBondLv);
    this.enemySyncSys  = new SoulSyncSystem(enemyMinId,  1);

    this.playerActor = new ClassicActor(
      this, this.pAnchorX, this.groundY - playerData.bodyHeight / 2, playerData, true,
      playerLevel,
    );
    this.enemyActor = new ClassicActor(
      this, this.eAnchorX, this.groundY - enemyData.bodyHeight / 2, enemyData, false,
      enemyLevel,
    );

    // ── Engine ────────────────────────────────────────────────────────────────
    this.engine = new ClassicBattleEngine(this, this.playerActor, this.enemyActor, {
      onPhaseChange:     (p)             => this.onPhaseChange(p),
      onShowCommandMenu: ()              => this.showMenu(),
      onHideCommandMenu: ()              => this.hideMenu(),
      onDamageDealt:     (t, d, b, x, y) => this.onDamageDealt(t, d, b, x, y),
      onBattleEnd:       (winner)        => this.onBattleEnd(winner),
      getSyncTier: (role) => {
        const sys = role === 'player' ? this.playerSyncSys : this.enemySyncSys;
        return sys.getTier();
      },
      onMoveAnnounce: (role, _moveId, moveName) => {
        const actor = role === 'player' ? this.playerActor : this.enemyActor;
        const name  = MINARI_ROSTER[actor.actorId]?.name ?? actor.actorId;
        this.showBattleCallout(`${name} used ${moveName}!`);
      },
      onMoveMiss: (role, moveName) => {
        const actor = role === 'player' ? this.playerActor : this.enemyActor;
        const name  = MINARI_ROSTER[actor.actorId]?.name ?? actor.actorId;
        this.showBattleCallout(`${name}'s ${moveName} missed!`, '#888899');
        const sys = role === 'player' ? this.playerSyncSys : this.enemySyncSys;
        sys.onMissAttack();
      },
      onSyncDamage: (target, delta) => {
        const sys = target === 'player' ? this.playerSyncSys : this.enemySyncSys;
        sys.applyDelta(delta);
      },
      onHitMeta: (target, meta) => {
        this.lastHitMeta = meta;
        const attackerSys = target === 'player' ? this.enemySyncSys : this.playerSyncSys;
        if (meta.typeAdvantage) attackerSys.onTypeAdvantage();
      },
    });

    // ── Audio ─────────────────────────────────────────────────────────────────
    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.battle);

    // ── UI ────────────────────────────────────────────────────────────────────
    this.buildHpBars(w, playerData.name, enemyData.name, playerLevel, enemyLevel, playerBondLv);
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

  private buildHpBars(
    w: number, playerName: string, enemyName: string,
    playerLevel: number, enemyLevel: number, bondLv: number,
  ): void {
    const mob  = IS_TOUCH_DEVICE;
    const d    = 20;
    const cardW = mob ? Math.round(w * 0.43) : 300;
    const cardH = mob ? 82 : 88;
    this.hpBarW   = cardW - (mob ? 96 : 108);
    this.hpBarH   = mob ? 12 : 11;
    this.auraBarH = mob ? 8 : 7;
    this.syncBarH = 5;

    const profile = this.registry.get('player_profile') as PlayerProfile | null;
    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId = this.battleCtx?.enemyMinariId ?? 'droplet';

    const drawCard = (x: number, y: number, side: 'player' | 'enemy', name: string, id: string, level: number, bond: number) => {
      const g = this.add.graphics().setDepth(d);
      drawGlassPanel(g, x, y, cardW, cardH, {
        radius: 18,
        fill: UI_THEME.colors.panelDeep,
        stroke: side === 'player' ? UI_THEME.colors.gold : UI_THEME.colors.purple,
        glow: side === 'player' ? UI_THEME.colors.gold : UI_THEME.colors.purple,
        alpha: 0.86,
      });
      const portraitKey = bestLoadedVisualKey(this, 'monari', id, elementColor(MINARI_ROSTER[id]?.element));
      const portraitX = side === 'player' ? x + 40 : x + cardW - 40;
      const img = this.add.image(portraitX, y + 42, portraitKey).setDepth(d + 2);
      const frame = this.textures.getFrame(portraitKey);
      img.setScale(Math.min(0.62, 58 / Math.max(frame.realWidth, frame.realHeight))).setAlpha(0.96);
      const nameX = side === 'player' ? x + 78 : x + 14;
      const align = side === 'player' ? 'left' : 'right';
      this.add.text(nameX, y + 11, name, {
        fontSize: mob ? '13px' : '14px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
      }).setOrigin(0, 0).setDepth(d + 2);
      this.add.text(side === 'player' ? x + cardW - 14 : x + 14, y + 13, `Lv. ${level}`, {
        fontSize: '11px', color: '#ffe39a', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
      }).setOrigin(side === 'player' ? 1 : 0, 0).setDepth(d + 2);
      const badgeW = 70;
      const badgeX = side === 'player' ? x + cardW - badgeW - 12 : x + 12;
      const badge = this.add.graphics().setDepth(d + 1);
      badge.fillStyle(UI_THEME.colors.gold, 0.16).fillRoundedRect(badgeX, y + cardH - 22, badgeW, 16, 8);
      badge.lineStyle(1, UI_THEME.colors.gold, 0.5).strokeRoundedRect(badgeX, y + cardH - 22, badgeW, 16, 8);
      this.add.text(badgeX + badgeW / 2, y + cardH - 14, `Bond Lv. ${bond}`, {
        fontSize: '9px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(d + 2);
      const bx = nameX;
      const by = y + 33;
      const labels = ['HP', 'Aura', 'Soul Sync'];
      labels.forEach((label, i) => this.add.text(bx - 30, by + i * 14 - 1, label, {
        fontSize: '8px', color: i === 2 ? '#ffe18c' : '#a9a5c9', fontFamily: UI_THEME.fonts.family,
      }).setOrigin(0, 0).setDepth(d + 2));
      const track = (yy: number, hh: number) => this.add.rectangle(bx, yy, this.hpBarW, hh, UI_THEME.bars.track, 0.9).setOrigin(0, 0).setDepth(d + 1);
      track(by, this.hpBarH); track(by + 14, this.auraBarH); track(by + 28, this.syncBarH);
      return { bx, by };
    };

    const p = drawCard(14, mob ? 16 : 18, 'player', playerName, playerMinId, playerLevel, bondLv);
    const e = drawCard(w - cardW - 14, mob ? 16 : 18, 'enemy', enemyName, enemyMinId, enemyLevel, 1);

    this.playerHpFill = this.add.rectangle(p.bx, p.by, this.hpBarW, this.hpBarH, UI_THEME.bars.hp).setOrigin(0, 0).setDepth(d + 3);
    this.playerAuraFill = this.add.rectangle(p.bx, p.by + 14, this.hpBarW, this.auraBarH, UI_THEME.bars.aura).setOrigin(0, 0).setDepth(d + 3);
    this.playerSyncFill = this.add.rectangle(p.bx, p.by + 28, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 3);
    this.playerHpText = this.add.text(p.bx + this.hpBarW - 2, p.by - 1, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.family,
    }).setOrigin(1, 0).setDepth(d + 4);

    this.enemyHpFill = this.add.rectangle(e.bx, e.by, this.hpBarW, this.hpBarH, UI_THEME.bars.hp).setOrigin(0, 0).setDepth(d + 3);
    this.enemyAuraFill = this.add.rectangle(e.bx, e.by + 14, this.hpBarW, this.auraBarH, UI_THEME.bars.aura).setOrigin(0, 0).setDepth(d + 3);
    this.enemySyncFill = this.add.rectangle(e.bx, e.by + 28, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 3);
    this.enemyHpText = this.add.text(e.bx + this.hpBarW - 2, e.by - 1, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: UI_THEME.fonts.family,
    }).setOrigin(1, 0).setDepth(d + 4);

    const playerKey = bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold);
    const hud = this.add.graphics().setDepth(d);
    drawGlassPanel(hud, 14, mob ? 104 : 112, 190, 42, { radius: 14, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.7 });
    this.add.image(35, mob ? 125 : 133, playerKey).setDisplaySize(30, 30).setDepth(d + 2);
    this.add.text(56, mob ? 113 : 121, PLAYER_PROFILE.displayName, { fontSize: '12px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(d + 2);
    this.add.text(56, mob ? 130 : 138, `Soul Rank ${profile?.soulRank.level ?? 1}`, { fontSize: '10px', color: '#ffdf7c', fontFamily: UI_THEME.fonts.family }).setDepth(d + 2);
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

    // Aura bars
    const par = Math.max(0, this.playerActor.aura / this.playerActor.maxAura);
    const ear = Math.max(0, this.enemyActor.aura  / this.enemyActor.maxAura);
    this.playerAuraFill.width = this.hpBarW * par;
    this.enemyAuraFill.width  = this.hpBarW * ear;

    // Sync bars
    this.playerSyncFill.width = this.hpBarW * (this.playerSyncSys.getSyncValue() / 100);
    this.enemySyncFill.width  = this.hpBarW * (this.enemySyncSys.getSyncValue()  / 100);
    this.playerSyncFill.setFillStyle(this.syncColor(this.playerSyncSys.getTier()));
    this.enemySyncFill.setFillStyle(this.syncColor(this.enemySyncSys.getTier()));
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

    this.battleCallout = this.add.text(w / 2, this.groundY - 50, '', {
      fontSize: mob ? '18px' : '16px', color: '#ffffff',
      fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22).setAlpha(0);
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

    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x07070f, 0.97);
    bgGfx.fillRect(0, 0, w, this.hudH + safeBot);
    bgGfx.lineStyle(2, 0xff6600, 0.6);
    bgGfx.lineBetween(0, 0, w, 0);
    bgGfx.lineStyle(1, 0xff9944, 0.12);
    bgGfx.lineBetween(0, 2, w, 2);
    this.hudGroup.add(bgGfx);

    // ── Main panel ────────────────────────────────────────────────────────────
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

      const lbl = this.add.text(
        bx + this.mainBtnW / 2, by + this.mainBtnH / 2,
        cfg.label,
        { fontSize: mob ? '17px' : '15px', color: '#d9d3ff', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold', align: 'center' },
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
    this.mainBtnTexts.forEach((t, i) => {
      const locked = this.MAIN_BTNS[i].key === 'capture' && (!this.battleCtx?.bondable || this.battleCtx?.battleType !== 'wild');
      t.setColor(locked ? '#6f6a90' : i === this.mainCursor ? '#ffffff' : '#b8b2dc');
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
      // lastHitMeta is set by onHitMeta callback (fires just before onDamageDealt)
      const { isCrit, typeAdvantage, typeModifier } = this.lastHitMeta;
      if (isCrit) defenderSys.onTakeCrit();
      const effectMsg = getEffectivenessMessage(typeModifier);
      if (effectMsg) this.showBattleCallout(effectMsg, typeAdvantage ? '#ffaa22' : '#88aaff');
      this.spawnDamageNumber(wx, wy, amount, isCrit, typeAdvantage);
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

  private spawnDamageNumber(
    wx: number, wy: number, amount: number,
    isCrit = false, typeAdvantage = false,
  ): void {
    const mob    = IS_TOUCH_DEVICE;
    const color  = isCrit ? '#ff4466' : typeAdvantage ? '#ffaa22' : '#ffdd44';
    const size   = isCrit ? (mob ? '36px' : '28px') : (mob ? '30px' : '22px');
    const label  = isCrit ? `★ ${amount}!` : `-${amount}`;
    const txt    = this.add.text(wx, wy, label, {
      fontSize: size, color,
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

  private showBattleCallout(msg: string, color = '#ffffff'): void {
    if (!this.battleCallout) return;
    this.tweens.killTweensOf(this.battleCallout);
    this.battleCallout.setText(msg).setColor(color).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: this.battleCallout, alpha: 0, duration: 1600, delay: 1000, ease: 'Quad.In' });
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
