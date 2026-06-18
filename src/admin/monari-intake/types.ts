export const MONARI_STATUSES = ['incoming', 'drafted', 'needs_review', 'approved', 'in_game', 'rejected', 'archive'] as const;
export type MonariStatus = typeof MONARI_STATUSES[number];
export const MONARI_RARITIES = ['Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Legendary'] as const;
// Mirrors the current Codex registries without importing gameplay-owned modules into the admin bundle.
export const MONARI_ELEMENTS = ['Neutral', 'Fire', 'Water', 'Flora', 'Wind', 'Thunder', 'Stone', 'Steel', 'Light', 'Dark', 'Aether', 'Ice'] as const;
export const MONARI_TAXONOMIES = ['Wisp', 'Drake', 'Feral', 'Sylph', 'Golem', 'Seraph', 'Brute', 'Tempest', 'Chitin', 'Astral', 'Curio'] as const;
export const MONARI_ASSET_STATUSES = ['needs_individual_render', 'temporary_concept', 'ready', 'needs_cleanup', 'missing', 'final'] as const;

export interface MonariEntry {
  id: string;
  approved_name: string;
  slug: string;
  status: MonariStatus;
  rarity: string;
  element_1: string;
  element_2: string;
  taxonomy_primary: string;
  taxonomy_secondary: string;
  role: string;
  hp: number;
  aura: number;
  attack: number;
  special_attack: number;
  defense: number;
  special_defense: number;
  speed: number;
  ability_name: string;
  ability_description: string;
  ability_effect: string;
  ability_effect_tags: string;
  status_condition_suggestions: string;
  signature_moves: string;
  suggested_signature_moves: string;
  suggested_learnable_moves: string;
  description: string;
  habitat: string;
  personality: string;
  tags: string;
  review_notes: string;
  asset_status: string;
  confidence_score: number;
  image_path: string;
  source_filename: string;
  parent_sheet_filename: string;
  evolution_line_id: string;
  stage_number: number;
  evolves_from: string;
  evolves_to: string;
  updated_at: string;
}

export interface IntakeBatch {
  id: string;
  name: string;
  status: string;
  data_status?: 'sample' | 'complete';
  expected_entry_count?: number;
  imported_at: string;
  updated_at: string;
  source_filename: string;
  image_root: string;
  entries: MonariEntry[];
}
