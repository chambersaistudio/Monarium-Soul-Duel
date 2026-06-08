import type { ClassicMoveConfig } from '../types/classic';

// ── Move definitions ───────────────────────────────────────────────────────────
// animFolder maps to existing Phaser animation keys: '${charId}_${animFolder}'.
// When an 'actions/<moveName>' folder is added under public/assets/characters/<charId>/actions/
// and gen:manifest is re-run, just update animFolder here and the engine picks it up.
export const CLASSIC_MOVES: Record<string, ClassicMoveConfig> = {
  basic_attack: {
    id: 'basic_attack',
    displayName: 'Basic Attack',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power: 20,
    damageType: 'physical',
    returnToAnchor: true,
  },
  flame_paw_barrage: {
    id: 'flame_paw_barrage',
    displayName: 'Flame Paw Barrage',
    // Upgrade animFolder to 'actions/flame_paw_barrage' once sprites land
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power: 35,
    damageType: 'ember',
    returnToAnchor: true,
    auraCost: 20,
  },
  aqua_ripple: {
    id: 'aqua_ripple',
    displayName: 'Aqua Ripple',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 0,
    power: 22,
    damageType: 'water',
    returnToAnchor: true,
    auraCost: 15,
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
    power: 0,
    damageType: 'none',
    returnToAnchor: false,
    holdsStance: true,  // stays in guard pose through opponent's turn
  },
  shadow_coil: {
    id: 'shadow_coil',
    displayName: 'Shadow Coil',
    animFolder: 'attack',
    approachAnim: 'run',
    returnAnim: 'run',
    targetReaction: 'hurt',
    movementType: 'dash_to_target',
    hitFrameIndex: 1,
    power: 28,
    damageType: 'none',
    returnToAnchor: true,
    auraCost: 15,
  },
};

// ── Per-character command menus ────────────────────────────────────────────────
// Ordered list of move IDs shown in the command menu for each character.
export const CLASSIC_COMMAND_SETS: Record<string, string[]> = {
  flarepaw:  ['basic_attack', 'flame_paw_barrage', 'guard'],
  droplet:   ['basic_attack', 'aqua_ripple', 'guard'],
  umbravine: ['basic_attack', 'shadow_coil', 'guard'],
};

// Sentinel value for the Back / do-nothing menu slot (handled by the scene, not engine)
export const BACK_COMMAND = '__back__';
