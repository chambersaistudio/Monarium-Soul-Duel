/**
 * Monari progression metadata: level scaling, evolution info, encounter rarity weights.
 * Combat stats live in minariData.ts. This file covers growth/progression properties only.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

import type { MonariRarity } from '../types/progression';

export interface MonariDexEntry {
  id:              string;
  rarity:          MonariRarity;
  /** Base XP granted to the opposing Monari when defeated. */
  baseXPYield:     number;
  /** HP/Aura/stat multiplier per level above 1. Applied as: baseStat * (1 + growthRate * (level - 1)). */
  statGrowthRate:  number;
  /** Level required before first evolution is possible (0 = no evolution). */
  evo1MinLevel:    number;
  /** Level required before second evolution is possible (0 = no second evo). */
  evo2MinLevel:    number;
  /** Evolved form IDs (empty = no evolutions). */
  evolutions:      string[];
  /** Wild encounter weight (relative to rarity tier base; normally 1.0). */
  encounterWeight: number;
}

export const MONARI_DEX: Record<string, MonariDexEntry> = {
  flarepaw: {
    id:             'flarepaw',
    rarity:         'rare',
    baseXPYield:    60,
    statGrowthRate: 0.018,
    evo1MinLevel:   20,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },

  droplet: {
    id:             'droplet',
    rarity:         'common',
    baseXPYield:    30,
    statGrowthRate: 0.015,
    evo1MinLevel:   18,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },

  umbravine: {
    id:             'umbravine',
    rarity:         'uncommon',
    baseXPYield:    45,
    statGrowthRate: 0.016,
    evo1MinLevel:   0,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },

  sproutodon: {
    id:             'sproutodon',
    rarity:         'uncommon',
    baseXPYield:    40,
    statGrowthRate: 0.014,
    evo1MinLevel:   16,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },

  umbrelette: {
    id:             'umbrelette',
    rarity:         'rare',
    baseXPYield:    55,
    statGrowthRate: 0.017,
    evo1MinLevel:   22,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },

  uvee: {
    id:             'uvee',
    rarity:         'super_rare',
    baseXPYield:    90,
    statGrowthRate: 0.020,
    evo1MinLevel:   30,
    evo2MinLevel:   0,
    evolutions:     [],
    encounterWeight: 1.0,
  },
};

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
