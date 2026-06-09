/**
 * Monari progression metadata: base stats (for formula), level scaling,
 * evolution info, and encounter rarity weights.
 * Combat stats for the platform-fighter scene live in minariData.ts.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 *
 * Base stats are RPG-style small numbers (30–90 range).
 * CombatFormulaSystem converts them to actual battle stats per level.
 *
 * Balance targets at Level 7 (tools/balance_calculator.ts):
 *   HP         90–120
 *   ATK/DEF    40–55
 *   Basic Atk  12–20 damage
 *   Specials   25–40 damage
 *   Turns/KO   5–9
 */

import type { MonariRarity, BattleArchetype } from '../types/progression';

// ── Base stats ────────────────────────────────────────────────────────────────

/** RPG base stats fed into CombatFormulaSystem.calcBattleStats(). */
export interface MonariBaseStats {
  hp:             number;
  aura:           number;
  attack:         number;
  specialAttack:  number;
  defense:        number;
  specialDefense: number;
  speed:          number;
}

// ── Dex entry ─────────────────────────────────────────────────────────────────

export interface MonariDexEntry {
  id:              string;
  rarity:          MonariRarity;
  /** RPG-style base stats used by CombatFormulaSystem. */
  baseStats:       MonariBaseStats;
  /** Base XP granted to the opposing Monari when defeated. */
  baseXPYield:     number;
  /** Level required before first evolution is possible (0 = no evolution). */
  evo1MinLevel:    number;
  /** Level required before second evolution is possible (0 = no second evo). */
  evo2MinLevel:    number;
  /** Evolved form IDs (empty = no evolutions). */
  evolutions:      string[];
  /** Wild encounter weight relative to rarity tier base (normally 1.0). */
  encounterWeight: number;
  /** Combat role archetype label used in Battle Lab and codex UI. */
  battleArchetype?: BattleArchetype;
}

// ── Dex entries ───────────────────────────────────────────────────────────────

export const MONARI_DEX: Record<string, MonariDexEntry> = {

  // ── Flarepaw — fire, physical attacker ──────────────────────────────────────
  flarepaw: {
    id:    'flarepaw',
    rarity: 'rare',
    baseStats: {
      hp:             45,
      aura:           35,
      attack:         65,
      specialAttack:  48,
      defense:        48,
      specialDefense: 42,
      speed:          70,
    },
    baseXPYield:    60,
    evo1MinLevel:   20,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Physical Striker',
  },

  // ── Droplet — water, special attacker ───────────────────────────────────────
  droplet: {
    id:    'droplet',
    rarity: 'common',
    baseStats: {
      hp:             40,
      aura:           40,
      attack:         48,
      specialAttack:  65,
      defense:        40,
      specialDefense: 52,
      speed:          80,
    },
    baseXPYield:    30,
    evo1MinLevel:   18,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Arcane Caster',
  },

  // ── Umbravine — shadow, balanced attacker ────────────────────────────────────
  umbravine: {
    id:    'umbravine',
    rarity: 'uncommon',
    baseStats: {
      hp:             42,
      aura:           38,
      attack:         58,
      specialAttack:  58,
      defense:        52,
      specialDefense: 55,
      speed:          68,
    },
    baseXPYield:    45,
    evo1MinLevel:   0,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Shadow Assassin',
  },

  // ── Sproutodon — earth, physical tank ───────────────────────────────────────
  sproutodon: {
    id:    'sproutodon',
    rarity: 'uncommon',
    baseStats: {
      hp:             50,
      aura:           32,
      attack:         60,
      specialAttack:  42,
      defense:        65,
      specialDefense: 58,
      speed:          50,
    },
    baseXPYield:    40,
    evo1MinLevel:   16,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Bulky Guardian',
  },

  // ── Umbrelette — shadow/light, support ──────────────────────────────────────
  umbrelette: {
    id:    'umbrelette',
    rarity: 'rare',
    baseStats: {
      hp:             44,
      aura:           45,
      attack:         52,
      specialAttack:  62,
      defense:        55,
      specialDefense: 60,
      speed:          65,
    },
    baseXPYield:    55,
    evo1MinLevel:   22,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Support Controller',
  },

  // ── Uvee — void/light, rare attacker ────────────────────────────────────────
  uvee: {
    id:    'uvee',
    rarity: 'super_rare',
    baseStats: {
      hp:             42,
      aura:           50,
      attack:         55,
      specialAttack:  78,
      defense:        45,
      specialDefense: 55,
      speed:          85,
    },
    baseXPYield:    90,
    evo1MinLevel:   30,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
    battleArchetype: 'Speedster',
  },
};

// ── Rarity encounter weights ──────────────────────────────────────────────────

/** Base encounter weights by rarity tier (before Soul Rank boost). */
export const RARITY_BASE_WEIGHTS: Record<MonariRarity, number> = {
  common:     0.50,
  uncommon:   0.25,
  rare:       0.15,
  super_rare: 0.08,
  ultra_rare: 0.005,
  legendary:  0.002,
  mythic:     0.0,
};
