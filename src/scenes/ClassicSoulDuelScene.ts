import Phaser from 'phaser';
import { applyHighDpiCanvas, getRenderDpr } from '../config/highDpi';
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
import {
  DESKTOP_BATTLE_HUD,
  MOBILE_LANDSCAPE_BATTLE_HUD,
  computePixelLayout,
  type PixelLayout,
} from '../config/battleHudLayout';
import { getEffectivenessMessage } from '../config/elementEffectivenessConfig';
import { BattleHudOverlay } from '../ui/BattleHudOverlay';
import type { ClassicBattlePhase, ClassicActorRole } from '../types/classic';
import type { BattleStatOverrides, ClassicBattleContext } from '../types/overworld';
import type { BattleHUDData, PlayerProfile, SoulSyncTier, SoulRankTier } from '../types/progression';

// ── HUD button colour schemes (fallback when PNGs absent) ────────────────────

interface BtnTheme { fill: number; selFill: number; border: number; accent: number }

const MAIN_BTN_THEMES: Record<string, BtnTheme> = {
  fight:   { fill: 0x2a0800, selFill: 0x6a1800, border: 0xff6622, accent: 0xff4400 },
  bag:     { fill: 0x061426, selFill: 0x0f2e5a, border: 0x3a88ff, accent: 0x2266dd },
  capture: { fill: 0x062010, selFill: 0x0f4422, border: 0x33cc77, accent: 0x228855 },
  run:     { fill: 0x14141e, selFill: 0x262636, border: 0x7788aa, accent: 0x556688 },
};

// Gameplay key → PNG asset key
const MAIN_BTN_PNG: Record<string, string> = {
  fight: 'ui_btn_fight', bag: 'ui_btn_bag', capture: 'ui_btn_bond', run: 'ui_btn_run',
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
  private groundY!:  number;
  private pAnchorX!: number;
  private eAnchorX!: number;
  private hpBarW!:   number;
  private hpBarH!:   number;
  private auraBarH!: number;
  private hudY!:     number;
  private hudH!:     number;

  // HP widgets
  private playerHpFill!: Phaser.GameObjects.Rectangle;
  private enemyHpFill!:  Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!:  Phaser.GameObjects.Text;

  // Aura widgets
  private playerAuraFill!: Phaser.GameObjects.Rectangle;
  private enemyAuraFill!:  Phaser.GameObjects.Rectangle;

  // Battle HUD containers
  private hudGroup!:   Phaser.GameObjects.Container;
  private mainPanel!:  Phaser.GameObjects.Container;
  private movesPanel!: Phaser.GameObjects.Container;
  private hudPhase:    'main' | 'moves' = 'main';
  private menuVisible  = false;

  // Main-panel state
  private mainCursor     = 0;
  private mainBtnImgs:   Phaser.GameObjects.Image[]    = [];
  private mainBtnGfxs:   Phaser.GameObjects.Graphics[] = [];
  private mainBtnTexts:  Phaser.GameObjects.Text[]     = [];
  private mainBtnW       = 0;
  private mainBtnH       = 0;
  private readonly MAIN_BTNS = [
    { key: 'fight',   label: 'FIGHT' },
    { key: 'bag',     label: 'BAG'   },
    { key: 'capture', label: 'BOND'  },
    { key: 'run',     label: 'RUN'   },
  ] as const;

  // Moves-panel state
  private menuCursor     = 0;
  private prevCursor     = -1;
  private menuCommandIds: string[]                     = [];
  private moveBtnGfxs:   Phaser.GameObjects.Graphics[] = [];
  private moveBtnTexts:  Phaser.GameObjects.Text[]     = [];
  private moveBtnThemes: BtnTheme[]                    = [];
  private moveBtnW       = 0;
  private moveBtnH       = 0;
  private readonly MOVE_COLS = 2;

  // Soul Sync systems
  private playerSyncSys!: SoulSyncSystem;
  private enemySyncSys!:  SoulSyncSystem;

  // Last hit metadata
  private lastHitMeta = { isCrit: false, typeAdvantage: false, typeModifier: 1, typeResisted: false };

  // Sync bar widgets
  private playerSyncFill!: Phaser.GameObjects.Rectangle;
  private enemySyncFill!:  Phaser.GameObjects.Rectangle;
  private syncBarH!:       number;

  // Turn badge
  private turnNumber    = 0;
  private turnBadgeTxt!: Phaser.GameObjects.Text;

  // Bottom soul sync strips
  private botBarW             = 0;
  private botPlayerSyncFill!: Phaser.GameObjects.Rectangle;
  private botEnemySyncFill!:  Phaser.GameObjects.Rectangle;

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

  // Battle context
  private battleCtx: ClassicBattleContext | null = null;

  // Normalized pixel layout (computed once per create() from the chosen config)
  private layout!: PixelLayout;

  // DOM HUD overlay
  private domHud!: BattleHudOverlay;
  private playerLevel = 1;
  private enemyLevel  = 1;
  private resizeTimer?: Phaser.Time.TimerEvent;

  constructor() { super({ key: 'ClassicSoulDuelScene' }); }

  shutdown(): void {
    this.domHud?.destroy();
  }

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

    // UI panel frames, buttons, icons
    this.load.image('ui_panel_left',   'assets/ui/battle/frames/panel_monari_left_empty.png');
    this.load.image('ui_panel_right',  'assets/ui/battle/frames/panel_monari_right_empty.png');
    this.load.image('ui_soulsync_bar', 'assets/ui/battle/frames/soulsync_bar_empty.png');
    this.load.image('ui_turn_badge',   'assets/ui/battle/frames/turn_badge_empty.png');
    this.load.image('ui_btn_fight',    'assets/ui/battle/buttons/btn_fight.png');
    this.load.image('ui_btn_bag',      'assets/ui/battle/buttons/btn_bag.png');
    this.load.image('ui_btn_bond',     'assets/ui/battle/buttons/btn_bond.png');
    this.load.image('ui_btn_run',      'assets/ui/battle/buttons/btn_run.png');
    (['fire','water','flora','wind','thunder','stone','steel','light','dark','aether','ice','neutral'] as const).forEach(el =>
      this.load.image(`ui_elem_${el}`, `assets/ui/elements/${el}.png`)
    );
    (['male','female','unknown'] as const).forEach(g =>
      this.load.image(`ui_gender_${g}`, `assets/ui/icons/gender_${g}.png`)
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private battleWorldSize(): { w: number; h: number; dpr: number; landscape: boolean } {
    const dpr = getRenderDpr();
    const w = Math.max(1, Math.round(this.game.renderer.width || this.scale.width * dpr));
    const h = Math.max(1, Math.round(this.game.renderer.height || this.scale.height * dpr));
    return { w, h, dpr, landscape: w > h };
  }

  private syncBattleCamera(): void {
    const { w, h } = this.battleWorldSize();
    this.cameras.main.setViewport(0, 0, w, h).setZoom(1).setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, w, h);
  }

  private relayoutBattle = (): void => {
    this.resizeTimer?.remove(false);
    this.resizeTimer = this.time.delayedCall(220, () => {
      this.registry.set('classic_battle_context', this.battleCtx);
      this.scene.restart();
    });
  };


  private applyLabStatOverrides(actor: ClassicActor, overrides?: BattleStatOverrides): void {
    if (!overrides) return;
    const stats = actor.computedStats as unknown as Record<string, number>;
    if (overrides.attack !== undefined) stats.attack = overrides.attack;
    if (overrides.specialAttack !== undefined) stats.specialAttack = overrides.specialAttack;
    if (overrides.defense !== undefined) stats.defense = overrides.defense;
    if (overrides.specialDefense !== undefined) stats.specialDefense = overrides.specialDefense;
    if (overrides.speed !== undefined) stats.speed = overrides.speed;
  }

  private updateLabDebugRegistry(): void {
    if (!this.battleCtx?.labDebug) return;
    const lines = this.registry.get('battle_layout_debug') as string[] | undefined ?? [];
    this.registry.set('battle_layout_debug', [
      ...lines,
      `formula damage=floor(power × atk/def × (0.35+level/100) × type × sync × crit × variance × guard)`,
      `type effective 1.75 resisted 0.75 variance 0.90-1.10 crit 1.5`,
      `player stats A${this.playerActor.computedStats.attack}/SA${this.playerActor.computedStats.specialAttack}/D${this.playerActor.computedStats.defense}/SD${this.playerActor.computedStats.specialDefense}/Spd${this.playerActor.computedStats.speed}`,
      `enemy stats A${this.enemyActor.computedStats.attack}/SA${this.enemyActor.computedStats.specialAttack}/D${this.enemyActor.computedStats.defense}/SD${this.enemyActor.computedStats.specialDefense}/Spd${this.enemyActor.computedStats.speed}`,
    ]);
  }

  create(): void {
    this.turnNumber = 0;
    this.domHud?.destroy();
    applyHighDpiCanvas(this.game, 'battle:create');
    this.syncBattleCamera();
    const { w, h, dpr, landscape } = this.battleWorldSize();
    const mob = IS_TOUCH_DEVICE;

    this.battleCtx = this.registry.get('classic_battle_context') as ClassicBattleContext | null;
    const profile  = this.registry.get('player_profile') as PlayerProfile | null;

    const hudCfg  = mob ? MOBILE_LANDSCAPE_BATTLE_HUD : DESKTOP_BATTLE_HUD;
    this.layout   = computePixelLayout(hudCfg, w, h);

    this.groundY  = Math.round(this.layout.groundY);
    this.pAnchorX = Math.round(this.layout.playerMonari.x);
    this.eAnchorX = Math.round(this.layout.enemyMonari.x);
    this.hpBarW   = mob ? Math.round(w * 0.28) : 200; // overridden in buildHpBars
    this.hpBarH   = mob ? 18 : 14;
    this.auraBarH = mob ? 8  : 6;
    this.syncBarH = mob ? 6  : 5;
    this.hudH     = Math.round(h * (mob ? 0.145 : 0.145));
    this.hudY     = Math.round(this.layout.commandRow.y);

    this.drawBackground(w, h);

    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId  = this.battleCtx?.enemyMinariId  ?? 'droplet';
    const playerData  = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData   = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];

    const playerBond   = profile?.bonds[playerMinId];
    const playerBondLv = playerBond?.bondLevel ?? 1;
    const playerLevel  = this.battleCtx?.playerLevel
      ?? profile?.monariLevels[playerMinId]?.level
      ?? DAMAGE_FORMULA.DEFAULT_ENEMY_LEVEL;
    const enemyLevel   = this.battleCtx?.enemyLevel ?? DAMAGE_FORMULA.DEFAULT_ENEMY_LEVEL;
    this.playerLevel = playerLevel;
    this.enemyLevel  = enemyLevel;

    this.playerSyncSys = new SoulSyncSystem(playerMinId, playerBondLv);
    this.enemySyncSys  = new SoulSyncSystem(enemyMinId,  1);

    this.playerActor = new ClassicActor(
      this, this.pAnchorX, this.groundY - playerData.bodyHeight / 2, playerData, true, playerLevel,
    );
    this.enemyActor = new ClassicActor(
      this, this.eAnchorX, this.groundY - enemyData.bodyHeight / 2, enemyData, false, enemyLevel,
    );
    // The battle scene now lays out in renderer pixels, matching the fixed Story
    // overworld. Scale actors by DPR, with a landscape-specific reduction so
    // Monari remain grounded and do not crowd the mobile HUD.
    const battleActorScale = dpr * (landscape ? 0.74 : 0.96);
    this.playerActor.setScale(battleActorScale);
    this.enemyActor.setScale(battleActorScale);
    this.applyLabStatOverrides(this.playerActor, this.battleCtx?.playerStatOverrides);
    this.applyLabStatOverrides(this.enemyActor, this.battleCtx?.enemyStatOverrides);

    this.engine = new ClassicBattleEngine(this, this.playerActor, this.enemyActor, {
      onPhaseChange:     (p)              => this.onPhaseChange(p),
      onShowCommandMenu: ()               => this.showMenu(),
      onHideCommandMenu: ()               => this.hideMenu(),
      onDamageDealt:     (t, d, b, x, y) => this.onDamageDealt(t, d, b, x, y),
      onBattleEnd:       (winner)         => this.onBattleEnd(winner),
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

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.battle);

    // Populate move list before building callbacks
    const moveset       = CLASSIC_COMMAND_SETS[playerMinId] ?? ['basic_attack'];
    this.menuCommandIds = [...moveset, BACK_COMMAND];

    this.domHud = new BattleHudOverlay({
      onMainCommand: (key) => {
        switch (key) {
          case 'fight':
            this.audio.playUi(AUDIO_KEYS.ui.confirm);
            this.domHud.showMovesPanel(this.menuCommandIds, this.playerActor.aura, this.playerActor.usedGuardLastTurn);
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
        }
      },
      onMoveSelect: (id) => {
        this.audio.playUi(AUDIO_KEYS.ui.confirm);
        this.engine.submitPlayerMove(id);
      },
      onBack: () => {
        this.audio.playUi(AUDIO_KEYS.ui.move);
        this.domHud.showMainPanel();
      },
    });

    this.buildLabels(w);

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.upKey    = this.input.keyboard!.addKey(K.UP);
    this.downKey  = this.input.keyboard!.addKey(K.DOWN);
    this.leftKey  = this.input.keyboard!.addKey(K.LEFT);
    this.rightKey = this.input.keyboard!.addKey(K.RIGHT);
    this.enterKey = this.input.keyboard!.addKey(K.ENTER);
    this.escKey   = this.input.keyboard!.addKey(K.ESC);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayoutBattle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayoutBattle, this);
      this.resizeTimer?.remove(false);
    });

    this.debugBattleLayout('create');
    this.updateLabDebugRegistry();
    this.cameras.main.fadeIn(500);
    this.time.delayedCall(800, () => this.engine.startBattle());
  }

  update(): void {
    this.playerActor.updateShadow();
    this.enemyActor.updateShadow();
    this.domHud.update(this.getHUDData(), this.playerLevel, this.enemyLevel);
    this.updateGuardLabel();

    if (!this.menuVisible) return;

    const jUp    = Phaser.Input.Keyboard.JustDown(this.upKey);
    const jDown  = Phaser.Input.Keyboard.JustDown(this.downKey);
    const jLeft  = Phaser.Input.Keyboard.JustDown(this.leftKey);
    const jRight = Phaser.Input.Keyboard.JustDown(this.rightKey);
    const jOk    = Phaser.Input.Keyboard.JustDown(this.enterKey);
    const jEsc   = Phaser.Input.Keyboard.JustDown(this.escKey);

    if (jLeft  || jUp)   { this.domHud.navLeft();  this.audio.playUi(AUDIO_KEYS.ui.move); }
    if (jRight || jDown) { this.domHud.navRight(); this.audio.playUi(AUDIO_KEYS.ui.move); }
    if (jOk)             { this.domHud.confirm(); }
    if (jEsc)            { this.domHud.back();     this.audio.playUi(AUDIO_KEYS.ui.move); }
  }

  private debugBattleLayout(reason: string): void {
    const bg = this.children.list.find((obj): obj is Phaser.GameObjects.Image =>
      obj instanceof Phaser.GameObjects.Image && !!obj.getData('battleDebug')
    );
    const info = bg?.getData('battleDebug') as { key: string; texture: string } | undefined;
    const orientation = this.battleWorldSize().landscape ? 'landscape' : 'portrait';
    const lines = [
      `battle ${orientation} bg ${info?.key ?? 'fallback'} tex ${info?.texture ?? 'generated'} display ${bg ? `${Math.round(bg.displayWidth)}x${Math.round(bg.displayHeight)} @ ${Math.round(bg.x)},${Math.round(bg.y)} origin ${bg.originX},${bg.originY}` : 'none'}`,
      `battle player ${this.playerActor?.actorId ?? 'none'} @ ${Math.round(this.playerActor?.x ?? 0)},${Math.round(this.playerActor?.y ?? 0)} scale ${this.playerActor?.scaleX?.toFixed(2) ?? 'n/a'}`,
      `battle enemy ${this.enemyActor?.actorId ?? 'none'} @ ${Math.round(this.enemyActor?.x ?? 0)},${Math.round(this.enemyActor?.y ?? 0)} scale ${this.enemyActor?.scaleX?.toFixed(2) ?? 'n/a'}`,
    ];
    this.registry.set('battle_layout_debug', lines);
    console.info('[battle-layout]', { reason, scene: this.scene.key, orientation, renderer: `${this.game.renderer.width}x${this.game.renderer.height}`, scale: `${this.scale.width}x${this.scale.height}`, camera: `vp ${this.cameras.main.x},${this.cameras.main.y} ${this.cameras.main.width}x${this.cameras.main.height} scroll ${this.cameras.main.scrollX},${this.cameras.main.scrollY} z${this.cameras.main.zoom}`, lines });
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const bgKey = `bg_${CLASSIC_BATTLE_CONFIG.background}`;
    if (this.textures.exists(bgKey)) {
      const frame = this.textures.getFrame(bgKey);
      const scale = Math.max(w / frame.realWidth, h / frame.realHeight);
      const bg = this.add.image(w / 2, h / 2, bgKey).setDepth(0).setScale(scale);
      bg.setData('battleDebug', { key: bgKey, texture: `${frame.realWidth}x${frame.realHeight}` });

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

  // ── Status panels (HP / Aura / Sync cards) ─────────────────────────────────

  private buildHpBars(
    w: number, playerName: string, enemyName: string,
    playerLevel: number, enemyLevel: number, bondLv: number,
  ): void {
    const mob     = IS_TOUCH_DEVICE;
    const d       = 20;
    const profile = this.registry.get('player_profile') as PlayerProfile | null;

    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId  = this.battleCtx?.enemyMinariId  ?? 'droplet';

    // Panel dimensions driven by normalized layout config
    const pLyt     = this.layout.playerStatus;
    const eLyt     = this.layout.enemyStatus;
    const panelW   = Math.round(pLyt.w);
    const panelH   = Math.round(pLyt.h);
    const iconArea = Math.round(panelW * 0.22); // portrait + element icon strip
    const labelW   = 26;                         // bar label text reserved width

    // Both panels share the same bar fill width
    this.hpBarW   = panelW - iconArea - labelW - 18;
    this.hpBarH   = mob ? 7 : 8;
    this.auraBarH = mob ? 5 : 6;
    this.syncBarH = 4;

    const panelY = Math.round(pLyt.y);

    const buildCard = (
      side: 'player' | 'enemy',
      minId: string, name: string, level: number, bond: number,
    ): { bx: number; by: number } => {
      const px = side === 'player' ? Math.round(pLyt.x) : Math.round(eLyt.x);

      // PNG panel frame
      const frameKey = side === 'player' ? 'ui_panel_left' : 'ui_panel_right';
      if (this.textures.exists(frameKey)) {
        this.add.image(px, panelY, frameKey)
          .setOrigin(0, 0)
          .setDisplaySize(panelW, panelH)
          .setDepth(d);
      } else {
        const g = this.add.graphics().setDepth(d);
        drawGlassPanel(g, px, panelY, panelW, panelH, {
          radius: 14,
          fill:   UI_THEME.colors.panelDeep,
          stroke: side === 'player' ? UI_THEME.colors.gold   : UI_THEME.colors.purple,
          glow:   side === 'player' ? UI_THEME.colors.gold   : UI_THEME.colors.purple,
          alpha:  0.86,
        });
      }

      // Monari portrait in icon strip
      const iconCX = side === 'player'
        ? px + iconArea / 2
        : px + panelW - iconArea / 2;
      const iconCY      = panelY + Math.round(panelH * 0.44);
      const portraitKey = bestLoadedVisualKey(this, 'monari', minId, elementColor(MINARI_ROSTER[minId]?.element));
      const portraitSz  = Math.round(iconArea * 0.80);
      this.add.image(iconCX, iconCY, portraitKey)
        .setDisplaySize(portraitSz, portraitSz)
        .setDepth(d + 2)
        .setAlpha(0.96);

      // Element icon (bottom of icon strip)
      const elem    = MINARI_ROSTER[minId]?.element ?? 'neutral';
      const elemKey = `ui_elem_${elem}`;
      const elemSz  = mob ? 14 : 15;
      if (this.textures.exists(elemKey)) {
        this.add.image(iconCX, panelY + panelH - 8, elemKey)
          .setDisplaySize(elemSz, elemSz)
          .setDepth(d + 3);
      } else {
        const gfxEl = this.add.graphics().setDepth(d + 3);
        gfxEl.fillStyle(elementColor(elem), 1);
        gfxEl.fillCircle(iconCX, panelY + panelH - 8, elemSz / 2);
      }

      // Text column
      const textColX = side === 'player' ? px + iconArea + 6 : px + 4;
      const barColX  = textColX + labelW;
      const textY    = panelY + 5;

      // Monari name (Orbitron)
      this.add.text(textColX, textY, name, {
        fontSize:   mob ? '9px' : '10px',
        color:      UI_THEME.colors.text,
        fontFamily: UI_THEME.fonts.family,
        fontStyle:  'bold',
      }).setOrigin(0, 0).setDepth(d + 2);

      // Gender icon
      const gender    = MINARI_ROSTER[minId]?.gender ?? 'unknown';
      const genderKey = `ui_gender_${gender}`;
      const gSz       = mob ? 10 : 11;
      if (gender !== 'unknown' && this.textures.exists(genderKey)) {
        this.add.image(textColX + (mob ? 52 : 58) + gSz / 2, textY + 5, genderKey)
          .setDisplaySize(gSz, gSz)
          .setDepth(d + 3);
      }

      // Level (right-aligned to text column edge, Rajdhani)
      const lvEdgeX = side === 'player'
        ? px + panelW - 4
        : px + panelW - iconArea - 6;
      this.add.text(lvEdgeX, textY, `Lv.${level}`, {
        fontSize:   '9px',
        color:      '#ffe39a',
        fontFamily: UI_THEME.fonts.stat,
        fontStyle:  'bold',
      }).setOrigin(1, 0).setDepth(d + 2);

      // HP / Aura / Sync bar rows
      const barStartY  = textY + 13;
      const barGap     = 11;
      const barHeights = [this.hpBarH, this.auraBarH, this.syncBarH] as const;
      const labelColors = ['#8e8ab0', '#8e8ab0', '#ffe18c'];

      (['HP', 'Aura', 'Sync'] as const).forEach((lbl, i) => {
        const barY = barStartY + i * barGap;
        this.add.text(textColX, barY, lbl, {
          fontSize:   '7px',
          color:      labelColors[i],
          fontFamily: UI_THEME.fonts.stat,
        }).setOrigin(0, 0).setDepth(d + 2);
        this.add.rectangle(barColX, barY, this.hpBarW, barHeights[i], UI_THEME.bars.track, 0.9)
          .setOrigin(0, 0).setDepth(d + 1);
      });

      // Bond badge at panel bottom centre
      this.add.text(px + panelW / 2, panelY + panelH - 3, `Bond Lv. ${bond}`, {
        fontSize:   '7px',
        color:      '#fff0b8',
        fontFamily: UI_THEME.fonts.family,
      }).setOrigin(0.5, 1).setDepth(d + 2);

      return { bx: barColX, by: barStartY };
    };

    const p = buildCard('player', playerMinId, playerName, playerLevel, bondLv);
    const e = buildCard('enemy',  enemyMinId,  enemyName,  enemyLevel,  1);

    // Mutable fill rectangles updated every frame
    this.playerHpFill   = this.add.rectangle(p.bx, p.by,      this.hpBarW, this.hpBarH,   UI_THEME.bars.hp      ).setOrigin(0, 0).setDepth(d + 3);
    this.playerAuraFill = this.add.rectangle(p.bx, p.by + 11, this.hpBarW, this.auraBarH, UI_THEME.bars.aura    ).setOrigin(0, 0).setDepth(d + 3);
    this.playerSyncFill = this.add.rectangle(p.bx, p.by + 22, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 3);
    this.playerHpText   = this.add.text(p.bx + this.hpBarW, p.by - 1, '', {
      fontSize: '8px', color: '#ffffff', fontFamily: UI_THEME.fonts.stat,
    }).setOrigin(1, 0).setDepth(d + 4);

    this.enemyHpFill   = this.add.rectangle(e.bx, e.by,      this.hpBarW, this.hpBarH,   UI_THEME.bars.hp      ).setOrigin(0, 0).setDepth(d + 3);
    this.enemyAuraFill = this.add.rectangle(e.bx, e.by + 11, this.hpBarW, this.auraBarH, UI_THEME.bars.aura    ).setOrigin(0, 0).setDepth(d + 3);
    this.enemySyncFill = this.add.rectangle(e.bx, e.by + 22, this.hpBarW, this.syncBarH, UI_THEME.bars.soulSync).setOrigin(0, 0).setDepth(d + 3);
    this.enemyHpText   = this.add.text(e.bx + this.hpBarW, e.by - 1, '', {
      fontSize: '8px', color: '#ffffff', fontFamily: UI_THEME.fonts.stat,
    }).setOrigin(1, 0).setDepth(d + 4);

    // Trainer identity plate (below player panel)
    const playerKey = bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold);
    const plateY    = panelY + panelH + (mob ? 6 : 8);
    const plate     = this.add.graphics().setDepth(d);
    drawGlassPanel(plate, 8, plateY, 156, 34, {
      radius: 10, fill: UI_THEME.colors.panelDeep,
      stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.68,
    });
    this.add.image(24, plateY + 17, playerKey).setDisplaySize(24, 24).setDepth(d + 2);
    this.add.text(40, plateY + 5, PLAYER_PROFILE.displayName, {
      fontSize: '11px', color: UI_THEME.colors.text,
      fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setDepth(d + 2);
    this.add.text(40, plateY + 19, `Soul Rank ${profile?.soulRank.level ?? 1}`, {
      fontSize: '9px', color: '#ffdf7c', fontFamily: UI_THEME.fonts.family,
    }).setDepth(d + 2);
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

    const par = Math.max(0, this.playerActor.aura / this.playerActor.maxAura);
    const ear = Math.max(0, this.enemyActor.aura  / this.enemyActor.maxAura);
    this.playerAuraFill.width = this.hpBarW * par;
    this.enemyAuraFill.width  = this.hpBarW * ear;

    this.playerSyncFill.width = this.hpBarW * (this.playerSyncSys.getSyncValue() / 100);
    this.enemySyncFill.width  = this.hpBarW * (this.enemySyncSys.getSyncValue()  / 100);
    this.playerSyncFill.setFillStyle(this.syncColor(this.playerSyncSys.getTier()));
    this.enemySyncFill.setFillStyle(this.syncColor(this.enemySyncSys.getTier()));

    if (this.botPlayerSyncFill) {
      this.botPlayerSyncFill.width = this.botBarW * (this.playerSyncSys.getSyncValue() / 100);
      this.botPlayerSyncFill.setFillStyle(this.syncColor(this.playerSyncSys.getTier()));
    }
    if (this.botEnemySyncFill) {
      this.botEnemySyncFill.width = this.botBarW * (this.enemySyncSys.getSyncValue() / 100);
      this.botEnemySyncFill.setFillStyle(this.syncColor(this.enemySyncSys.getTier()));
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

  // ── Turn badge ─────────────────────────────────────────────────────────────

  private buildTurnBadge(_w: number): void {
    const mob    = IS_TOUCH_DEVICE;
    const lyt    = this.layout.turnBadge;
    // Minimum 60 px wide so the number is always readable
    const badgeW = Math.max(60, Math.round(lyt.w));
    const badgeH = Math.round(lyt.h);
    const bx     = Math.round(lyt.x + lyt.w / 2);
    const by     = Math.round(lyt.y + badgeH / 2);

    if (this.textures.exists('ui_turn_badge')) {
      this.add.image(bx, by, 'ui_turn_badge')
        .setDisplaySize(badgeW, badgeH)
        .setDepth(22)
        .setAlpha(0.90);
    } else {
      const g = this.add.graphics().setDepth(22);
      g.fillStyle(UI_THEME.colors.panelDeep, 0.88);
      g.fillRoundedRect(bx - badgeW / 2, lyt.y, badgeW, badgeH, 8);
      g.lineStyle(1, UI_THEME.colors.gold, 0.45);
      g.strokeRoundedRect(bx - badgeW / 2, lyt.y, badgeW, badgeH, 8);
    }

    const labelSz = Math.max(7, Math.round(badgeH * 0.25));
    const numSz   = Math.max(14, Math.round(badgeH * 0.42));

    this.add.text(bx, by - Math.round(badgeH * 0.18), 'TURN', {
      fontSize:   `${labelSz}px`,
      color:      UI_THEME.colors.textMuted,
      fontFamily: UI_THEME.fonts.family,
      fontStyle:  'bold',
    }).setOrigin(0.5, 0.5).setDepth(23);

    this.turnBadgeTxt = this.add.text(bx, by + Math.round(badgeH * 0.10), '01', {
      fontSize:   `${numSz}px`,
      color:      UI_THEME.colors.text,
      fontFamily: UI_THEME.fonts.family,
      fontStyle:  'bold',
    }).setOrigin(0.5, 0.5).setDepth(23);
  }

  // ── Bottom Soul Sync strips ────────────────────────────────────────────────

  private buildBottomBars(_w: number, _h: number): void {
    const mob   = IS_TOUCH_DEVICE;
    const depth = 12;
    const plyt  = this.layout.soulbondBar;
    const elyt  = this.layout.soulsyncBar;

    const buildBar = (
      label: string,
      lyt: { x: number; y: number; w: number; h: number },
    ): Phaser.GameObjects.Rectangle => {
      const bx      = Math.round(lyt.x);
      const by      = Math.round(lyt.y);
      const frameW  = Math.round(lyt.w);
      const frameH  = Math.round(lyt.h);
      const labelW  = 40;
      const fillX   = bx + labelW;
      const fillY   = by + Math.round((frameH - 6) / 2);
      this.botBarW  = frameW - labelW;

      if (this.textures.exists('ui_soulsync_bar')) {
        this.add.image(bx, by, 'ui_soulsync_bar')
          .setOrigin(0, 0)
          .setDisplaySize(frameW, frameH)
          .setDepth(depth)
          .setAlpha(0.80);
      } else {
        const g = this.add.graphics().setDepth(depth);
        g.fillStyle(UI_THEME.colors.panelDeep, 0.7);
        g.fillRoundedRect(bx, by, frameW, frameH, 4);
        g.lineStyle(1, UI_THEME.colors.strokeDim, 0.38);
        g.strokeRoundedRect(bx, by, frameW, frameH, 4);
      }

      const sz = Math.max(7, Math.round(frameH * 0.38));
      this.add.text(bx + 4, by + frameH / 2, label, {
        fontSize:   `${sz}px`,
        color:      '#ffe18c',
        fontFamily: UI_THEME.fonts.stat,
        fontStyle:  'bold',
      }).setOrigin(0, 0.5).setDepth(depth + 1);

      this.add.rectangle(fillX, fillY, this.botBarW, 6, UI_THEME.bars.track, 0.8)
        .setOrigin(0, 0).setDepth(depth + 1);
      return this.add.rectangle(fillX, fillY, 0, 6, UI_THEME.bars.soulSync)
        .setOrigin(0, 0).setDepth(depth + 2);
    };

    this.botPlayerSyncFill = buildBar('SYNC ▶', plyt);
    this.botEnemySyncFill  = buildBar('◀ SYNC', elyt);
  }

  // ── Phase / guard labels ────────────────────────────────────────────────────

  private buildLabels(w: number): void {
    const mob = IS_TOUCH_DEVICE;
    this.phaseLabel = this.add.text(w / 2, this.hudY - 14, '', {
      fontSize: mob ? '12px' : '11px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(15);

    const guardStyle = {
      fontSize: mob ? '13px' : '11px', color: '#88ddff', fontFamily: 'monospace',
      backgroundColor: '#001e2ecc', padding: { x: 6, y: 3 },
      stroke: '#000000', strokeThickness: 2,
    };
    this.playerGuardLabel = this.add.text(this.pAnchorX, 0, '[ GUARD ]', guardStyle)
      .setOrigin(0.5).setDepth(25).setVisible(false);
    this.enemyGuardLabel  = this.add.text(this.eAnchorX, 0, '[ GUARD ]', guardStyle)
      .setOrigin(0.5).setDepth(25).setVisible(false);

    this.battleCallout = this.add.text(w / 2, Math.round(this.layout.commandRow.y) - 28, '', {
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
    if (phase === 'player_command') {
      this.turnNumber++;
      this.domHud.setTurnNumber(this.turnNumber);
    }
    const map: Partial<Record<ClassicBattlePhase, string>> = {
      player_command:   'Choose your move...',
      approach_target:  'Approaching...',
      return_to_anchor: 'Returning...',
    };
    this.phaseLabel.setText(map[phase] ?? '');
  }

  // ── Battle HUD (command buttons) ───────────────────────────────────────────

  private buildBattleHud(w: number, _h: number, playerId: string): void {
    const mob     = IS_TOUCH_DEVICE;
    const gap     = 8;
    const safeBot = mob ? SAFE_AREA_BOTTOM : 0;
    const cmdRow  = this.layout.commandRow;

    // Buttons fill the command row evenly
    const nMain   = this.MAIN_BTNS.length;
    const btnH    = Math.round(cmdRow.h - 8);
    const btnW    = Math.round((cmdRow.w - gap * (nMain + 1)) / nMain);
    const btnOffX = Math.round(cmdRow.x);

    this.mainBtnW = btnW;
    this.mainBtnH = btnH;

    const moveset       = CLASSIC_COMMAND_SETS[playerId] ?? ['basic_attack'];
    this.menuCommandIds = [...moveset, BACK_COMMAND];
    const nMoves        = this.menuCommandIds.length;
    const rows          = Math.ceil(nMoves / this.MOVE_COLS);
    this.moveBtnW       = Math.floor((w - (this.MOVE_COLS + 1) * gap) / this.MOVE_COLS);
    this.moveBtnH       = Math.floor((this.hudH - 10 - (rows - 1) * 6) / rows);

    this.moveBtnThemes = this.menuCommandIds.map(id => {
      if (id === BACK_COMMAND) return { fill: 0x0e0e1e, selFill: 0x1e1e38, border: 0x7788aa, accent: 0x9999cc };
      return dmgTypeTheme(CLASSIC_MOVES[id]?.damageType ?? '');
    });

    // HUD backdrop — positioned at commandRow top, extends to canvas bottom
    this.hudGroup = this.add.container(0, this.hudY).setDepth(30).setVisible(false);
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x07070f, 0.94);
    bgGfx.fillRect(0, 0, w, this.hudH + safeBot);
    bgGfx.lineStyle(2, UI_THEME.colors.stroke, 0.42);
    bgGfx.lineBetween(0, 0, w, 0);
    this.hudGroup.add(bgGfx);

    // Main panel
    this.mainPanel    = this.add.container(0, 0);
    this.mainBtnImgs  = [];
    this.mainBtnGfxs  = [];
    this.mainBtnTexts = [];

    const allPngsLoaded = this.MAIN_BTNS.every(b => {
      const k = MAIN_BTN_PNG[b.key] ?? '';
      return k !== '' && this.textures.exists(k);
    });

    this.MAIN_BTNS.forEach((cfg, i) => {
      const bx = btnOffX + gap + i * (btnW + gap);
      const by = Math.floor((this.hudH - btnH) / 2);

      if (allPngsLoaded) {
        // PNG buttons have the label baked in — no text overlay
        const img = this.add.image(bx, by, MAIN_BTN_PNG[cfg.key])
          .setOrigin(0, 0)
          .setDisplaySize(btnW, btnH)
          .setAlpha(0.65);
        this.mainPanel.add(img);
        this.mainBtnImgs.push(img);

        // Invisible hit-target for pointer events (covers PNG area)
        const hitArea = this.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0x000000, 0)
          .setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerover',  () => { this.mainCursor = i; this.refreshMainCursor(); });
        hitArea.on('pointerdown',  () => { this.mainCursor = i; this.refreshMainCursor(); this.activateMainBtn(i); });
        this.mainPanel.add(hitArea);
        // Push null placeholder so mainBtnTexts index stays aligned
        this.mainBtnTexts.push(null as unknown as Phaser.GameObjects.Text);
      } else {
        // Graphics fallback — label is necessary
        const gfx = this.add.graphics();
        gfx.setPosition(bx, by);
        this.mainPanel.add(gfx);
        this.mainBtnGfxs.push(gfx);

        const lbl = this.add.text(
          bx + btnW / 2, by + btnH / 2, cfg.label,
          {
            fontSize:   mob ? '14px' : '13px',
            color:      '#d9d3ff',
            fontFamily: UI_THEME.fonts.family,
            fontStyle:  'bold',
            align:      'center',
          },
        ).setOrigin(0.5);

        lbl.setInteractive(
          new Phaser.Geom.Rectangle(-btnW / 2 - 4, -btnH / 2 - 4, btnW + 8, btnH + 8),
          Phaser.Geom.Rectangle.Contains,
        );
        lbl.input!.cursor = 'pointer';
        lbl.on('pointerover',  () => { this.mainCursor = i; this.refreshMainCursor(); });
        lbl.on('pointerdown',  () => { this.mainCursor = i; this.refreshMainCursor(); this.activateMainBtn(i); });
        this.mainPanel.add(lbl);
        this.mainBtnTexts.push(lbl);
      }
    });

    this.hudGroup.add(this.mainPanel);

    // Moves panel (Graphics-based, element-themed)
    this.movesPanel   = this.add.container(0, 0);
    this.moveBtnGfxs  = [];
    this.moveBtnTexts = [];

    this.menuCommandIds.forEach((id, i) => {
      const col   = i % this.MOVE_COLS;
      const row   = Math.floor(i / this.MOVE_COLS);
      const bx    = gap + col * (this.moveBtnW + gap);
      const by    = 5 + row * (this.moveBtnH + 6);
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

      const label   = id === BACK_COMMAND
        ? '← BACK'
        : (CLASSIC_MOVES[id]?.displayName?.toUpperCase() ?? id.toUpperCase());
      const move    = id !== BACK_COMMAND ? CLASSIC_MOVES[id] : undefined;
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
    if (this.mainBtnImgs.length > 0) {
      this.mainBtnImgs.forEach((img, i) => {
        const sel = i === this.mainCursor;
        img.setAlpha(sel ? 1.0 : 0.55);
        if (sel) img.clearTint();
        else     img.setTint(0x888899);
      });
    } else {
      this.mainBtnGfxs.forEach((gfx, i) => {
        this.drawHudBtn(gfx, this.mainBtnW, this.mainBtnH, MAIN_BTN_THEMES[this.MAIN_BTNS[i].key], i === this.mainCursor);
      });
    }
    this.mainBtnTexts.forEach((t, i) => {
      const locked = this.MAIN_BTNS[i].key === 'capture' && (!this.battleCtx?.bondable || this.battleCtx?.battleType !== 'wild');
      t.setColor(locked ? '#6f6a90' : i === this.mainCursor ? '#ffffff' : '#b8b2dc');
    });
  }

  private refreshMoveCursor(): void {
    this.moveBtnGfxs.forEach((gfx, i) => {
      const id     = this.menuCommandIds[i];
      const cost   = (id !== BACK_COMMAND) ? (CLASSIC_MOVES[id]?.auraCost ?? 0) : 0;
      const dimmed = cost > 0 && this.playerActor.aura < cost;
      this.drawHudBtn(gfx, this.moveBtnW, this.moveBtnH, this.moveBtnThemes[i], i === this.menuCursor, dimmed);
    });
    this.moveBtnTexts.forEach((t, i) => {
      const id     = this.menuCommandIds[i];
      const cost   = (id !== BACK_COMMAND) ? (CLASSIC_MOVES[id]?.auraCost ?? 0) : 0;
      const dimmed = cost > 0 && this.playerActor.aura < cost;
      t.setColor(dimmed ? '#444455' : i === this.menuCursor ? '#ffffff' : '#667788');
    });
  }

  // ── HUD panel transitions ──────────────────────────────────────────────────

  private showMenu(): void {
    this.menuVisible = true;
    this.domHud.showMenu();
  }

  private hideMenu(): void {
    this.menuVisible = false;
    this.domHud.hideMenu();
  }

  private showMainPanel(): void {
    this.domHud.showMainPanel();
  }

  private showMovesPanel(): void {
    this.domHud.showMovesPanel(this.menuCommandIds, this.playerActor.aura, this.playerActor.usedGuardLastTurn);
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
    const hpRatio     = this.enemyActor.hp / this.enemyActor.maxHp;
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
    const bx     = w / 2 - 180;
    const by     = h / 2 - 55;
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
    const bx = w / 2 - 180;
    const by = h / 2 - 55;

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

  private showPlaceholderOverlay(title: string, body: string): void {
    this.showInfoOverlay(title, body);
  }

  // ── Damage / block display ─────────────────────────────────────────────────

  private onDamageDealt(
    target: ClassicActorRole, amount: number, blocked: boolean, wx: number, wy: number,
  ): void {
    const actor       = target === 'player' ? this.playerActor : this.enemyActor;
    const defenderSys = target === 'player' ? this.playerSyncSys : this.enemySyncSys;
    const attackerSys = target === 'player' ? this.enemySyncSys  : this.playerSyncSys;

    if (blocked) {
      defenderSys.onGuardSuccess();
      this.spawnBlockedDisplay(wx, wy, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.guardBlock);
    } else {
      const { isCrit, typeAdvantage, typeModifier } = this.lastHitMeta;
      if (isCrit) defenderSys.onTakeCrit();
      const effectMsg = getEffectivenessMessage(typeModifier);
      if (effectMsg) this.showBattleCallout(effectMsg, typeAdvantage ? '#ffaa22' : '#88aaff');
      this.spawnDamageNumber(wx, wy, amount, isCrit, typeAdvantage);
      this.audio.playSfx(AUDIO_KEYS.sfx.attackHit);
      this.audio.playSfx(AUDIO_KEYS.sfx.hurtImpact, 0.6);
      this.audio.playCreatureHurt(actor.actorId);
    }

    void attackerSys; // referenced by onHitMeta callback; declared here for symmetry
  }

  /** Returns a snapshot of all data the battle HUD needs to display. */
  getHUDData(): BattleHUDData {
    const profile     = this.registry.get('player_profile') as PlayerProfile | null;
    const playerMinId = this.battleCtx?.playerMinariId ?? 'flarepaw';
    const enemyMinId  = this.battleCtx?.enemyMinariId  ?? 'droplet';
    const playerData  = MINARI_ROSTER[playerMinId]  ?? MINARI_ROSTER['flarepaw'];
    const enemyData   = MINARI_ROSTER[enemyMinId]   ?? MINARI_ROSTER['droplet'];
    const playerBondLv = profile?.bonds[playerMinId]?.bondLevel ?? 1;
    const soulRank    = profile?.soulRank;
    const playerSync  = this.playerSyncSys.getState();
    const enemySync   = this.enemySyncSys.getState();

    return {
      playerMonariId:      playerMinId,
      playerMonariName:    playerData.name,
      playerHp:            this.playerActor.hp,
      playerMaxHp:         this.playerActor.maxHp,
      playerAura:          this.playerActor.aura,
      playerMaxAura:       this.playerActor.maxAura,
      playerSync:          playerSync.sync,
      playerSyncTier:      playerSync.tier,
      playerBondLevel:     playerBondLv,
      bonderSoulRankLevel: soulRank?.level ?? 1,
      bonderSoulRankTier:  (soulRank?.tier ?? 'novice') as SoulRankTier,
      enemyMonariId:       enemyMinId,
      enemyMonariName:     enemyData.name,
      enemyHp:             this.enemyActor.hp,
      enemyMaxHp:          this.enemyActor.maxHp,
      enemyAura:           this.enemyActor.aura,
      enemyMaxAura:        this.enemyActor.maxAura,
      enemySync:           enemySync.sync,
      enemySyncTier:       enemySync.tier,
    };
  }

  private spawnDamageNumber(
    wx: number, wy: number, amount: number,
    isCrit = false, typeAdvantage = false,
  ): void {
    const mob   = IS_TOUCH_DEVICE;
    const color = isCrit ? '#ff4466' : typeAdvantage ? '#ffaa22' : '#ffdd44';
    const size  = isCrit ? (mob ? '36px' : '28px') : (mob ? '30px' : '22px');
    const label = isCrit ? `★ ${amount}!` : `-${amount}`;
    const txt   = this.add.text(wx, wy, label, {
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
    this.domHud.hide();
    this.menuVisible = false;

    const { width: w, height: h } = this.scale;
    const mob    = IS_TOUCH_DEVICE;
    const isWin  = winner === 'player';
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

    if (ctx?.labMode) {
      this.add.text(w / 2, h / 2 + 110, 'R — Try Again  |  ESC — Back to Lab Setup', {
        fontSize: mob ? '14px' : '12px', color: '#7788aa', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(61);
    }

    this.time.delayedCall(600, () => {
      const goBack = (): void => {
        this.input.off('pointerup', goBack);
        this.input.keyboard!.off('keydown-ENTER', goBack);
        if (ctx?.labMode) {
          this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
            if (p === 1) this.scene.start('BattleLabSetupScene');
          });
        } else if (ctx?.returnMap) {
          this.registry.set('classic_current_map', ctx.returnMap);
          this.registry.set('classic_spawn_name',  ctx.returnSpawn ?? 'default');
          this.registry.remove('classic_battle_context');
          this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
            if (p !== 1) return;
            const storyState = this.registry.get('story_state') as { mapId?: string; spawn?: string } | undefined;
            if (storyState) {
              this.registry.set('story_state', { ...storyState, mapId: ctx.returnMap, spawn: ctx.returnSpawn ?? 'south' });
              this.scene.start('StoryOverworldScene');
              return;
            }
            this.scene.start('ClassicOverworldScene');
          });
        } else {
          this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
            if (p === 1) this.scene.start('ModeSelectScene');
          });
        }
      };
      const tryAgain = (): void => {
        if (!ctx?.labMode) return;
        this.input.keyboard!.off('keydown-R', tryAgain);
        this.input.keyboard!.off('keydown-ESC', goBack);
        this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
          if (p === 1) this.scene.restart();
        });
      };
      this.input.keyboard!.once('keydown-ENTER', goBack);
      this.input.once('pointerup', goBack);
      if (ctx?.labMode) {
        this.input.keyboard!.once('keydown-R',   tryAgain);
        this.input.keyboard!.once('keydown-ESC', goBack);
      }
    });
  }
}
