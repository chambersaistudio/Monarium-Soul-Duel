/**
 * Central damage calculation for MONARIUM classic battles.
 * All game damage passes through here — no inline math in the engine.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

import { DAMAGE_FORMULA, SYNC_DAMAGE_MODIFIERS, TYPE_CHART } from '../config/combatFormulaConfig';
import type { ComputedBattleStats } from './CombatFormulaSystem';
import type { SoulSyncTier } from '../types/progression';

export type MoveCategory = 'physical' | 'special' | 'status';

export interface DamageCalcInput {
  attackerStats:    ComputedBattleStats;
  defenderStats:    ComputedBattleStats;
  /** Move element / damage type string (e.g. 'fire', 'water', 'physical'). */
  moveElement:      string;
  /** Defender Monari's element (from minariData). */
  defenderElement:  string;
  movePower:        number;
  moveCategory:     MoveCategory;
  canCrit:          boolean;
  attackerSyncTier: SoulSyncTier;
  defenderGuarding: boolean;
  /** Extra crit probability from Soul Sync bonus (e.g. 0.10 at Locked In). */
  critBonus?:       number;
  /** Override 0–1 random roll for variance (default: Math.random). */
  varianceRoll?:    number;
  /** Override 0–1 random roll for crit check (default: Math.random). */
  critRoll?:        number;
}

export interface DamageCalcResult {
  damage:         number;
  isCrit:         boolean;
  typeModifier:   number;
  typeAdvantage:  boolean;
  typeResisted:   boolean;
  syncModifier:   number;
  guardModifier:  number;
  varianceRoll:   number;
  attackRatio:    number;
  levelFactor:    number;
}

export class BattleCalculator {

  static calculate(input: DamageCalcInput): DamageCalcResult {
    const { LEVEL_BASE, CRIT_BASE_CHANCE, CRIT_MULTIPLIER, GUARD_MODIFIER, RANDOM_MIN, RANDOM_MAX } = DAMAGE_FORMULA;

    // Zero-power moves (status, guard) deal no damage
    if (input.movePower <= 0 || input.moveCategory === 'status') {
      return { damage: 0, isCrit: false, typeModifier: 1, typeAdvantage: false, typeResisted: false,
               syncModifier: 1, guardModifier: 1, varianceRoll: 1, attackRatio: 0, levelFactor: 0 };
    }

    const { attackerStats: atk, defenderStats: def } = input;

    // ── Attack and defence stats based on move category ───────────────────────
    const atkStat = input.moveCategory === 'special' ? atk.specialAttack : atk.attack;
    const defStat = input.moveCategory === 'special' ? def.specialDefense : def.defense;
    const attackRatio  = atkStat / Math.max(1, defStat);
    const levelFactor  = LEVEL_BASE + atk.level / 100;

    // ── Type modifier ─────────────────────────────────────────────────────────
    const typeModifier = TYPE_CHART[input.moveElement]?.[input.defenderElement] ?? 1.0;
    const typeAdvantage = typeModifier > 1.0;
    const typeResisted  = typeModifier < 1.0;

    // ── Critical hit ──────────────────────────────────────────────────────────
    const critChance  = Math.min(0.50, CRIT_BASE_CHANCE + (input.critBonus ?? 0));
    const critRollVal = input.critRoll ?? Math.random();
    const isCrit      = input.canCrit && critRollVal < critChance;
    const critMult    = isCrit ? CRIT_MULTIPLIER : 1.0;

    // ── Soul Sync modifier ────────────────────────────────────────────────────
    const syncModifier = SYNC_DAMAGE_MODIFIERS[input.attackerSyncTier] ?? 1.0;

    // ── Variance ──────────────────────────────────────────────────────────────
    const varRaw      = input.varianceRoll ?? Math.random();
    const varianceRoll = RANDOM_MIN + varRaw * (RANDOM_MAX - RANDOM_MIN);

    // ── Guard ─────────────────────────────────────────────────────────────────
    const guardModifier = input.defenderGuarding ? GUARD_MODIFIER : 1.0;

    // ── Final damage ──────────────────────────────────────────────────────────
    const raw    = input.movePower * attackRatio * levelFactor * typeModifier * syncModifier * critMult * varianceRoll * guardModifier;
    const damage = Math.max(1, Math.floor(raw));

    return { damage, isCrit, typeModifier, typeAdvantage, typeResisted, syncModifier, guardModifier, varianceRoll, attackRatio, levelFactor };
  }

  /**
   * Compute min / average / max damage for a given input.
   * Runs trials with min, mid, and max variance; assumes no crit for the base range
   * then separately reports the crit multiplier effect.
   */
  static calcRange(
    input: Omit<DamageCalcInput, 'varianceRoll' | 'critRoll'>,
  ): { min: number; avg: number; max: number; critMin: number; critMax: number } {
    const base = { ...input, critRoll: 1.0 }; // no crit for range
    const minR = this.calculate({ ...base, varianceRoll: 0.0 });
    const midR = this.calculate({ ...base, varianceRoll: 0.5 });
    const maxR = this.calculate({ ...base, varianceRoll: 1.0 });
    const critR = this.calculate({ ...input, critRoll: 0.0, varianceRoll: 0.5 }); // force crit
    return {
      min:     minR.damage,
      avg:     midR.damage,
      max:     maxR.damage,
      critMin: Math.floor(minR.damage * DAMAGE_FORMULA.CRIT_MULTIPLIER),
      critMax: Math.floor(maxR.damage * DAMAGE_FORMULA.CRIT_MULTIPLIER),
    };
  }
}
