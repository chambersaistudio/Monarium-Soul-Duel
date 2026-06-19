ALTER TABLE monari_intake_entries
  ADD COLUMN IF NOT EXISTS codex_no INTEGER,
  ADD COLUMN IF NOT EXISTS codex_status TEXT,
  ADD COLUMN IF NOT EXISTS promoted_to_codex_at TIMESTAMPTZ;

DO $$
DECLARE
  bad_row_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO bad_row_count
    FROM monari_intake_entries
   WHERE codex_no IS NOT NULL AND codex_no <= 0;

  IF bad_row_count > 0 THEN
    RAISE NOTICE 'Normalizing % monari_intake_entries row(s) with non-positive codex_no to NULL. Bad rows: %',
      bad_row_count,
      (
        SELECT json_agg(row_to_json(bad_rows))
        FROM (
          SELECT id, approved_name, codex_no
          FROM monari_intake_entries
          WHERE codex_no IS NOT NULL AND codex_no <= 0
          ORDER BY id
        ) AS bad_rows
      );
  END IF;

  UPDATE monari_intake_entries
  SET codex_no = NULL
  WHERE codex_no IS NOT NULL AND codex_no <= 0;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'monari_intake_codex_number_check'
      AND conrelid = 'monari_intake_entries'::regclass
  ) THEN
    ALTER TABLE monari_intake_entries
      ADD CONSTRAINT monari_intake_codex_number_check
      CHECK (codex_no IS NULL OR codex_no > 0);
  END IF;
END $$;
