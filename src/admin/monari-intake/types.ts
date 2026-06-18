export const MONARI_STATUSES = ['incoming', 'drafted', 'needs_review', 'approved', 'in_game', 'rejected', 'archive'] as const;
export type MonariStatus = typeof MONARI_STATUSES[number];

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
  ability: string;
  signature_moves: string;
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
