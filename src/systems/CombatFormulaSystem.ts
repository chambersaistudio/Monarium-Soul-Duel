/**
 * Converts Monari base stats + level into computed battle stats.
 * All values are deterministic — call once at actor creation.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

import { STAT_FORMULA } from '../config/combatFormulaConfig';
import type { MonariBaseStats } from '../data/monariDex';

export interface ComputedBattleStats {
  level:          number;
  maxHp:          number;
  maxAura:        number;
  attack:         number;
  specialAttack:  number;
  defense:        number;
  specialDefense: number;
  speed:          number;
}

/** Fallback base stats used when a Monari has no dex entry. */
const FALLBACK_BASE: MonariBaseStats = {
  hp: 45, aura: 35,
  attack: 55, specialAttack: 55,
  defense: 45, specialDefense: 45,
  speed: 60,
};

export class CombatFormulaSystem {
  /**
   * Calculate final battle stats from base stats, level, and evolution stage.
   * @param base  RPG-style base stats from MonariDexEntry.baseStats (small numbers, ~30–90 range)
   * @param level Combat level (1–100)
   * @param stage Evolution stage: 0 = base, 1 = first evo, 2 = final form
   */
  static calcBattleStats(
    base:  MonariBaseStats | undefined,
    level: number,
    stage = 0,
  ): ComputedBattleStats {
    const b          = base ?? FALLBACK_BASE;
    const stageBonus = stage * STAT_FORMULA.STAGE_BONUS;
    const lv         = Math.max(1, level);
    const {
      HP_BASE, HP_FACTOR, HP_LEVEL_FACTOR,
      AURA_BASE, AURA_FACTOR, AURA_LEVEL_FACTOR,
      STAT_FACTOR, STAT_LEVEL_FACTOR,
    } = STAT_FORMULA;

    return {
      level,
      maxHp:          Math.floor(HP_BASE          + b.hp             * HP_FACTOR   + lv * HP_LEVEL_FACTOR   + stageBonus),
      maxAura:        Math.floor(AURA_BASE         + b.aura           * AURA_FACTOR + lv * AURA_LEVEL_FACTOR),
      attack:         Math.floor(b.attack         * STAT_FACTOR + lv * STAT_LEVEL_FACTOR + stageBonus),
      specialAttack:  Math.floor(b.specialAttack  * STAT_FACTOR + lv * STAT_LEVEL_FACTOR + stageBonus),
      defense:        Math.floor(b.defense        * STAT_FACTOR + lv * STAT_LEVEL_FACTOR + stageBonus),
      specialDefense: Math.floor(b.specialDefense * STAT_FACTOR + lv * STAT_LEVEL_FACTOR + stageBonus),
      speed:          Math.floor(b.speed          * STAT_FACTOR + lv * STAT_LEVEL_FACTOR),
    };
  }

  /**
   * Returns the stat block as a printable string — used by the balance calculator.
   */
  static describe(stats: ComputedBattleStats): string {
    return (
      `Lv.${stats.level}  HP:${stats.maxHp}  Aura:${stats.maxAura}  ` +
      `ATK:${stats.attack}  SPATK:${stats.specialAttack}  ` +
      `DEF:${stats.defense}  SPDEF:${stats.specialDefense}  SPD:${stats.speed}`
    );
  }
}
