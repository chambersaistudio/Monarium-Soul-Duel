# Monarium Studio Backend API V1

The isolated `server/` service is the Railway deployment root. It does not serve or bundle the game frontend.

## Railway

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Run `npm run migrate` once against the Railway PostgreSQL database before importing data.

Copy `server/.env.example` into Railway's environment configuration and replace every placeholder. Secrets belong only in Railway. The Vercel frontend receives only `VITE_MONARIUM_ADMIN_API_URL`; it prompts for the private admin key at runtime and retains it in `sessionStorage`.

## Import Batch 001

From `server/`, after the migration:

```sh
npm run import:batch -- ../data/monari-intake/batches/batch_001.json
```

Imports upsert the batch by `batch_key` and entries by `(batch_id, entry_key)`, preserve each source row in `raw_json`, and normalize legacy rarity and element values.

## Admin modes

- Without `VITE_MONARIUM_ADMIN_API_URL`, `/admin/monari-intake` continues to load local JSON, save to `localStorage`, and export updated JSON.
- With `VITE_MONARIUM_ADMIN_API_URL`, the panel reads and writes Railway data. Image replacement requests a five-minute signed upload URL, uploads directly to R2, then attaches the public URL to the entry.
- Export Updated JSON remains available in both modes.

All intake API routes require `x-admin-secret`. `GET /health` is public and verifies database connectivity.
