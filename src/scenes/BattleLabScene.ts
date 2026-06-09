/**
 * BattleLabScene — Debug / dev battle-formula sandbox for MONARIUM.
 * Pure calculation scene: no sprites, no animations.
 * Access via URL param ?scene=BattleLabScene or keyboard shortcut from ModeSelectScene.
 *
 * Keyboard navigation:
 *   TAB           — cycle focus between Attacker / Defender / Move panels
 *   ← / →         — change selected Monari or cycle through moves
 *   ↑ / ↓         — change level (+1 / −1)
 *   + / -         — same as ↑ / ↓ for level
 *   ENTER / SPACE — recalculate (also fires automatically on any value change)
 *   R             — run 10 random trials
 *   ESC           — back to ModeSelectScene
 */

import Phaser from 'phaser';
import { CombatFormulaSystem } from '../systems/CombatFormulaSystem';
import { BattleCalculator } from '../systems/BattleCalculator';
import { MONARI_DEX } from '../data/monariDex';
import { MINARI_ROSTER } from '../data/minariData';
import { CLASSIC_MOVES } from '../data/classicMoveData';
import { getElementModifier, getEffectivenessMessage, getEffectivenessBattleLabLabel } from '../config/elementEffectivenessConfig';
import { UI_THEME, elementColor } from '../config/uiTheme';
import { IS_TOUCH_DEVICE } from '../config/mobileConfig';
import { drawGlassPanel } from '../ui/phaserUi';
import { SYNC_DAMAGE_MODIFIERS, DAMAGE_FORMULA } from '../config/combatFormulaConfig';
import type { SoulSyncTier } from '../types/progression';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONARI_IDS = ['flarepaw', 'droplet', 'umbravine', 'sproutodon', 'umbrelette', 'uvee'] as const;
type MonariId = typeof MONARI_IDS[number];

const MOVE_IDS = [
  'basic_attack',
  'flame_paw_barrage',
  'ember_shot',
  'heat_guard',
  'blinding_flare',
  'aqua_ripple',
  'crystal_knuckle',
  'shell_guard',
  'tidal_feint',
  'vine_snap',
  'root_pulse',
  'bark_guard',
  'pollen_haze',
  'shadow_coil',
  'guard',
] as const;
type MoveId = typeof MOVE_IDS[number];

const SYNC_TIERS: SoulSyncTier[] = ['locked_in', 'stable', 'shaken', 'broken'];

const SYNC_TIER_LABELS: Record<SoulSyncTier, string> = {
  locked_in: 'Locked In',
  stable:    'Stable',
  shaken:    'Shaken',
  broken:    'Broken',
};

/** Fallback move data — only used if a move ID isn't in CLASSIC_MOVES. */
const FALLBACK_MOVES: Record<string, {
  displayName: string;
  power: number;
  damageType: string;
  category: 'physical' | 'special' | 'status';
  canCrit: boolean;
  auraCost?: number;
  accuracy?: number;
}> = {}; // All moves now live in CLASSIC_MOVES

type FocusPanel = 'attacker' | 'defender' | 'move';

// ── Layout constants ──────────────────────────────────────────────────────────

const FONT_MONO = 'monospace';
const FONT_TINY   = { fontSize: '11px', fontFamily: FONT_MONO, color: UI_THEME.colors.textMuted } as const;
const FONT_SM     = { fontSize: '12px', fontFamily: FONT_MONO, color: UI_THEME.colors.textDim  } as const;
const FONT_MD     = { fontSize: '13px', fontFamily: FONT_MONO, color: UI_THEME.colors.text     } as const;
const FONT_LG     = { fontSize: '16px', fontFamily: FONT_MONO, color: UI_THEME.colors.text     } as const;
const FONT_TITLE  = { fontSize: '22px', fontFamily: FONT_MONO, color: '#ff8c00', fontStyle: 'bold' } as const;
const FONT_SUB    = { fontSize: '13px', fontFamily: FONT_MONO, color: '#cc6600' } as const;
const FONT_ORANGE = { fontSize: '13px', fontFamily: FONT_MONO, color: '#ff8c00' } as const;
const FONT_GREEN  = { fontSize: '12px', fontFamily: FONT_MONO, color: '#3be071' } as const;
const FONT_RED    = { fontSize: '12px', fontFamily: FONT_MONO, color: '#ff4e5f' } as const;
const FONT_GOLD   = { fontSize: '13px', fontFamily: FONT_MONO, color: '#ffd76a' } as const;

// ── Scene ─────────────────────────────────────────────────────────────────────

export class BattleLabScene extends Phaser.Scene {

  // ── State ──────────────────────────────────────────────────────────────────

  private attackerIdx   = 0;
  private defenderIdx   = 1;
  private moveIdx       = 0;
  private attackerLevel = 7;
  private defenderLevel = 7;
  private bondLevel     = 5;
  private syncTierIdx   = 1;  // index into SYNC_TIERS (default: stable)
  private defenderGuard = false;
  private focus: FocusPanel = 'attacker';

  // ── Keyboard ───────────────────────────────────────────────────────────────

  private keyLeft!:   Phaser.Input.Keyboard.Key;
  private keyRight!:  Phaser.Input.Keyboard.Key;
  private keyUp!:     Phaser.Input.Keyboard.Key;
  private keyDown!:   Phaser.Input.Keyboard.Key;
  private keyEnter!:  Phaser.Input.Keyboard.Key;
  private keySpace!:  Phaser.Input.Keyboard.Key;
  private keyTab!:    Phaser.Input.Keyboard.Key;
  private keyR!:      Phaser.Input.Keyboard.Key;
  private keyEsc!:    Phaser.Input.Keyboard.Key;
  private keyPlus!:   Phaser.Input.Keyboard.Key;
  private keyMinus!:  Phaser.Input.Keyboard.Key;
  private keyG!:      Phaser.Input.Keyboard.Key;

  // ── UI objects ─────────────────────────────────────────────────────────────

  private graphics!:  Phaser.GameObjects.Graphics;

  // Attacker panel
  private atkMonariTxt!:  Phaser.GameObjects.Text;
  private atkLevelTxt!:   Phaser.GameObjects.Text;
  private atkBondTxt!:    Phaser.GameObjects.Text;
  private atkSyncTxt!:    Phaser.GameObjects.Text;
  private atkStatsTxt!:   Phaser.GameObjects.Text;
  private atkElemTxt!:    Phaser.GameObjects.Text;
  private atkFocusTxt!:   Phaser.GameObjects.Text;

  // Defender panel
  private defMonariTxt!:  Phaser.GameObjects.Text;
  private defLevelTxt!:   Phaser.GameObjects.Text;
  private defGuardTxt!:   Phaser.GameObjects.Text;
  private defStatsTxt!:   Phaser.GameObjects.Text;
  private defElemTxt!:    Phaser.GameObjects.Text;
  private defFocusTxt!:   Phaser.GameObjects.Text;

  // Move panel
  private moveTxt!:       Phaser.GameObjects.Text;
  private movePowerTxt!:  Phaser.GameObjects.Text;
  private moveTypeTxt!:   Phaser.GameObjects.Text;
  private moveCatTxt!:    Phaser.GameObjects.Text;
  private moveAuraTxt!:   Phaser.GameObjects.Text;
  private moveAccTxt!:    Phaser.GameObjects.Text;
  private moveFocusTxt!:  Phaser.GameObjects.Text;

  // Output panel
  private effectTxt!:     Phaser.GameObjects.Text;
  private rangeTxt!:      Phaser.GameObjects.Text;
  private guardModTxt!:   Phaser.GameObjects.Text;
  private syncModTxt!:    Phaser.GameObjects.Text;
  private turnsTxt!:      Phaser.GameObjects.Text;
  private trialOutputTxt!: Phaser.GameObjects.Text;
  private outputHeaderTxt!: Phaser.GameObjects.Text;

  // Bottom bar
  private statusTxt!:     Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BattleLabScene' });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    const { width: W, height: H } = this.scale;

    // ── Background ───────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x08080e, 0x08080e, 0x0c0c1a, 0x0c0c1a, 1);
    bg.fillRect(0, 0, W, H);
    bg.setDepth(0);

    // ── Graphics layer for panels ────────────────────────────────────────────
    this.graphics = this.add.graphics().setDepth(1);

    // ── Title bar ────────────────────────────────────────────────────────────
    this.add.text(W / 2, 22, 'BATTLE LAB', { ...FONT_TITLE }).setOrigin(0.5, 0.5).setDepth(5);
    this.add.text(W / 2, 42, 'Formula Test Arena', { ...FONT_SUB }).setOrigin(0.5, 0.5).setDepth(5);

    // ── Layout math ──────────────────────────────────────────────────────────
    const TOP    = 60;
    const BOT    = H - 28;
    const INNER  = BOT - TOP;
    const PAD    = 10;

    // Three column layout: [attacker | output | defender]
    const COL_ATK_X = PAD;
    const COL_ATK_W = Math.floor(W * 0.265);
    const COL_OUT_X = COL_ATK_X + COL_ATK_W + PAD;
    const COL_OUT_W = Math.floor(W * 0.44);
    const COL_DEF_X = COL_OUT_X + COL_OUT_W + PAD;
    const COL_DEF_W = W - COL_DEF_X - PAD;

    // Panel heights
    const PANEL_H    = Math.floor(INNER * 0.70);  // config panels
    const MOVE_H     = Math.floor(INNER * 0.25);  // move panel below attacker
    const TRIAL_H    = Math.floor(INNER * 0.25);  // trial output below output

    // Y positions
    const ROW1_Y = TOP + 4;
    const MOVE_Y = ROW1_Y + PANEL_H + PAD;
    const OUT_H  = PANEL_H;
    const TRIAL_Y = ROW1_Y + OUT_H + PAD;

    // ── Draw panels ───────────────────────────────────────────────────────────
    this.drawAllPanels(
      COL_ATK_X, ROW1_Y, COL_ATK_W, PANEL_H,
      COL_ATK_X, MOVE_Y,  COL_ATK_W, MOVE_H,
      COL_DEF_X, ROW1_Y, COL_DEF_W, PANEL_H,
      COL_OUT_X, ROW1_Y, COL_OUT_W, OUT_H,
      COL_OUT_X, TRIAL_Y, COL_OUT_W, TRIAL_H,
    );

    // ── Attacker panel labels ─────────────────────────────────────────────────
    const AL = COL_ATK_X + PAD + 4;
    const AY = ROW1_Y + PAD + 4;
    const LS = 18; // line spacing

    this.add.text(AL, AY, 'ATTACKER', { ...FONT_ORANGE }).setDepth(5);
    this.atkFocusTxt = this.add.text(COL_ATK_X + COL_ATK_W - PAD - 4, AY, '', { ...FONT_SM }).setOrigin(1, 0).setDepth(5);

    this.add.text(AL, AY + LS + 4, 'Monari:', { ...FONT_TINY }).setDepth(5);
    this.atkMonariTxt = this.add.text(AL, AY + LS * 2 + 2, '', { ...FONT_GOLD }).setDepth(5);

    this.add.text(AL, AY + LS * 3 + 6, 'Level:', { ...FONT_TINY }).setDepth(5);
    this.atkLevelTxt = this.add.text(AL, AY + LS * 4 + 4, '', { ...FONT_MD }).setDepth(5);

    this.add.text(AL, AY + LS * 5 + 8, 'Element:', { ...FONT_TINY }).setDepth(5);
    this.atkElemTxt = this.add.text(AL, AY + LS * 6 + 6, '', { fontSize: '12px', fontFamily: FONT_MONO, color: '#ffffff' }).setDepth(5);

    this.add.text(AL, AY + LS * 7 + 10, 'Bond Lv:', { ...FONT_TINY }).setDepth(5);
    this.atkBondTxt = this.add.text(AL, AY + LS * 8 + 8, '', { ...FONT_MD }).setDepth(5);

    this.add.text(AL, AY + LS * 9 + 12, 'Sync Tier:', { ...FONT_TINY }).setDepth(5);
    this.atkSyncTxt = this.add.text(AL, AY + LS * 10 + 10, '', { ...FONT_MD }).setDepth(5);

    this.add.text(AL, AY + LS * 11 + 16, 'Stats:', { ...FONT_TINY }).setDepth(5);
    this.atkStatsTxt = this.add.text(AL, AY + LS * 12 + 14, '', { ...FONT_TINY, color: UI_THEME.colors.textDim }).setDepth(5);

    // ── Move panel labels ─────────────────────────────────────────────────────
    const ML = COL_ATK_X + PAD + 4;
    const MY = MOVE_Y + PAD + 4;

    this.add.text(ML, MY, 'MOVE', { ...FONT_ORANGE }).setDepth(5);
    this.moveFocusTxt = this.add.text(COL_ATK_X + COL_ATK_W - PAD - 4, MY, '', { ...FONT_SM }).setOrigin(1, 0).setDepth(5);

    this.add.text(ML, MY + LS + 4, 'Name:', { ...FONT_TINY }).setDepth(5);
    this.moveTxt = this.add.text(ML, MY + LS * 2 + 2, '', { ...FONT_GOLD }).setDepth(5);

    this.add.text(ML, MY + LS * 3 + 6, 'Power:', { ...FONT_TINY }).setDepth(5);
    this.movePowerTxt = this.add.text(ML, MY + LS * 4 + 4, '', { ...FONT_MD }).setDepth(5);

    this.add.text(ML, MY + LS * 5 + 8, 'Type / Category:', { ...FONT_TINY }).setDepth(5);
    this.moveTypeTxt = this.add.text(ML, MY + LS * 6 + 6, '', { ...FONT_MD }).setDepth(5);
    this.moveCatTxt  = this.add.text(ML, MY + LS * 7 + 4, '', { ...FONT_SM }).setDepth(5);

    this.add.text(ML, MY + LS * 8 + 8, 'Aura Cost / Accuracy:', { ...FONT_TINY }).setDepth(5);
    this.moveAuraTxt = this.add.text(ML, MY + LS * 9 + 6, '', { ...FONT_MD }).setDepth(5);
    this.moveAccTxt  = this.add.text(ML + 60, MY + LS * 9 + 6, '', { ...FONT_SM }).setDepth(5);

    // ── Defender panel labels ─────────────────────────────────────────────────
    const DL = COL_DEF_X + PAD + 4;
    const DY = ROW1_Y + PAD + 4;

    this.add.text(DL, DY, 'DEFENDER', { ...FONT_ORANGE }).setDepth(5);
    this.defFocusTxt = this.add.text(COL_DEF_X + COL_DEF_W - PAD - 4, DY, '', { ...FONT_SM }).setOrigin(1, 0).setDepth(5);

    this.add.text(DL, DY + LS + 4, 'Monari:', { ...FONT_TINY }).setDepth(5);
    this.defMonariTxt = this.add.text(DL, DY + LS * 2 + 2, '', { ...FONT_GOLD }).setDepth(5);

    this.add.text(DL, DY + LS * 3 + 6, 'Level:', { ...FONT_TINY }).setDepth(5);
    this.defLevelTxt = this.add.text(DL, DY + LS * 4 + 4, '', { ...FONT_MD }).setDepth(5);

    this.add.text(DL, DY + LS * 5 + 8, 'Element:', { ...FONT_TINY }).setDepth(5);
    this.defElemTxt = this.add.text(DL, DY + LS * 6 + 6, '', { fontSize: '12px', fontFamily: FONT_MONO, color: '#ffffff' }).setDepth(5);

    this.add.text(DL, DY + LS * 7 + 10, 'Guarding:', { ...FONT_TINY }).setDepth(5);
    this.defGuardTxt = this.add.text(DL, DY + LS * 8 + 8, '', { ...FONT_MD }).setDepth(5);

    this.add.text(DL, DY + LS * 9 + 12, 'Stats:', { ...FONT_TINY }).setDepth(5);
    this.defStatsTxt = this.add.text(DL, DY + LS * 10 + 10, '', { ...FONT_TINY, color: UI_THEME.colors.textDim }).setDepth(5);

    // ── Output panel labels ────────────────────────────────────────────────────
    const OL = COL_OUT_X + PAD + 4;
    const OY = ROW1_Y + PAD + 4;
    const OLS = 20;

    this.outputHeaderTxt = this.add.text(OL, OY, 'RESULTS', { ...FONT_ORANGE }).setDepth(5);

    this.add.text(OL, OY + OLS + 2, 'Type Effectiveness:', { ...FONT_TINY }).setDepth(5);
    this.effectTxt = this.add.text(OL, OY + OLS * 2, '', { ...FONT_LG }).setDepth(5);

    this.add.text(OL, OY + OLS * 3 + 2, 'Damage Range:', { ...FONT_TINY }).setDepth(5);
    this.rangeTxt  = this.add.text(OL, OY + OLS * 4, '', { ...FONT_LG }).setDepth(5);

    this.add.text(OL, OY + OLS * 5 + 2, 'Guard Modifier:', { ...FONT_TINY }).setDepth(5);
    this.guardModTxt = this.add.text(OL, OY + OLS * 6, '', { ...FONT_MD }).setDepth(5);

    this.add.text(OL, OY + OLS * 7 + 2, 'Sync Modifier:', { ...FONT_TINY }).setDepth(5);
    this.syncModTxt = this.add.text(OL, OY + OLS * 8, '', { ...FONT_MD }).setDepth(5);

    this.add.text(OL, OY + OLS * 9 + 2, 'Turns to KO (avg damage):', { ...FONT_TINY }).setDepth(5);
    this.turnsTxt   = this.add.text(OL, OY + OLS * 10, '', { ...FONT_LG }).setDepth(5);

    // ── Trial output panel ────────────────────────────────────────────────────
    const TL = COL_OUT_X + PAD + 4;
    const TY = TRIAL_Y + PAD + 4;

    this.add.text(TL, TY, 'TRIALS  ( R = run 10 trials )', { ...FONT_ORANGE }).setDepth(5);
    this.trialOutputTxt = this.add.text(TL, TY + LS + 4, 'No trials run yet.', { ...FONT_TINY, color: UI_THEME.colors.textMuted }).setDepth(5);

    // ── Bottom bar ────────────────────────────────────────────────────────────
    this.statusTxt = this.add.text(W / 2, H - 10,
      'ENTER/SPACE = calculate  |  TAB = focus  |  ←/→ = select  |  ↑/↓ = level  |  G = guard  |  R = 10 trials  |  ESC = back',
      { fontSize: '10px', fontFamily: FONT_MONO, color: '#555577' },
    ).setOrigin(0.5, 1).setDepth(5);

    // ── Clickable buttons ─────────────────────────────────────────────────────
    this.buildClickZones(COL_ATK_X, ROW1_Y, COL_ATK_W, PANEL_H,
                         COL_ATK_X, MOVE_Y,  COL_ATK_W, MOVE_H,
                         COL_DEF_X, ROW1_Y, COL_DEF_W, PANEL_H);

    // ── Keyboard bindings ─────────────────────────────────────────────────────
    const kb = this.input.keyboard!;
    this.keyLeft  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyTab   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyR     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyEsc   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyPlus  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    this.keyMinus = kb.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
    this.keyG     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.G);

    this.keyEsc.on('down', () => this.goBack());

    // ── Initial render ────────────────────────────────────────────────────────
    this.refreshAll();
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  update(): void {
    const left  = Phaser.Input.Keyboard.JustDown(this.keyLeft);
    const right = Phaser.Input.Keyboard.JustDown(this.keyRight);
    const up    = Phaser.Input.Keyboard.JustDown(this.keyUp);
    const down  = Phaser.Input.Keyboard.JustDown(this.keyDown);
    const enter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
    const space = Phaser.Input.Keyboard.JustDown(this.keySpace);
    const tab   = Phaser.Input.Keyboard.JustDown(this.keyTab);
    const rKey  = Phaser.Input.Keyboard.JustDown(this.keyR);
    const plus  = Phaser.Input.Keyboard.JustDown(this.keyPlus);
    const minus = Phaser.Input.Keyboard.JustDown(this.keyMinus);
    const gKey  = Phaser.Input.Keyboard.JustDown(this.keyG);

    let dirty = false;

    // TAB — cycle focus
    if (tab) {
      const order: FocusPanel[] = ['attacker', 'move', 'defender'];
      const idx = order.indexOf(this.focus);
      this.focus = order[(idx + 1) % order.length];
      dirty = true;
    }

    // G — toggle defender guard
    if (gKey) {
      this.defenderGuard = !this.defenderGuard;
      dirty = true;
    }

    // ← / → — cycle selection in focused panel
    if (left || right) {
      const delta = left ? -1 : 1;
      if (this.focus === 'attacker') {
        this.attackerIdx = this.wrapIdx(this.attackerIdx + delta, MONARI_IDS.length);
      } else if (this.focus === 'defender') {
        this.defenderIdx = this.wrapIdx(this.defenderIdx + delta, MONARI_IDS.length);
      } else if (this.focus === 'move') {
        this.moveIdx = this.wrapIdx(this.moveIdx + delta, MOVE_IDS.length);
      }
      dirty = true;
    }

    // ↑ / ↓ and + / - — change level in focused panel
    if (up || plus) {
      if (this.focus === 'attacker') {
        this.attackerLevel = Math.min(50, this.attackerLevel + 1);
      } else if (this.focus === 'defender') {
        this.defenderLevel = Math.min(50, this.defenderLevel + 1);
      } else if (this.focus === 'move') {
        // ↑ in move panel increases bond level
        this.bondLevel = Math.min(10, this.bondLevel + 1);
      }
      dirty = true;
    }
    if (down || minus) {
      if (this.focus === 'attacker') {
        this.attackerLevel = Math.max(1, this.attackerLevel - 1);
      } else if (this.focus === 'defender') {
        this.defenderLevel = Math.max(1, this.defenderLevel - 1);
      } else if (this.focus === 'move') {
        // ↓ in move panel cycles sync tier
        this.syncTierIdx = this.wrapIdx(this.syncTierIdx + 1, SYNC_TIERS.length);
      }
      dirty = true;
    }

    // ENTER / SPACE — explicit recalc
    if (enter || space) {
      dirty = true;
    }

    // R — run 10 trials
    if (rKey) {
      this.runTrials();
    }

    if (dirty) {
      this.refreshAll();
    }
  }

  // ── Core calculation ───────────────────────────────────────────────────────

  private refreshAll(): void {
    const atkId  = MONARI_IDS[this.attackerIdx];
    const defId  = MONARI_IDS[this.defenderIdx];
    const moveId = MOVE_IDS[this.moveIdx];
    const syncTier = SYNC_TIERS[this.syncTierIdx];

    const atkDex     = MONARI_DEX[atkId];
    const defDex     = MONARI_DEX[defId];
    const atkRoster  = MINARI_ROSTER[atkId];
    const defRoster  = MINARI_ROSTER[defId];

    const atkElement = atkRoster?.element ?? 'neutral';
    const defElement = defRoster?.element ?? 'neutral';

    const atkStats = CombatFormulaSystem.calcBattleStats(atkDex?.baseStats, this.attackerLevel);
    const defStats = CombatFormulaSystem.calcBattleStats(defDex?.baseStats, this.defenderLevel);

    const move = this.resolveMove(moveId);
    const syncModifier = SYNC_DAMAGE_MODIFIERS[syncTier] ?? 1.0;
    const typeModifier = getElementModifier(move.damageType, defElement);
    const effectMsg    = getEffectivenessMessage(typeModifier);
    const effLabel     = getEffectivenessBattleLabLabel(typeModifier);

    // ── Focus indicators ──────────────────────────────────────────────────────
    this.atkFocusTxt.setText(this.focus === 'attacker' ? '[ FOCUSED ]' : '').setColor('#ff8c00');
    this.defFocusTxt.setText(this.focus === 'defender' ? '[ FOCUSED ]' : '').setColor('#ff8c00');
    this.moveFocusTxt.setText(this.focus === 'move' ? '[ FOCUSED ]' : '').setColor('#ff8c00');

    // ── Attacker panel ────────────────────────────────────────────────────────
    this.atkMonariTxt.setText(`${atkId.toUpperCase()}  ← ${this.attackerIdx + 1}/${MONARI_IDS.length} →`);
    this.atkLevelTxt.setText(`Lv. ${this.attackerLevel}   ↑/↓ to change`);
    this.atkElemTxt.setText(atkElement.toUpperCase()).setColor(
      '#' + elementColor(atkElement).toString(16).padStart(6, '0'),
    );
    this.atkBondTxt.setText(`${this.bondLevel}  (↑/↓ in MOVE focus)`);
    this.atkSyncTxt.setText(`${SYNC_TIER_LABELS[syncTier]}  (↓ in MOVE focus)`)
      .setColor(this.syncTierColor(syncTier));
    this.atkStatsTxt.setText(
      `HP:${atkStats.maxHp}  Aura:${atkStats.maxAura}\n` +
      `ATK:${atkStats.attack}  SPATK:${atkStats.specialAttack}\n` +
      `DEF:${atkStats.defense}  SPDEF:${atkStats.specialDefense}  SPD:${atkStats.speed}`,
    );

    // ── Move panel ────────────────────────────────────────────────────────────
    this.moveTxt.setText(`${move.displayName}  ← ${this.moveIdx + 1}/${MOVE_IDS.length} →`);
    this.movePowerTxt.setText(move.power > 0 ? `${move.power}` : '— (Status)');
    this.moveTypeTxt.setText(move.damageType.toUpperCase()).setColor(
      '#' + elementColor(move.damageType).toString(16).padStart(6, '0'),
    );
    this.moveCatTxt.setText(move.category.toUpperCase());
    this.moveAuraTxt.setText(move.auraCost != null ? `${move.auraCost} aura` : 'Free');
    this.moveAccTxt.setText(`Acc: ${move.accuracy ?? 100}%`);

    // ── Defender panel ────────────────────────────────────────────────────────
    this.defMonariTxt.setText(`${defId.toUpperCase()}  ← ${this.defenderIdx + 1}/${MONARI_IDS.length} →`);
    this.defLevelTxt.setText(`Lv. ${this.defenderLevel}   ↑/↓ to change`);
    this.defElemTxt.setText(defElement.toUpperCase()).setColor(
      '#' + elementColor(defElement).toString(16).padStart(6, '0'),
    );
    this.defGuardTxt.setText(this.defenderGuard ? 'YES  (G to toggle)' : 'NO   (G to toggle)')
      .setColor(this.defenderGuard ? '#3be071' : '#ff4e5f');
    this.defStatsTxt.setText(
      `HP:${defStats.maxHp}  Aura:${defStats.maxAura}\n` +
      `ATK:${defStats.attack}  SPATK:${defStats.specialAttack}\n` +
      `DEF:${defStats.defense}  SPDEF:${defStats.specialDefense}  SPD:${defStats.speed}`,
    );

    // ── Output panel ──────────────────────────────────────────────────────────
    if (move.category === 'status' || move.power <= 0) {
      // Status move — no damage
      const statusEffColor = typeModifier > 1 ? '#3be071' : typeModifier < 1 ? '#ff4e5f' : '#ffd76a';
      this.effectTxt.setText(`${move.damageType.toUpperCase()} → ${defElement.toUpperCase()}:  ${effLabel}`).setColor(statusEffColor);
      this.rangeTxt.setText('— (Status move, no damage)').setColor(UI_THEME.colors.textMuted);
      this.guardModTxt.setText('N/A').setColor(UI_THEME.colors.textMuted);
      this.syncModTxt.setText(`×${syncModifier.toFixed(2)}  (${SYNC_TIER_LABELS[syncTier]})`);
      this.turnsTxt.setText('N/A').setColor(UI_THEME.colors.textMuted);
    } else {
      // Damage move — full calculation
      const critBonus = syncTier === 'locked_in' ? 0.10 : 0;

      const rangeResult = BattleCalculator.calcRange({
        attackerStats:    atkStats,
        defenderStats:    defStats,
        moveElement:      move.damageType,
        defenderElement:  defElement,
        movePower:        move.power,
        moveCategory:     move.category,
        canCrit:          move.canCrit,
        attackerSyncTier: syncTier,
        defenderGuarding: this.defenderGuard,
        critBonus,
      });

      // Type effectiveness color
      const typeHex = typeModifier > 1 ? '#3be071' : typeModifier < 1 ? '#ff4e5f' : '#ffd76a';
      this.effectTxt
        .setText(`${move.damageType.toUpperCase()} → ${defElement.toUpperCase()}:  ${effLabel}`)
        .setColor(typeHex);

      // Damage range
      this.rangeTxt.setText(
        `Min:${rangeResult.min}  Avg:${rangeResult.avg}  Max:${rangeResult.max}\n` +
        `Crit Min:${rangeResult.critMin}  Crit Max:${rangeResult.critMax}`,
      ).setColor(UI_THEME.colors.text);

      // Guard modifier
      if (this.defenderGuard) {
        this.guardModTxt.setText(`×${DAMAGE_FORMULA.GUARD_MODIFIER.toFixed(2)}  (Guarding)`).setColor('#3be071');
      } else {
        this.guardModTxt.setText('×1.00  (Not guarding)').setColor(UI_THEME.colors.textDim);
      }

      // Sync modifier
      const syncColor = syncTier === 'locked_in' ? '#3be071' : syncTier === 'broken' ? '#ff4e5f' : '#ffd76a';
      this.syncModTxt.setText(`×${syncModifier.toFixed(2)}  (${SYNC_TIER_LABELS[syncTier]})`).setColor(syncColor);

      // Turns to KO estimate
      const avgDmg = rangeResult.avg;
      const defHp  = defStats.maxHp;
      if (avgDmg > 0) {
        const turns = Math.ceil(defHp / avgDmg);
        this.turnsTxt.setText(`~${turns} turn${turns === 1 ? '' : 's'}  (${defHp} HP ÷ ${avgDmg} avg dmg)`).setColor('#ffd76a');
      } else {
        this.turnsTxt.setText('∞ (zero damage)').setColor('#ff4e5f');
      }
    }

    // ── Refresh panel borders to show focus highlight ─────────────────────────
    this.graphics.clear();
    // (panels are already drawn at create() with static graphics — we redraw them all each refresh)
    // Re-draw is cheap for a debug scene
    const { width: W, height: H } = this.scale;
    this.redrawPanels(W, H);
  }

  private runTrials(): void {
    const atkId  = MONARI_IDS[this.attackerIdx];
    const defId  = MONARI_IDS[this.defenderIdx];
    const moveId = MOVE_IDS[this.moveIdx];
    const syncTier = SYNC_TIERS[this.syncTierIdx];

    const atkDex    = MONARI_DEX[atkId];
    const defDex    = MONARI_DEX[defId];
    const atkRoster = MINARI_ROSTER[atkId];
    const defRoster = MINARI_ROSTER[defId];

    const defElement = defRoster?.element ?? 'neutral';
    const atkStats   = CombatFormulaSystem.calcBattleStats(atkDex?.baseStats, this.attackerLevel);
    const defStats   = CombatFormulaSystem.calcBattleStats(defDex?.baseStats, this.defenderLevel);
    const move       = this.resolveMove(moveId);
    const critBonus  = syncTier === 'locked_in' ? 0.10 : 0;

    if (move.category === 'status' || move.power <= 0) {
      this.trialOutputTxt.setText('Status move — no damage trials.').setColor(UI_THEME.colors.textMuted);
      return;
    }

    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = BattleCalculator.calculate({
        attackerStats:    atkStats,
        defenderStats:    defStats,
        moveElement:      move.damageType,
        defenderElement:  defElement,
        movePower:        move.power,
        moveCategory:     move.category,
        canCrit:          move.canCrit,
        attackerSyncTier: syncTier,
        defenderGuarding: this.defenderGuard,
        critBonus,
      });
      results.push(r.damage);
    }

    const totalDmg = results.reduce((a, b) => a + b, 0);
    const avgDmg   = totalDmg / results.length;
    const turnsEst = Math.ceil(defStats.maxHp / avgDmg);

    const lines: string[] = results.map((d, i) => `Trial ${i + 1}: ${d} dmg`);
    lines.push(`────────────────────────`);
    lines.push(`Avg: ${avgDmg.toFixed(1)}  |  Turns to KO: ~${turnsEst}`);

    this.trialOutputTxt.setText(lines.join('\n')).setColor(UI_THEME.colors.textDim);
  }

  // ── Panel drawing ──────────────────────────────────────────────────────────

  private drawAllPanels(
    ax: number, ay: number, aw: number, ah: number,
    mx: number, my: number, mw: number, mh: number,
    dx: number, dy: number, dw: number, dh: number,
    ox: number, oy: number, ow: number, oh: number,
    tx: number, ty: number, tw: number, th: number,
  ): void {
    const g = this.graphics;
    const atkStroke = UI_THEME.colors.stroke;

    drawGlassPanel(g, ax, ay, aw, ah, { stroke: atkStroke });
    drawGlassPanel(g, mx, my, mw, mh, { stroke: atkStroke });
    drawGlassPanel(g, dx, dy, dw, dh, { stroke: 0x5533aa });
    drawGlassPanel(g, ox, oy, ow, oh, { stroke: 0x336699, fill: UI_THEME.colors.panelDeep });
    drawGlassPanel(g, tx, ty, tw, th, { stroke: 0x335544, fill: UI_THEME.colors.panelDeep });
  }

  private redrawPanels(W: number, H: number): void {
    const PAD    = 10;
    const TOP    = 60;
    const BOT    = H - 28;
    const INNER  = BOT - TOP;

    const COL_ATK_X = PAD;
    const COL_ATK_W = Math.floor(W * 0.265);
    const COL_OUT_X = COL_ATK_X + COL_ATK_W + PAD;
    const COL_OUT_W = Math.floor(W * 0.44);
    const COL_DEF_X = COL_OUT_X + COL_OUT_W + PAD;
    const COL_DEF_W = W - COL_DEF_X - PAD;

    const PANEL_H = Math.floor(INNER * 0.70);
    const MOVE_H  = Math.floor(INNER * 0.25);

    const ROW1_Y  = TOP + 4;
    const MOVE_Y  = ROW1_Y + PANEL_H + PAD;
    const TRIAL_Y = ROW1_Y + PANEL_H + PAD;

    const g = this.graphics;
    g.clear();

    const atkStroke = this.focus === 'attacker' ? 0xffaa00 : UI_THEME.colors.stroke;
    const mStroke   = this.focus === 'move'     ? 0xffaa00 : UI_THEME.colors.stroke;
    const defStroke = this.focus === 'defender' ? 0xffaa00 : 0x5533aa;

    drawGlassPanel(g, COL_ATK_X, ROW1_Y, COL_ATK_W, PANEL_H, { stroke: atkStroke });
    drawGlassPanel(g, COL_ATK_X, MOVE_Y,  COL_ATK_W, MOVE_H,  { stroke: mStroke });
    drawGlassPanel(g, COL_DEF_X, ROW1_Y, COL_DEF_W, PANEL_H, { stroke: defStroke });
    drawGlassPanel(g, COL_OUT_X, ROW1_Y, COL_OUT_W, PANEL_H,  { stroke: 0x336699, fill: UI_THEME.colors.panelDeep });
    drawGlassPanel(g, COL_OUT_X, TRIAL_Y, COL_OUT_W, MOVE_H,  { stroke: 0x335544, fill: UI_THEME.colors.panelDeep });
  }

  // ── Clickable zones ────────────────────────────────────────────────────────

  private buildClickZones(
    ax: number, ay: number, aw: number, ah: number,
    mx: number, my: number, mw: number, mh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void {
    // Attacker panel click
    const atkZone = this.add.zone(ax, ay, aw, ah).setOrigin(0, 0).setInteractive().setDepth(10);
    atkZone.on('pointerdown', () => { this.focus = 'attacker'; this.refreshAll(); });

    // Move panel click
    const moveZone = this.add.zone(mx, my, mw, mh).setOrigin(0, 0).setInteractive().setDepth(10);
    moveZone.on('pointerdown', () => { this.focus = 'move'; this.refreshAll(); });

    // Defender panel click
    const defZone = this.add.zone(dx, dy, dw, dh).setOrigin(0, 0).setInteractive().setDepth(10);
    defZone.on('pointerdown', () => { this.focus = 'defender'; this.refreshAll(); });

    // Touch-friendly level up/down buttons on attacker panel
    if (IS_TOUCH_DEVICE) {
      this.buildTouchButtons(ax + aw - 44, ay + 70, 'atkLevel');
      this.buildTouchButtons(dx + dw - 44, dy + 70, 'defLevel');
    }
  }

  private buildTouchButtons(x: number, y: number, target: 'atkLevel' | 'defLevel'): void {
    const BTN_W = 36;
    const BTN_H = 26;

    const plusBg = this.add.graphics().setDepth(12);
    plusBg.fillStyle(0x333355, 0.9);
    plusBg.fillRoundedRect(x, y, BTN_W, BTN_H, 6);
    plusBg.lineStyle(1, 0x6655aa, 0.8);
    plusBg.strokeRoundedRect(x, y, BTN_W, BTN_H, 6);
    this.add.text(x + BTN_W / 2, y + BTN_H / 2, '+', { ...FONT_LG }).setOrigin(0.5).setDepth(13);
    const plusZone = this.add.zone(x, y, BTN_W, BTN_H).setOrigin(0, 0).setInteractive().setDepth(14);
    plusZone.on('pointerdown', () => {
      if (target === 'atkLevel') this.attackerLevel = Math.min(50, this.attackerLevel + 1);
      else                       this.defenderLevel = Math.min(50, this.defenderLevel + 1);
      this.refreshAll();
    });

    const minusBg = this.add.graphics().setDepth(12);
    minusBg.fillStyle(0x333355, 0.9);
    minusBg.fillRoundedRect(x, y + BTN_H + 4, BTN_W, BTN_H, 6);
    minusBg.lineStyle(1, 0x6655aa, 0.8);
    minusBg.strokeRoundedRect(x, y + BTN_H + 4, BTN_W, BTN_H, 6);
    this.add.text(x + BTN_W / 2, y + BTN_H + 4 + BTN_H / 2, '−', { ...FONT_LG }).setOrigin(0.5).setDepth(13);
    const minusZone = this.add.zone(x, y + BTN_H + 4, BTN_W, BTN_H).setOrigin(0, 0).setInteractive().setDepth(14);
    minusZone.on('pointerdown', () => {
      if (target === 'atkLevel') this.attackerLevel = Math.max(1, this.attackerLevel - 1);
      else                       this.defenderLevel = Math.max(1, this.defenderLevel - 1);
      this.refreshAll();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveMove(moveId: MoveId): {
    displayName: string;
    power: number;
    damageType: string;
    category: 'physical' | 'special' | 'status';
    canCrit: boolean;
    auraCost: number | undefined;
    accuracy: number;
  } {
    const classic = CLASSIC_MOVES[moveId];
    if (classic) {
      return {
        displayName: classic.displayName,
        power:       classic.power,
        damageType:  classic.damageType,
        category:    classic.category,
        canCrit:     classic.canCrit,
        auraCost:    classic.auraCost,
        accuracy:    classic.accuracy ?? 100,
      };
    }
    const fallback = FALLBACK_MOVES[moveId];
    if (fallback) {
      return {
        displayName: fallback.displayName,
        power:       fallback.power,
        damageType:  fallback.damageType,
        category:    fallback.category,
        canCrit:     fallback.canCrit,
        auraCost:    fallback.auraCost,
        accuracy:    fallback.accuracy ?? 100,
      };
    }
    // Unknown move ID — return safe defaults
    return {
      displayName: moveId,
      power:       0,
      damageType:  'physical',
      category:    'status',
      canCrit:     false,
      auraCost:    undefined,
      accuracy:    100,
    };
  }

  private syncTierColor(tier: SoulSyncTier): string {
    switch (tier) {
      case 'locked_in': return '#3be071';
      case 'stable':    return '#ffd76a';
      case 'shaken':    return '#ff8c00';
      case 'broken':    return '#ff4e5f';
    }
  }

  private wrapIdx(idx: number, len: number): number {
    return ((idx % len) + len) % len;
  }

  private goBack(): void {
    this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('ModeSelectScene');
    });
  }
}
