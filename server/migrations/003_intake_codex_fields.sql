ALTER TABLE monari_intake_entries
  ADD COLUMN IF NOT EXISTS codex_no INTEGER,
  ADD COLUMN IF NOT EXISTS codex_status TEXT,
  ADD COLUMN IF NOT EXISTS promoted_to_codex_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monari_intake_codex_number_check'
  ) THEN
    ALTER TABLE monari_intake_entries
      ADD CONSTRAINT monari_intake_codex_number_check
      CHECK (codex_no IS NULL OR codex_no > 0);
  END IF;
END $$;
