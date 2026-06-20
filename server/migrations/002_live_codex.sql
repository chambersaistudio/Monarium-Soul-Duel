ALTER TABLE monari_intake_entries
  ADD COLUMN IF NOT EXISTS codex_no INTEGER,
  ADD COLUMN IF NOT EXISTS slug_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promoted_to_codex_at TIMESTAMPTZ;

UPDATE monari_intake_entries
SET codex_no = NULL
WHERE codex_no IS NOT NULL AND codex_no <= 0;

UPDATE monari_intake_entries
SET codex_no = CASE
  WHEN dex_no IS NULL THEN NULL
  WHEN dex_no <= 0 THEN NULL
  ELSE dex_no
END
WHERE codex_no IS NULL AND dex_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS monari_codex_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_entry_id UUID UNIQUE REFERENCES monari_intake_entries(id) ON DELETE SET NULL,
  codex_no INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  rarity TEXT,
  element_1 TEXT,
  element_2 TEXT,
  taxonomy_primary TEXT,
  taxonomy_secondary TEXT,
  role TEXT,
  stage INTEGER,
  evolves_from TEXT,
  evolves_to TEXT,
  evolution_line_id TEXT,
  hp INTEGER,
  aura INTEGER,
  attack INTEGER,
  special_attack INTEGER,
  defense INTEGER,
  special_defense INTEGER,
  speed INTEGER,
  ability_name TEXT,
  ability_description TEXT,
  ability_effect TEXT,
  signature_moves TEXT,
  description TEXT,
  habitat TEXT,
  personality TEXT,
  tags TEXT,
  image_url TEXT,
  image_path TEXT,
  asset_status TEXT,
  discovered_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  silhouette_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  public_spoiler_level TEXT NOT NULL DEFAULT 'standard',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monari_codex_status_check CHECK (status IN ('draft','approved','published','needs_review','hidden')),
  CONSTRAINT monari_codex_number_check CHECK (codex_no IS NULL OR codex_no > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS monari_codex_slug_unique_idx
  ON monari_codex_entries (slug);
CREATE UNIQUE INDEX IF NOT EXISTS monari_codex_number_unique_idx
  ON monari_codex_entries (codex_no)
  WHERE codex_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS monari_codex_status_idx
  ON monari_codex_entries (status);
