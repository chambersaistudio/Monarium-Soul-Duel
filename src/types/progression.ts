/**
 * Progression types for MONARIUM: Soul Duel.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

// ── Rarity ────────────────────────────────────────────────────────────────────

export type MonariRarity =
  | 'common'      // ~50% encounter weight
  | 'uncommon'    // ~25%
  | 'rare'        // ~15%
  | 'super_rare'  // ~8%  — Soul Rank boosts encounter weight slightly
  | 'ultra_rare'  // ~1.5% — Soul Rank can double this at max rank
  | 'legendary'   // ~0.2% — story / event unlock
  | 'mythic';     // near-unobtainable

// ── Battle Archetype ──────────────────────────────────────────────────────────

export type BattleArchetype =
  | 'Physical Striker'
  | 'Physical Bruiser'
  | 'Special Striker'
  | 'Arcane Caster'
  | 'Shadow Assassin'
  | 'Bulky Guardian'
  | 'Support Controller'
  | 'Speedster';

// ── Soul Sync ─────────────────────────────────────────────────────────────────

/** Four tiers corresponding to sync value ranges 0–24 / 25–49 / 50–79 / 80–100. */
export type SoulSyncTier = 'locked_in' | 'stable' | 'shaken' | 'broken';

/** Per-Monari in-battle Soul Sync state. */
export interface SoulSyncState {
  monariId: string;
  sync:     number;        // 0–100
  tier:     SoulSyncTier;
}

// ── Soul Rank ─────────────────────────────────────────────────────────────────

export type SoulRankTier =
  | 'novice'       // rank  1–10
  | 'seeker'       // rank 11–25
  | 'adept'        // rank 26–40
  | 'bonded'       // rank 41–55
  | 'expert'       // rank 56–70
  | 'master'       // rank 71–85
  | 'soul_master'  // rank 86–95
  | 'true_soul';   // rank 96–100

/** Bonder's overall mastery level. */
export interface SoulRank {
  tier:             SoulRankTier;
  level:            number;   // 1–100 cumulative rank level
  points:           number;   // XP within the current rank level
  nextLevelPoints:  number;   // XP required to advance to next level
}

// ── Bond ──────────────────────────────────────────────────────────────────────

/** One entry per Monari the Bonder has formed a relationship with. */
export interface BondEntry {
  monariId:           string;
  bondLevel:          number;    // 1–10; never decreases
  bondXP:             number;    // current XP within this level
  bondXPToNext:       number;    // XP required to reach next Bond Level
  momentum:           number;    // 0–100 temporary streak multiplier
  momentumDecayBattles: number;  // battles since this Monari was last used
  isTrueSoulBond:     boolean;
  ascensionEligible:  boolean;
}

// ── Monari Level ──────────────────────────────────────────────────────────────

/** Per-Monari individual level and XP progress. */
export interface MonariLevelEntry {
  monariId:        string;
  level:           number;    // 1–100
  xp:              number;
  xpToNext:        number;
  evolutionStage:  0 | 1 | 2; // 0 = base, 1 = first evo, 2 = final form
}

// ── Player Profile ────────────────────────────────────────────────────────────

/**
 * Root player profile stored in Phaser registry as 'player_profile'.
 * The overworld writes this before launching a battle.
 * ClassicSoulDuelScene reads it for Soul Sync initialisation.
 */
export interface PlayerProfile {
  bonderName:   string;
  soulRank:     SoulRank;
  bonds:        Record<string, BondEntry>;
  monariLevels: Record<string, MonariLevelEntry>;
}

// ── Battle HUD Data ───────────────────────────────────────────────────────────

/**
 * Snapshot of all data the battle HUD needs to display.
 * ClassicSoulDuelScene.getHUDData() returns this.
 *
 * No Resolve bar, no Bonder HP bar, no Soul Strain display in normal battles.
 * See docs/gameplay/MONARIUM_GAME_MECHANICS.md §10 for Soul Strain rules.
 */
export interface BattleHUDData {
  // ── Player Monari ──
  playerMonariId:    string;
  playerMonariName:  string;
  playerHp:          number;
  playerMaxHp:       number;
  playerAura:        number;
  playerMaxAura:     number;
  playerSync:        number;        // 0–100
  playerSyncTier:    SoulSyncTier;
  playerBondLevel:   number;        // 1–10
  // ── Bonder ──
  bonderSoulRankLevel: number;      // 1–100 cumulative rank
  bonderSoulRankTier:  SoulRankTier;
  // ── Enemy Monari ──
  enemyMonariId:     string;
  enemyMonariName:   string;
  enemyHp:           number;
  enemyMaxHp:        number;
  enemyAura:         number;
  enemyMaxAura:      number;
  enemySync:         number;
  enemySyncTier:     SoulSyncTier;
}
