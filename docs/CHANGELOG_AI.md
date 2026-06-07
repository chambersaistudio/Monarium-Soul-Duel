# AI Changelog

Simple dated log for changes made by AI agents.
Keep entries short and focused on what changed, which agent made the change, and whether it affects gameplay, UI, assets, or docs.

## 2026-06-07

- Claude: Manifest-driven sprite loader — replaced hardcoded frame filenames with auto-generated manifest (`src/generated/flarepaw-manifest.ts` via `tools/gen-manifest.js`). PreloadScene now loads all frames in every animation folder dynamically. Bounding-box-aware normalization handles 1440×1440 video-extracted frames — scans at ≤256px resolution to locate the character, then scales only that content region into 512×512. Added `flarepaw_hurt` animation (5 frames). Jump state falls back to idle when no jump frames present. Debug overlay now shows frame key and loaded frame count. Files: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `tools/gen-manifest.js`, `src/generated/flarepaw-manifest.ts`, `package.json`.

## 2026-06-05

- Codex: Added AI collaboration workflow docs, ownership boundaries, UI contract, handoff template, and asset guide. Docs-only change.
- Claude: Guard is now ground-only — cannot activate while airborne; jumping blocked while guard is active. Files: `src/scenes/BattleScene.ts`.
- Claude: Flarepaw attack animation added — 4-frame PNG sequence (frame_054–058) plays once per press, no loop, returns to idle/run after. Hit frames frame_055+056 aligned to hitbox active window. Files: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `src/data/moveData.ts`.
