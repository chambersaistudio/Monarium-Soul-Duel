/**
 * Audio manifest — maps every key the game references to its asset path(s).
 *
 * All files are OPTIONAL.  If a file is missing, the Phaser loader emits a
 * loaderror and the AudioManager silently skips playback for that key.
 *
 * Folder structure:
 *   assets/audio/music/title/        — title screen theme
 *   assets/audio/music/overworld/    — area-specific overworld tracks
 *   assets/audio/music/battle/       — battle themes
 *   assets/audio/music/events/       — victory / bond / level-up stings
 *   assets/audio/sfx/                — sound effects (ui, battle, creatures)
 */

/** Key-to-path map loaded by PreloadScene. */
export const AUDIO_FILES: Record<string, string[]> = {
  // ── Title ──────────────────────────────────────────────────────────────────
  bgm_title:        ['assets/audio/music/title/title_theme.mp3'],

  // ── Overworld ──────────────────────────────────────────────────────────────
  bgm_village:      ['assets/audio/music/overworld/village_theme.mp3'],
  bgm_forest:       ['assets/audio/music/overworld/forest_theme.mp3'],
  bgm_cave:         ['assets/audio/music/overworld/cave_theme.mp3'],
  bgm_beach:        ['assets/audio/music/overworld/beach_theme.mp3'],
  bgm_overworld:    ['assets/audio/music/overworld/general_overworld_theme.mp3'],

  // ── Battle ─────────────────────────────────────────────────────────────────
  bgm_battle:       ['assets/audio/music/battle/wild_battle_theme.mp3'],
  bgm_rival:        ['assets/audio/music/battle/rival_battle_theme.mp3'],
  bgm_trainer:      ['assets/audio/music/battle/trainer_battle_theme.mp3'],

  // ── Events ─────────────────────────────────────────────────────────────────
  bgm_victory:      ['assets/audio/music/events/victory_theme.mp3'],
  bgm_bond_success: ['assets/audio/music/events/bond_success_theme.mp3'],
  bgm_level_up:     ['assets/audio/music/events/level_up_theme.mp3'],

  // ── UI sounds ──────────────────────────────────────────────────────────────
  ui_move:          ['assets/audio/ui/move.ogg',    'assets/audio/ui/move.mp3'],
  ui_confirm:       ['assets/audio/ui/confirm.ogg', 'assets/audio/ui/confirm.mp3'],
  ui_back:          ['assets/audio/ui/back.ogg',    'assets/audio/ui/back.mp3'],

  // ── Battle SFX ─────────────────────────────────────────────────────────────
  sfx_attack_hit:   ['assets/audio/sfx/battle/attack_hit.ogg',  'assets/audio/sfx/battle/attack_hit.mp3'],
  sfx_guard_block:  ['assets/audio/sfx/battle/guard_block.ogg', 'assets/audio/sfx/battle/guard_block.mp3'],
  sfx_hurt_impact:  ['assets/audio/sfx/battle/hurt_impact.ogg', 'assets/audio/sfx/battle/hurt_impact.mp3'],
  sfx_victory:      ['assets/audio/sfx/battle/victory.ogg',     'assets/audio/sfx/battle/victory.mp3'],
  sfx_defeat:       ['assets/audio/sfx/battle/defeat.ogg',      'assets/audio/sfx/battle/defeat.mp3'],
  sfx_bond:         ['assets/audio/sfx/bond_success.mp3'],

  // ── Creature SFX ───────────────────────────────────────────────────────────
  flarepaw_hurt:    ['assets/audio/sfx/creatures/flarepaw/hurt.ogg', 'assets/audio/sfx/creatures/flarepaw/hurt.mp3'],
  droplet_hurt:     ['assets/audio/sfx/creatures/droplet/hurt.ogg',  'assets/audio/sfx/creatures/droplet/hurt.mp3'],
};

/** Typed constants so scenes never hard-code string keys. */
export const AUDIO_KEYS = {
  bgm: {
    title:       'bgm_title',
    village:     'bgm_village',
    forest:      'bgm_forest',
    cave:        'bgm_cave',
    beach:       'bgm_beach',
    overworld:   'bgm_overworld',
    battle:      'bgm_battle',
    rival:       'bgm_rival',
    trainer:     'bgm_trainer',
    victory:     'bgm_victory',
    bondSuccess: 'bgm_bond_success',
    levelUp:     'bgm_level_up',
  },
  ui: {
    move:    'ui_move',
    confirm: 'ui_confirm',
    back:    'ui_back',
  },
  sfx: {
    attackHit:  'sfx_attack_hit',
    guardBlock: 'sfx_guard_block',
    hurtImpact: 'sfx_hurt_impact',
    victory:    'sfx_victory',
    defeat:     'sfx_defeat',
    bond:       'sfx_bond',
  },
  /** Returns the hurt-sound key for any character ID. */
  creatureHurt: (charId: string): string => `${charId}_hurt`,
} as const;
