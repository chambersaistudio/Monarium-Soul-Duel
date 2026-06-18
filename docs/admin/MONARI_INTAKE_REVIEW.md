# Monari Intake Review — V1 Data Flow

The private intake panel is an isolated frontend route at `/admin/monari-intake`. The HTML bootstrap selects the admin entry only for that exact pathname; all other paths continue to load the existing game entry. No admin link is added to game UI.

## Access gate

- Vite development enables the page for local review.
- A production build requires `VITE_ENABLE_ADMIN=true` at build time. Without it, the route renders **Admin disabled**.
- This is a visibility gate, not authentication. Add real authentication before deploying the tool for broader access.

## Canonical batch data

Batch 001 lives at:

```text
data/monari-intake/batches/batch_001.json
```

A focused Vite plugin serves that file at `/data/monari-intake/batches/batch_001.json` during development and copies it to the same relative location in the production build. The UI fetches this URL, then overlays browser-local edits from `localStorage` when present.

Edits are deliberately not written to the repository by the browser in V1. **Save** persists the complete batch in localStorage. **Export Updated JSON** downloads the complete modified batch so it can replace the canonical JSON after review. The page warns before navigation when unsaved edits exist.

## CSV import

Convert a CSV export with:

```bash
npx tsx tools/convert-monari-intake.ts data/monari-intake/source/Monarium_Master_Database_Batch001.csv data/monari-intake/batches/batch_001.json
```

The converter preserves matching column names and supplies batch metadata, IDs, statuses, and timestamps where needed. V1 intentionally does not add an XLSX parsing dependency: export XLSX as CSV first.

## Image paths

Store browser-visible paths such as:

```text
/assets/monari/_incoming/batch_001/evolution_sheets/example.png
```

Existing standalone/reference paths also work. A failed image request switches to the built-in placeholder and displays **Image missing** without interrupting review.

## Phase 2 boundaries

Google Drive access available to a development agent does not grant runtime access to the app. A later `/admin/data-sources` area can add published CSV URLs, manual uploads, or authenticated Google APIs. V1 has no OAuth, private Drive synchronization, live spreadsheet writes, image editing, or game Codex import.
