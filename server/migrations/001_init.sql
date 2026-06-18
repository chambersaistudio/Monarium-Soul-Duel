CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS monari_intake_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_review',
  source_type TEXT,
  source_label TEXT,
  expected_entry_count INTEGER,
  actual_entry_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monari_intake_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES monari_intake_batches(id) ON DELETE CASCADE,
  entry_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'incoming',
  source_filename TEXT, parent_sheet_filename TEXT,
  image_path TEXT, image_url TEXT, pending_image_path TEXT,
  approved_name TEXT, slug TEXT, dex_no INTEGER, stage INTEGER,
  evolves_from TEXT, evolves_to TEXT, evolution_line_id TEXT,
  rarity TEXT, element_1 TEXT, element_2 TEXT,
  taxonomy_primary TEXT, taxonomy_secondary TEXT, role TEXT,
  hp INTEGER, aura INTEGER, attack INTEGER, special_attack INTEGER,
  defense INTEGER, special_defense INTEGER, speed INTEGER,
  ability_name TEXT, ability_description TEXT, ability_effect TEXT,
  ability_effect_tags TEXT, status_condition_suggestions TEXT,
  suggested_signature_moves TEXT, suggested_learnable_moves TEXT,
  description TEXT, habitat TEXT, personality TEXT, tags TEXT,
  confidence DOUBLE PRECISION, review_notes TEXT, asset_status TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, entry_key),
  CONSTRAINT valid_rarity CHECK (rarity IS NULL OR rarity IN ('Common','Rare','Super Rare','Ultra Rare','Legendary')),
  CONSTRAINT valid_element_1 CHECK (element_1 IS NULL OR element_1 IN ('Neutral','Fire','Water','Flora','Wind','Thunder','Stone','Steel','Light','Dark','Aether','Ice')),
  CONSTRAINT valid_element_2 CHECK (element_2 IS NULL OR element_2 IN ('Neutral','Fire','Water','Flora','Wind','Thunder','Stone','Steel','Light','Dark','Aether','Ice'))
);

CREATE INDEX IF NOT EXISTS monari_intake_entries_batch_id_idx ON monari_intake_entries(batch_id);
CREATE INDEX IF NOT EXISTS monari_intake_entries_status_idx ON monari_intake_entries(status);
