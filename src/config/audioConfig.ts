/**
 * Audio manifest — maps every key the game references to its asset path(s).
 *
 * All files are OPTIONAL.  If a file is missing, the Phaser loader emits a
 * loaderror and the AudioManager silently skips playback for that key.
 *
 * To add a new sound:
 *   1. Drop the file at the path listed below (OGG preferred, MP3 fallback).
 *   2. Add the key + path pair here.
 *   3. Reference the key via AUDIO_KEYS in your scene or system.
 *   No other code changes are needed.
 */

/** Key-to-path map loaded by PreloadScene. */
export const AUDIO_FILES: Record<string, string[]> = {
  // ── BGM ────────────────────────────────────────────────────────────────────
  bgm_menu:         ['assets/audio/bgm/menu.ogg',      'assets/audio/bgm/menu.mp3'],
  bgm_battle:       ['assets/audio/bgm/battle.ogg',   'assets/audio/bgm/battle.mp3'],
  bgm_overworld:    ['assets/audio/bgm/overworld.ogg', 'assets/audio/bgm/overworld.mp3'],

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

  // ── Creature SFX ───────────────────────────────────────────────────────────
  flarepaw_hurt:    ['assets/audio/sfx/creatures/flarepaw/hurt.ogg', 'assets/audio/sfx/creatures/flarepaw/hurt.mp3'],
  droplet_hurt:     ['assets/audio/sfx/creatures/droplet/hurt.ogg',  'assets/audio/sfx/creatures/droplet/hurt.mp3'],

  // ── Music (alternate paths) ────────────────────────────────────────────────
  bgm_victory:   ['assets/audio/music/victory_theme.mp3', 'assets/audio/bgm/victory.mp3'],
  bgm_title:     ['assets/audio/music/title_theme.mp3',   'assets/audio/bgm/menu.mp3'],
  sfx_bond:      ['assets/audio/sfx/bond_success.mp3'],
};

/** Typed constants so scenes never hard-code string keys. */
export const AUDIO_KEYS = {
  bgm: {
    menu:      'bgm_menu',
    battle:    'bgm_battle',
    overworld: 'bgm_overworld',
    victory:   'bgm_victory',
    title:     'bgm_title',
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
