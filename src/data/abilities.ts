export interface MonariAbility {
  id: string;
  name: string;
  description: string;
  trigger: 'passive' | 'low_hp' | 'high_aura';
}

export const MONARI_ABILITIES: Record<string, MonariAbility> = {
  flarepaw: {
    id: 'magma_forge',
    name: 'Magma Forge',
    description: 'When HP drops below 30%, Fire ATK, Sp. ATK, and Speed sharply increase for the rest of the battle.',
    trigger: 'low_hp',
  },
  sproutodon: {
    id: 'rooted_guardian',
    name: 'Rooted Guardian',
    description: 'When HP drops below 30%, Defense and Sp. Def sharply increase. Immune to knockback effects.',
    trigger: 'low_hp',
  },
  droplet: {
    id: 'flow_state',
    name: 'Flow State',
    description: 'While Aura exceeds 60%, Accuracy and Speed are boosted. Aura-fueled techniques gain bonus power.',
    trigger: 'high_aura',
  },
  umbravine: {
    id: 'shadow_veil',
    name: 'Shadow Veil',
    description: 'Dark-type techniques have a chance to lower the target\'s Accuracy. Evasion increases slightly in darkness.',
    trigger: 'passive',
  },
};
