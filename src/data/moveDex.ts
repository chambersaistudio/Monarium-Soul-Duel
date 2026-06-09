/**
 * Extended move data with progression metadata.
 * Combat-facing move configs live in classicMoveData.ts.
 * This file adds lore, unlock requirements, and progression properties.
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md before modifying.
 */

import type { MonariRarity } from '../types/progression';

export type MoveCategory = 'physical' | 'special' | 'status' | 'sync_break';

export interface MoveDexEntry {
  id:           string;
  displayName:  string;
  category:     MoveCategory;
  element:      string;
  power:        number;
  auraCost:     number;
  /** Hit accuracy (0–100). 100 = never misses. */
  accuracy:     number;
  /** Whether this move can roll a critical hit. */
  canCrit:      boolean;
  learnLevel:   number;
  requiresTrueSoulBond: boolean;
  availableTo:  MonariRarity[];
  description:  string;
  isSyncBreak:  boolean;
}

export const MOVE_DEX: Record<string, MoveDexEntry> = {
  basic_attack: {
    id:           'basic_attack',
    displayName:  'Basic Attack',
    category:     'physical',
    element:      'normal',
    power:        30,
    auraCost:     0,
    accuracy:     100,
    canCrit:      true,
    learnLevel:   0,
    requiresTrueSoulBond: false,
    availableTo:  ['common', 'uncommon', 'rare', 'super_rare', 'ultra_rare', 'legendary', 'mythic'],
    description:  'A reliable strike. Costs no Aura.',
    isSyncBreak:  false,
  },

  flarepaw_core: {
    id:           'flarepaw_core',
    displayName:  'Ember Claw',
    category:     'physical',
    element:      'fire',
    power:        24,
    auraCost:     0,
    accuracy:     100,
    canCrit:      true,
    learnLevel:   0,
    requiresTrueSoulBond: false,
    availableTo:  ['rare'],
    description:  "Flarepaw's signature quick-claw strike with a burning edge.",
    isSyncBreak:  false,
  },

  ember_claws: {
    id:           'ember_claws',
    displayName:  'Ember Claws',
    category:     'special',
    element:      'fire',
    power:        35,
    auraCost:     20,
    accuracy:     95,
    canCrit:      true,
    learnLevel:   5,
    requiresTrueSoulBond: false,
    availableTo:  ['rare'],
    description:  'Raking fire-charged claws. Burns through defenses.',
    isSyncBreak:  false,
  },

  blaze_charge: {
    id:           'blaze_charge',
    displayName:  'Blaze Charge',
    category:     'physical',
    element:      'fire',
    power:        40,
    auraCost:     25,
    accuracy:     90,
    canCrit:      true,
    learnLevel:   12,
    requiresTrueSoulBond: false,
    availableTo:  ['rare'],
    description:  'A full-body charge wreathed in flame. High impact.',
    isSyncBreak:  false,
  },

  flame_vortex: {
    id:           'flame_vortex',
    displayName:  'Flame Vortex',
    category:     'special',
    element:      'fire',
    power:        55,
    auraCost:     40,
    accuracy:     85,
    canCrit:      true,
    learnLevel:   20,
    requiresTrueSoulBond: false,
    availableTo:  ['rare'],
    description:  'A spiralling column of fire. Deals heavy Aura damage.',
    isSyncBreak:  false,
  },

  flame_guard: {
    id:           'flame_guard',
    displayName:  'Flame Guard',
    category:     'status',
    element:      'fire',
    power:        0,
    auraCost:     15,
    accuracy:     100,
    canCrit:      false,
    learnLevel:   8,
    requiresTrueSoulBond: false,
    availableTo:  ['rare'],
    description:  'Wraps Flarepaw in a burning aura that blocks and counters attacks.',
    isSyncBreak:  false,
  },

  aqua_ripple: {
    id:           'aqua_ripple',
    displayName:  'Aqua Ripple',
    category:     'special',
    element:      'water',
    power:        45,
    auraCost:     18,
    accuracy:     95,
    canCrit:      true,
    learnLevel:   5,
    requiresTrueSoulBond: false,
    availableTo:  ['common', 'uncommon'],
    description:  'A surging water pulse that hits from range.',
    isSyncBreak:  false,
  },

  guard: {
    id:           'guard',
    displayName:  'Guard',
    category:     'status',
    element:      'normal',
    power:        0,
    auraCost:     0,
    accuracy:     100,
    canCrit:      false,
    learnLevel:   0,
    requiresTrueSoulBond: false,
    availableTo:  ['common', 'uncommon', 'rare', 'super_rare', 'ultra_rare', 'legendary', 'mythic'],
    description:  'Brace for impact. Reduces incoming damage and recovers a small amount of Aura.',
    isSyncBreak:  false,
  },

  sync_fracture: {
    id:           'sync_fracture',
    displayName:  'Sync Fracture',
    category:     'sync_break',
    element:      'shadow',
    power:        15,
    auraCost:     30,
    accuracy:     80,
    canCrit:      false,
    learnLevel:   30,
    requiresTrueSoulBond: false,
    availableTo:  ['super_rare', 'ultra_rare', 'legendary', 'mythic'],
    description:  'Strikes at the Soul Sync bond. Heavily disrupts the target\'s Sync.',
    isSyncBreak:  true,
  },
};
