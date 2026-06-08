/**
 * Challenger / trainer definitions.
 * Only Renzo is functional (rival battle in Training Field).
 * Amari and Erix are placeholder configs for future wiring.
 *
 * Asset paths:
 *   public/assets/npcs/renzo/
 *   public/assets/npcs/amari/
 *   public/assets/npcs/erix/
 *
 * Future companion/opposing Minari:
 *   public/assets/characters/umbrelette/
 *   public/assets/characters/uvee/
 */

export interface ChallengerDef {
  id:          string;
  displayName: string;
  /** Default starter Minari id — overridden at runtime by renzoCounterPick(). */
  defaultStarterMinariId: string;
  /** Overworld NPC tint color. */
  color:       number;
  /** Asset folder path for future sprite sheets. */
  assetPath:   string;
  /** Battle command set override. Falls back to CLASSIC_COMMAND_SETS[starterId]. */
  moveSetOverride?: string[];
  /** Pre-battle dialogue lines shown in overworld before the duel. */
  preBattleDialog: string[];
  /** Post-battle dialogue (player wins). */
  postBattleWinDialog: string[];
  /** Post-battle dialogue (player loses). */
  postBattleLoseDialog: string[];
}

export const CHALLENGERS: Record<string, ChallengerDef> = {
  renzo: {
    id:          'renzo',
    displayName: 'Renzo',
    defaultStarterMinariId: 'droplet',
    color:       0x4488ff,
    assetPath:   'assets/npcs/renzo',
    preBattleDialog: [
      'Renzo: Alright, Amari. Let\'s see what you and your Minari are made of!',
      'Renzo: Don\'t hold back — I\'m going all out.',
    ],
    postBattleWinDialog: [
      'Renzo: ...You\'re stronger than I thought.',
      'Renzo: I\'ll get better. Come back and spar anytime.',
    ],
    postBattleLoseDialog: [
      'Renzo: Hah! Not bad, but you\'ve still got more to learn.',
      'Renzo: Train up and challenge me again whenever you\'re ready.',
    ],
  },

  // ── Placeholder challengers (not yet functional) ───────────────────────────

  amari_npc: {
    id:          'amari_npc',
    displayName: 'Amari (Advanced)',
    defaultStarterMinariId: 'flarepaw',
    color:       0xff6600,
    assetPath:   'assets/npcs/amari',
    preBattleDialog: ['Amari: Let\'s see how far you\'ve come!'],
    postBattleWinDialog: ['Amari: Incredible work.'],
    postBattleLoseDialog: ['Amari: Keep pushing your limits.'],
  },

  erix: {
    id:          'erix',
    displayName: 'Erix',
    defaultStarterMinariId: 'uvee',   // placeholder — uvee not yet in roster
    color:       0xaa44ff,
    assetPath:   'assets/npcs/erix',
    preBattleDialog: ['Erix: My Uvee and I have trained for this moment.'],
    postBattleWinDialog: ['Erix: Unexpected... but I respect it.'],
    postBattleLoseDialog: ['Erix: As expected. Train harder.'],
  },
};
