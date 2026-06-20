ALTER TABLE monari_codex_entries
  DROP CONSTRAINT IF EXISTS monari_codex_status_check;

ALTER TABLE monari_codex_entries
  ADD CONSTRAINT monari_codex_status_check
  CHECK (status IN ('draft','active','approved','published','needs_review','hidden','removed'));
