/**
 * All tunable constants for the MONARIUM combat formula system.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 * See tools/balance_calculator.ts to verify balance targets.
 */

// ── Stat calculation ──────────────────────────────────────────────────────────

export const STAT_FORMULA = {
  HP_BASE:           40,    // flat addend to every Monari's HP
  HP_FACTOR:         0.70,  // how much base HP matters
  HP_LEVEL_FACTOR:   4,     // HP gained per level
  AURA_BASE:         20,
  AURA_FACTOR:       0.50,
  AURA_LEVEL_FACTOR: 2,
  STAT_FACTOR:       0.60,  // applied to attack/defense/speed base stats
  STAT_LEVEL_FACTOR: 2,     // bonus per level for non-HP/Aura stats
  STAGE_BONUS:       10,    // flat addend per evolution stage (0-based)
} as const;

// ── Damage formula ────────────────────────────────────────────────────────────

export const DAMAGE_FORMULA = {
  /** levelFactor = LEVEL_BASE + attacker.level / 100 */
  LEVEL_BASE:          0.35,
  CRIT_BASE_CHANCE:    0.08,
  CRIT_MULTIPLIER:     1.50,
  GUARD_MODIFIER:      0.30,  // fraction of damage that passes a guard
  RANDOM_MIN:          0.90,
  RANDOM_MAX:          1.10,
  DEFAULT_ENEMY_LEVEL: 7,
} as const;

// ── Soul Sync damage modifiers ────────────────────────────────────────────────

export const SYNC_DAMAGE_MODIFIERS: Record<string, number> = {
  locked_in: 1.10,
  stable:    1.00,
  shaken:    0.95,
  broken:    0.90,
} as const;

// ── Type effectiveness chart ──────────────────────────────────────────────────
// Key: attacker move element → defender Monari element → damage multiplier.
// Missing combinations default to 1.0 (neutral).

export const TYPE_CHART: Readonly<Record<string, Record<string, number>>> = {
  ember:    { earth: 1.25, water: 0.80, aqua: 0.80 },
  fire:     { earth: 1.25, water: 0.80, aqua: 0.80 },
  water:    { fire:  1.25, earth: 0.80 },
  aqua:     { fire:  1.25, earth: 0.80 },
  earth:    { fire:  0.80, lightning: 1.25, bolt: 1.25 },
  shadow:   { light: 1.25, shadow: 0.80 },
  light:    { shadow: 1.25 },
  physical: {},
  none:     {},
  normal:   {},
} as const;
