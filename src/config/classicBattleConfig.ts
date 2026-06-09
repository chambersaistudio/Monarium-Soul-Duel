/**
 * Config for Classic Soul Duel scene.
 * Change values here — no other code edits needed to swap backgrounds or music.
 */
export const CLASSIC_BATTLE_CONFIG = {
  background: 'forest_shrine_01',
  bgm: 'bgm_battle',
} as const;

// ── Combat formula constants ──────────────────────────────────────────────────

export const COMBAT_FORMULA = {
  /** Stat multiplier per level above 1: stat_at_level = base * (1 + RATE * (level-1)). */
  LEVEL_GROWTH_RATE: 0.018,
  /** Normalisation baseline for attack power and defence. */
  POWER_SCALE_BASE:  60,
  DEF_SCALE_BASE:    60,
  /** Damage roll range (inclusive). */
  VARIANCE_MIN:      0.85,
  VARIANCE_MAX:      1.00,
  /** Base critical-hit probability before Soul Sync bonus. */
  CRIT_BASE_CHANCE:  0.08,
  /** Damage multiplier applied on a critical hit. */
  CRIT_DAMAGE_MULT:  1.60,
  /** Fraction of calculated damage that passes through a guard. */
  GUARD_RETAIN:      0.30,
  /** Default combat level for enemies in prototype battles. */
  DEFAULT_ENEMY_LEVEL: 7,
} as const;

/**
 * Type effectiveness chart.
 * Key: attacker's move damageType → defender's Monari element → multiplier.
 * Missing combinations default to 1.0 (neutral).
 */
export const TYPE_CHART: Readonly<Record<string, Record<string, number>>> = {
  ember:    { earth: 2.0, water: 0.5 },
  fire:     { earth: 2.0, water: 0.5 },
  water:    { fire:  2.0, earth: 0.5 },
  aqua:     { fire:  2.0, earth: 0.5 },
  earth:    { fire:  0.5, lightning: 2.0, bolt: 2.0 },
  shadow:   { light: 2.0, shadow: 0.5 },
  light:    { shadow: 2.0 },
  physical: {},   // always neutral
  none:     {},
} as const;
