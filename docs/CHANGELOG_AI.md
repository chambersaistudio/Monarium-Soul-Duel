# AI Changelog

Simple dated log for changes made by AI agents.
Keep entries short and focused on what changed, which agent made the change, and whether it affects gameplay, UI, assets, or docs.

## 2026-06-07 (Aura Step)

- Claude: Added Aura Step dodge mechanic. Input: Guard (held) + Left/Right (tapped). Costs 15 Aura, grants 160ms i-frames, 500px/s lateral velocity for 220ms. Perfect timing (stepping through an active enemy hitbox) refunds 12 Aura and +8 Soul Sync. Projectiles pass through player during i-frames. Guard entry now blocked while dodging (fixes guard spam over dodge). Dodge velocity preserved for full duration (fixes dodge-stops-instantly bug). Debug overlay shows step cooldown and i-frame timer. Files: `src/entities/MinariFighter.ts`, `src/scenes/BattleScene.ts`, `src/systems/InputSystem.ts`.

## 2026-06-07

- Claude: Self-healing animation loader — PreloadScene now builds animations from frames that actually loaded rather than requiring all manifest frames to succeed. Deleted frames are skipped with a console warning instead of disabling the whole animation. Loader also logs resolved frame list per animation on startup. `gen-manifest.js` now writes `public/assets/characters/flarepaw/sprite-manifest.json` (runtime JSON manifest) in addition to the TypeScript file; PreloadScene loads and prefers it so deleted frames aren't even attempted after re-running gen:manifest. Updated run manifest: frame_020 removed (7 run frames remain). Files: `src/scenes/PreloadScene.ts`, `tools/gen-manifest.js`, `src/generated/flarepaw-manifest.ts`, `public/assets/characters/flarepaw/sprite-manifest.json`.
- Claude: Manifest-driven sprite loader — replaced hardcoded frame filenames with auto-generated manifest (`src/generated/flarepaw-manifest.ts` via `tools/gen-manifest.js`). PreloadScene now loads all frames in every animation folder dynamically. Bounding-box-aware normalization handles 1440×1440 video-extracted frames — scans at ≤256px resolution to locate the character, then scales only that content region into 512×512. Added `flarepaw_hurt` animation (5 frames). Jump state falls back to idle when no jump frames present. Debug overlay now shows frame key and loaded frame count. Files: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `tools/gen-manifest.js`, `src/generated/flarepaw-manifest.ts`, `package.json`.

## 2026-06-05

- Codex: Added AI collaboration workflow docs, ownership boundaries, UI contract, handoff template, and asset guide. Docs-only change.
- Claude: Guard is now ground-only — cannot activate while airborne; jumping blocked while guard is active. Files: `src/scenes/BattleScene.ts`.
- Claude: Flarepaw attack animation added — 4-frame PNG sequence (frame_054–058) plays once per press, no loop, returns to idle/run after. Hit frames frame_055+056 aligned to hitbox active window. Files: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `src/data/moveData.ts`.
