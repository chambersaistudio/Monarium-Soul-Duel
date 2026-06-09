/**
 * Soul Rank tracking and modifiers for the Bonder (player).
 * All methods are pure/static — no internal state.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md §2 before modifying.
 */

import type { SoulRank, SoulRankTier } from '../types/progression';
import {
  SOUL_RANK_XP_PER_LEVEL,
  BOND_XP_MULTIPLIER,
  ENCOUNTER_BOOST,
} from '../config/progressionConfig';

const TIER_BREAKPOINTS: { min: number; tier: SoulRankTier }[] = [
  { min: 96, tier: 'true_soul'  },
  { min: 86, tier: 'soul_master' },
  { min: 71, tier: 'master'     },
  { min: 56, tier: 'expert'     },
  { min: 41, tier: 'bonded'     },
  { min: 26, tier: 'adept'      },
  { min: 11, tier: 'seeker'     },
  { min:  1, tier: 'novice'     },
];

export class PlayerProgressionSystem {

  static createNewProfile(): SoulRank {
    return {
      tier:            'novice',
      level:           1,
      points:          0,
      nextLevelPoints: SOUL_RANK_XP_PER_LEVEL,
    };
  }

  static addPoints(rank: SoulRank, points: number): SoulRank {
    let result = { ...rank, points: rank.points + points };
    while (result.points >= result.nextLevelPoints && result.level < 100) {
      result = {
        ...result,
        level:           result.level + 1,
        points:          result.points - result.nextLevelPoints,
        nextLevelPoints: SOUL_RANK_XP_PER_LEVEL,
        tier:            PlayerProgressionSystem.getTier(result.level + 1),
      };
    }
    if (result.level >= 100) {
      result = { ...result, level: 100, points: 0, nextLevelPoints: 0 };
    }
    return result;
  }

  static getTier(level: number): SoulRankTier {
    for (const bp of TIER_BREAKPOINTS) {
      if (level >= bp.min) return bp.tier;
    }
    return 'novice';
  }

  /** Bond XP multiplier that scales linearly from 1.0 (rank 1) to 1.5 (rank 100). */
  static getBondXPMultiplier(rank: SoulRank): number {
    const t = (rank.level - 1) / 99;
    return BOND_XP_MULTIPLIER.MIN + t * (BOND_XP_MULTIPLIER.MAX - BOND_XP_MULTIPLIER.MIN);
  }

  /**
   * Returns adjusted encounter chances for super_rare and ultra_rare tiers.
   * Returns plain base rates for all other rarities.
   */
  static getEncounterBoost(rank: SoulRank): { superRare: number; ultraRare: number } {
    const t = (rank.level - 1) / 99;
    return {
      superRare: ENCOUNTER_BOOST.BASE_SUPER_RARE + t * (ENCOUNTER_BOOST.MAX_SUPER_RARE - ENCOUNTER_BOOST.BASE_SUPER_RARE),
      ultraRare: ENCOUNTER_BOOST.BASE_ULTRA_RARE + t * (ENCOUNTER_BOOST.MAX_ULTRA_RARE - ENCOUNTER_BOOST.BASE_ULTRA_RARE),
    };
  }
}
