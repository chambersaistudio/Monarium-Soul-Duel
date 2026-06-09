/**
 * Bond XP / Level / Momentum management.
 * All methods are pure/static — no internal state.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md §3–§4 before modifying.
 */

import type { BondEntry } from '../types/progression';
import { BOND_LEVEL_XP_THRESHOLDS, BOND_MOMENTUM } from '../config/progressionConfig';

export class BondProgressionSystem {

  static createNewBond(monariId: string): BondEntry {
    return {
      monariId,
      bondLevel:            1,
      bondXP:               0,
      bondXPToNext:         BOND_LEVEL_XP_THRESHOLDS[2] ?? 100,
      momentum:             0,
      momentumDecayBattles: 0,
      isTrueSoulBond:       false,
      ascensionEligible:    false,
    };
  }

  /**
   * Add Bond XP after a battle.
   * @param soulRankMultiplier  1.0–1.5 from PlayerProgressionSystem.getBondXPMultiplier()
   */
  static addBattleXP(bond: BondEntry, baseXP: number, soulRankMultiplier: number): BondEntry {
    const momentumBonus = (bond.momentum / 100) * (BOND_MOMENTUM.MAX_MULTIPLIER - 1);
    const total = Math.round(baseXP * soulRankMultiplier * (1 + momentumBonus));
    return BondProgressionSystem.checkLevelUp({ ...bond, bondXP: bond.bondXP + total });
  }

  /**
   * Called after each battle to tick momentum up or decay it.
   * @param usedThisBattle  true if this Monari fought in the battle just completed
   */
  static tickMomentum(bond: BondEntry, usedThisBattle: boolean): BondEntry {
    if (usedThisBattle) {
      return {
        ...bond,
        momentum:             Math.min(BOND_MOMENTUM.MAX, bond.momentum + BOND_MOMENTUM.GAIN_PER_BATTLE),
        momentumDecayBattles: 0,
      };
    }
    const decayBattles = bond.momentumDecayBattles + 1;
    if (decayBattles > BOND_MOMENTUM.DECAY_AFTER_BATTLES) {
      return {
        ...bond,
        momentum:             Math.max(0, bond.momentum - BOND_MOMENTUM.DECAY_PER_BATTLE),
        momentumDecayBattles: decayBattles,
      };
    }
    return { ...bond, momentumDecayBattles: decayBattles };
  }

  /** Resolve any pending level-ups in the bond entry. */
  static checkLevelUp(bond: BondEntry): BondEntry {
    let result = { ...bond };
    while (result.bondLevel < 10) {
      const needed = BOND_LEVEL_XP_THRESHOLDS[result.bondLevel + 1];
      if (needed === undefined || result.bondXP < needed) break;
      result = {
        ...result,
        bondLevel:    result.bondLevel + 1,
        bondXP:       result.bondXP - needed,
        bondXPToNext: BOND_LEVEL_XP_THRESHOLDS[result.bondLevel + 2] ?? 0,
      };
    }
    return result;
  }
}
