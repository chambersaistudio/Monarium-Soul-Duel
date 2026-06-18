# Monari Intake Review — V1 Data Flow

The private intake panel is an isolated frontend route at `/admin/monari-intake`. The HTML bootstrap selects the admin entry only for that exact pathname; all other paths continue to load the existing game entry. No admin link is added to game UI.

Open the panel at:

```text
http://localhost:3000/admin/monari-intake
```

On a deployed host, append the same exact path to the site origin, for example `https://example.com/admin/monari-intake`.

## Access gate

- Vite development enables the page for local review.
- A production build requires `VITE_ENABLE_ADMIN=true` at build time. Without it, the route renders **Admin disabled**.
- The flag must be present in the deployment provider's build environment before running `npm run build`; setting it only after the static bundle has been built will not enable the route.
- This is a visibility gate, not authentication. Add real authentication before deploying the tool for broader access.

## Canonical batch data

Batch 001 lives at:

```text
data/monari-intake/batches/batch_001.json
```

A focused Vite plugin serves that file at `/data/monari-intake/batches/batch_001.json` during development and copies it to the same relative location in the production build. The UI fetches this URL, then overlays browser-local edits from `localStorage` when present.

Edits are deliberately not written to the repository by the browser in V1. **Save** persists the complete batch only in that browser's localStorage. Clearing site data, changing browsers, or changing devices loses that working copy. **Export Updated JSON** downloads the permanent modified batch as `batch_001.json`; that file can directly replace the canonical JSON above. The exported object is normalized through the same shape used by the loader, and the page warns before navigation when unsaved edits exist. Saved browser data includes a signature of the canonical source; when a newly imported source has different row IDs or import metadata, the loader uses the new canonical file instead of hiding it behind stale localStorage.

## Current source availability

The checked-in file is explicitly marked with `"data_status": "sample"` because the authoritative Monarium Master Database spreadsheet and Batch 001 incoming image folders are not present in this repository or development workspace. It contains three UI fixtures, not the approximately 41 real intake rows.

Do not invent or extrapolate the missing Monari. Once the authoritative CSV is available, run the converter and replace `data/monari-intake/batches/batch_001.json`. The converter marks generated data as complete and records the converted row count. The admin loader supplies safe defaults for omitted optional cells, so spreadsheet-derived exports remain editable and re-exportable.

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
