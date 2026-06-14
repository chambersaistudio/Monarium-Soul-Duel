import type { TechniqueEntry } from './codexTypes';

export const TECHNIQUE_REGISTRY: Record<string, TechniqueEntry> = {
  'leaf-guard': {
    id: 'leaf-guard',
    name: 'Leaf Guard',
    element: 'Flora',
    category: 'Support',
    power: 0,
    accuracy: 100,
    auraCost: 18,
    priority: 0,
    description: 'Bloomhart surrounds an ally with a rotating barrier of enchanted leaves. The leaves reduce incoming damage, gradually restore health, and can launch themselves at nearby attackers when threatened.',
    visual: 'A green aura forms around the target while glowing leaves orbit around them like protective satellites.',
    battleRole: ['Small healing over time', 'Minor damage reduction', 'Reactive projectile leaves'],
    effectTags: ['Healing', 'Damage Reduction', 'Reactive', 'Barrier'],
    compatibleTags: ['Flora', 'Support', 'Healer', 'Barrier'],
    exclusiveToMonariIds: ['bloomhart'],
  },
  'forest-blessing': {
    id: 'forest-blessing',
    name: 'Forest Blessing',
    element: 'Flora',
    category: 'Terrain',
    power: 0,
    accuracy: 100,
    auraCost: 28,
    priority: 0,
    description: 'Bloomhart transforms the battlefield into a flourishing sanctuary. Healing spores, flower petals, and natural energy linger in the environment, continuously restoring allied Monari and empowering Flora-based techniques.',
    visual: 'Grass spreads across the ground, flowers bloom, and glowing petals drift through the air for several turns.',
    battleRole: ['Creates terrain effect', 'Passive healing for allies', 'Boosts Flora techniques', 'Remains active even after Bloomhart is recalled'],
    effectTags: ['Terrain', 'Healing', 'Flora Boost', 'Persistent'],
    compatibleTags: ['Flora', 'Terrain', 'Support', 'Healer'],
    exclusiveToMonariIds: ['bloomhart'],
  },
};

export const TECHNIQUES = Object.values(TECHNIQUE_REGISTRY);
