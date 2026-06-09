/**
 * Bonder and NPC character definitions for MONARIUM: Soul Duel.
 * Challenger-specific data (dialogue, move overrides) lives in challengerData.ts.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

export type CharacterRole = 'player' | 'rival' | 'mentor' | 'npc';

export interface CharacterDef {
  id:           string;
  displayName:  string;
  role:         CharacterRole;
  /** Asset base path for portraits and overworld sprites. */
  assetPath:    string;
  /** Portrait image key (loaded by PreloadScene). */
  portraitKey:  string;
  /** Short flavour bio shown in Bond Lab / character screens. */
  bio:          string;
  /** Starting Monari IDs for this character. */
  starterMonariIds: string[];
}

export const CHARACTERS: Record<string, CharacterDef> = {
  player: {
    id:          'player',
    displayName: 'Bonder',
    role:        'player',
    assetPath:   'assets/characters/player',
    portraitKey: 'char_player_portrait',
    bio:         'A new Bonder beginning their journey at the Bond Lab.',
    starterMonariIds: ['flarepaw'],
  },

  renzo: {
    id:          'renzo',
    displayName: 'Renzo',
    role:        'rival',
    assetPath:   'assets/characters/renzo',
    portraitKey: 'char_renzo_portrait',
    bio:         'Your rival from the Bond Lab. Quick to challenge, quicker to learn.',
    starterMonariIds: ['droplet'],
  },

  amari: {
    id:          'amari',
    displayName: 'Amari',
    role:        'mentor',
    assetPath:   'assets/characters/amari',
    portraitKey: 'char_amari_portrait',
    bio:         'A seasoned Bonder who guides newcomers at the Bond Lab.',
    starterMonariIds: [],
  },

  erix: {
    id:          'erix',
    displayName: 'Erix',
    role:        'npc',
    assetPath:   'assets/characters/erix',
    portraitKey: 'char_erix_portrait',
    bio:         'A wandering Bonder with an unusual collection of rare Monari.',
    starterMonariIds: [],
  },

  warren_ellis: {
    id:          'warren_ellis',
    displayName: 'Warren Ellis',
    role:        'npc',
    assetPath:   'assets/characters/warren_ellis',
    portraitKey: 'char_warren_ellis_portrait',
    bio:         'A veteran Bonder known for mastery of Soul Sync in high-pressure battles.',
    starterMonariIds: [],
  },
};
