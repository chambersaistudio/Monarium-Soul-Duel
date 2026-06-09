/**
 * Tunable numeric values for all progression systems.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

// ── Soul Sync ─────────────────────────────────────────────────────────────────

export const SYNC_THRESHOLDS = {
  LOCKED_IN: 80,
  STABLE:    50,
  SHAKEN:    25,
  // 0–24 = broken
} as const;

/** Sync delta values for each in-battle event. */
export const SYNC_EVENTS = {
  LAND_ATTACK:      +4,
  MISS_ATTACK:      -5,
  TAKE_CRIT:        -8,
  TAKE_HEAVY_HIT:   -4,
  GUARD_SUCCESS:    +3,
  DODGE_SUCCESS:    +4,
  TYPE_ADVANTAGE:   +5,
  SYNC_BREAK_HIT:   -12,
  SWAP_OUT:         -6,
  LOW_HP_PRESSURE:  -2,   // applied once when HP drops below 25%
  PASSIVE_PER_TURN:  0,   // bond-level dependent; see SYNC_PASSIVE_PER_TURN
} as const;

/** Passive per-turn Sync recovery keyed by bond level (1–10). */
export const SYNC_PASSIVE_PER_TURN: Record<number, number> = {
  1:  0,
  2:  0,
  3:  0,
  4:  1,
  5:  1,
  6:  1,
  7:  2,
  8:  2,
  9:  2,
  10: 3,
};

/** Starting Sync value by Bond Level (1–10). */
export const STARTING_SYNC_BY_BOND_LEVEL: Record<number, number> = {
  1:  70,
  2:  74,
  3:  77,
  4:  80,
  5:  83,
  6:  86,
  7:  89,
  8:  92,
  9:  96,
  10: 100,
};

/** Stat bonuses granted by Sync tier. Values are additive multipliers (0 = no bonus). */
export const SYNC_TIER_BONUSES = {
  locked_in: { critBonus: 0.10, dodgeBonus: 0.10, accuracyBonus: 0.08 },
  stable:    { critBonus: 0,    dodgeBonus: 0,    accuracyBonus: 0    },
  shaken:    { critBonus: -0.05, dodgeBonus: -0.05, accuracyBonus: -0.05 },
  broken:    { critBonus: -0.10, dodgeBonus: -0.10, accuracyBonus: -0.08 },
} as const;

// ── Bond Level ────────────────────────────────────────────────────────────────

/** XP required to reach each Bond Level from the previous one (index = target level). */
export const BOND_LEVEL_XP_THRESHOLDS: Record<number, number> = {
  2:  100,
  3:  200,
  4:  350,
  5:  550,
  6:  800,
  7:  1100,
  8:  1500,
  9:  2000,
  10: 2700,
};

// ── Bond Momentum ─────────────────────────────────────────────────────────────

export const BOND_MOMENTUM = {
  MAX:                 100,
  GAIN_PER_BATTLE:     15,
  DECAY_AFTER_BATTLES: 3,    // number of battles sitting out before decay starts
  DECAY_PER_BATTLE:    20,   // momentum lost per battle of disuse after threshold
  /** Bonus Bond XP multiplier at max momentum: +50% */
  MAX_MULTIPLIER:      1.50,
} as const;

// ── Soul Rank ─────────────────────────────────────────────────────────────────

/** XP required to reach each rank level (1-indexed; index 0 unused). */
export const SOUL_RANK_XP_PER_LEVEL = 1000; // flat for now; tunable per tier later

/** Ultra Rare encounter chance at rank 1 and rank 100. */
export const ENCOUNTER_BOOST = {
  BASE_ULTRA_RARE:    0.005,  // 0.5%
  MAX_ULTRA_RARE:     0.010,  // 1.0% at rank 100
  BASE_SUPER_RARE:    0.08,
  MAX_SUPER_RARE:     0.11,
} as const;

/** Bond XP multiplier at rank 1 and rank 100. */
export const BOND_XP_MULTIPLIER = {
  MIN: 1.00,
  MAX: 1.50,
} as const;
