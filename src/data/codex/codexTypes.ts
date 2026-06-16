export const CODEX_RARITIES = ['Common', 'Rare', 'Super Rare', 'Ancient', 'Legendary'] as const;
export type CodexRarity = typeof CODEX_RARITIES[number];

export const CODEX_ELEMENTS = [
  'Neutral', 'Fire', 'Water', 'Flora', 'Wind', 'Thunder', 'Stone', 'Steel',
  'Light', 'Dark', 'Aether', 'Ice', 'Void', 'Spirit',
] as const;
export type CodexElement = typeof CODEX_ELEMENTS[number];

export type TechniqueCategory = 'Physical' | 'Special' | 'Status' | 'Support' | 'Terrain';

export interface CodexBaseStats {
  health: number;
  aura: number;
  attack: number;
  specialAttack: number;
  defense: number;
  specialDefense: number;
  speed: number;
}

export interface CodexTags {
  elements: CodexElement[];
  speciesTraits: string[];
  bodyTraits: string[];
  roles: string[];
  habitats: string[];
  moveCompatibility: string[];
  rarity: CodexRarity[];
  personality: string[];
}

export interface CodexAssetPaths {
  codex: string;
  fullbody: string;
  portrait: string;
  icon: string;
  legacy?: string[];
}

export interface MonariCodexEntry {
  dexNo: string;
  slug: string;
  name: string;
  stage: number;
  evolutionLineId: string;
  evolvesFrom: string | null;
  evolvesTo: string | null;
  rarity: CodexRarity;
  elements: CodexElement[];
  role: string;
  primaryTaxonomy: Taxonomy;
  secondaryTaxonomy?: Taxonomy;
  description: string;
  height: string;
  weight: string;
  baseStats: CodexBaseStats;
  abilityIds: string[];
  signatureTechniqueIds: string[];
  learnableTechniqueIds: string[];
  tags: CodexTags;
  assetFolder: string;
  assetPaths: CodexAssetPaths;
}

export interface TechniqueEntry {
  id: string;
  name: string;
  element: CodexElement;
  category: TechniqueCategory;
  power: number;
  accuracy: number;
  auraCost: number;
  priority: number;
  description: string;
  visual: string;
  battleRole: string[];
  effectTags: string[];
  compatibleTags: string[];
  exclusiveToMonariIds?: string[];
}

export interface AbilityEntry {
  id: string;
  name: string;
  description: string;
  trigger: string;
  effects: string[];
  tags: string[];
  compatibleTags: string[];
  exclusiveToMonariIds?: string[];
}

export interface EvolutionLineEntry {
  evolutionLineId: string;
  entries: string[];
}

export type Taxonomy =
  | 'Wisp'
  | 'Drake'
  | 'Feral'
  | 'Sylph'
  | 'Golem'
  | 'Seraph'
  | 'Brute'
  | 'Tempest'
  | 'Chitin'
  | 'Astral';

export interface TaxonomyEntry {
  id: Taxonomy;
  description: string;
  commonTraits: string[];
}
