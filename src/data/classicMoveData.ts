import type { ClassicMoveConfig } from '../types/classic';

// ── Move definitions ───────────────────────────────────────────────────────────
// animFolder maps to existing Phaser animation keys: '${charId}_${animFolder}'.
// When an 'actions/<moveName>' folder is added under public/assets/monari/<charId>/actions/
// and gen:manifest is re-run, just update animFolder here and the engine picks it up.
export const CLASSIC_MOVES: Record<string, ClassicMoveConfig> = {

  // ── Universal ──────────────────────────────────────────────────────────────

  basic_attack: {
    id: 'basic_attack',
    displayName: 'Basic Attack',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power:      30,
    damageType: 'neutral',
    category:   'physical',
    accuracy:   95,
    canCrit:    true,
    returnToAnchor: true,
  },

  guard: {
    id: 'guard',
    displayName: 'Guard',
    animFolder: 'guard',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'none',
    movementType: 'stay',
    hitFrameIndex: 0,
    power:      0,
    damageType: 'none',
    category:   'status',
    accuracy:   100,
    canCrit:    false,
    returnToAnchor: false,
    holdsStance: true,
  },

  // ── Flarepaw moves ─────────────────────────────────────────────────────────

  flame_paw_barrage: {
    id: 'flame_paw_barrage',
    displayName: 'Flame Paw Barrage',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power:      52,
    damageType: 'ember',
    category:   'physical',
    accuracy:   90,
    canCrit:    true,
    returnToAnchor: true,
    auraCost:   20,
  },

  ember_shot: {
    id: 'ember_shot',
    displayName: 'Ember Shot',
    animFolder: 'attack',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'hurt',
    movementType: 'stay',
    hitFrameIndex: 2,
    power:      40,
    damageType: 'ember',
    category:   'special',
    accuracy:   95,
    canCrit:    true,
    returnToAnchor: false,
    auraCost:   14,
  },

  heat_guard: {
    id: 'heat_guard',
    displayName: 'Heat Guard',
    animFolder: 'guard',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'none',
    movementType: 'stay',
    hitFrameIndex: 0,
    power:      0,
    damageType: 'none',
    category:   'status',
    accuracy:   100,
    canCrit:    false,
    returnToAnchor: false,
    holdsStance: true,
    auraGain:   6,
  },

  blinding_flare: {
    id: 'blinding_flare',
    displayName: 'Blinding Flare',
    animFolder: 'attack',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'hurt',
    movementType: 'stay',
    hitFrameIndex: 1,
    power:      0,
    damageType: 'ember',
    category:   'status',
    accuracy:   85,
    canCrit:    false,
    returnToAnchor: false,
    auraCost:   18,
    syncDamage: -12,
  },

  // ── Droplet moves ──────────────────────────────────────────────────────────

  aqua_ripple: {
    id: 'aqua_ripple',
    displayName: 'Aqua Ripple',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 0,
    power:      46,
    damageType: 'aqua',
    category:   'special',
    accuracy:   92,
    canCrit:    true,
    returnToAnchor: true,
    auraCost:   18,
  },

  crystal_knuckle: {
    id: 'crystal_knuckle',
    displayName: 'Crystal Knuckle',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power:      50,
    damageType: 'aqua',
    category:   'physical',
    accuracy:   88,
    canCrit:    true,
    returnToAnchor: true,
    auraCost:   20,
  },

  shell_guard: {
    id: 'shell_guard',
    displayName: 'Shell Guard',
    animFolder: 'guard',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'none',
    movementType: 'stay',
    hitFrameIndex: 0,
    power:      0,
    damageType: 'none',
    category:   'status',
    accuracy:   100,
    canCrit:    false,
    returnToAnchor: false,
    holdsStance: true,
    auraGain:   6,
  },

  tidal_feint: {
    id: 'tidal_feint',
    displayName: 'Tidal Feint',
    animFolder: 'attack',
    approachAnim: 'idle',
    returnAnim: 'idle',
    targetReaction: 'hurt',
    movementType: 'stay',
    hitFrameIndex: 1,
    power:      0,
    damageType: 'aqua',
    category:   'status',
    accuracy:   88,
    canCrit:    false,
    returnToAnchor: false,
    auraCost:   16,
    syncDamage: -10,
  },

  // ── Umbravine moves ────────────────────────────────────────────────────────

  shadow_coil: {
    id: 'shadow_coil',
    displayName: 'Shadow Coil',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power:      42,
    damageType: 'shadow',
    category:   'special',
    accuracy:   90,
    canCrit:    true,
    returnToAnchor: true,
    auraCost:   18,
  },
};

// ── Per-character command menus ────────────────────────────────────────────────
// Ordered list of move IDs shown in the command menu for each character.
export const CLASSIC_COMMAND_SETS: Record<string, string[]> = {
  flarepaw:   ['basic_attack', 'flame_paw_barrage', 'ember_shot',     'heat_guard'],
  droplet:    ['basic_attack', 'aqua_ripple',       'crystal_knuckle', 'shell_guard'],
  umbravine:  ['basic_attack', 'shadow_coil',       'guard'],
  sproutodon: ['basic_attack', 'guard'],
};

// Sentinel value for the Back / do-nothing menu slot (handled by the scene, not engine)
export const BACK_COMMAND = '__back__';
