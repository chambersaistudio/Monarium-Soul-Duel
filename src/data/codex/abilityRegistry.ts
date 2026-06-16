import type { AbilityEntry } from './codexTypes';

export const ABILITY_REGISTRY: Record<string, AbilityEntry> = {
  'forest-heart': {
    id: 'forest-heart',
    name: 'Forest Heart',
    description: 'Boosts healing effects while terrain effects are active.',
    trigger: 'Terrain active',
    effects: ['Healing effects increased', 'Flora technique stability increased'],
    tags: ['Flora', 'Healing', 'Terrain'],
    compatibleTags: ['Flora', 'Support', 'Healer'],
    exclusiveToMonariIds: ['bloomhart'],
  },
};

export const ABILITIES = Object.values(ABILITY_REGISTRY);
