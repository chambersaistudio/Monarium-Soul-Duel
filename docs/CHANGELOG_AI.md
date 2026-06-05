# AI Changelog

Simple dated log for changes made by AI agents.
Keep entries short and focused on what changed, which agent made the change, and whether it affects gameplay, UI, assets, or docs.

## 2026-06-05

- Codex: Added AI collaboration workflow docs, ownership boundaries, UI contract, handoff template, and asset guide. Docs-only change.
- Claude: Guard is now ground-only — cannot activate while airborne; jumping blocked while guard is active. Files: `src/scenes/BattleScene.ts`.
- Claude: Flarepaw attack animation added — 4-frame PNG sequence (frame_054–058) plays once per press, no loop, returns to idle/run after. Hit frames frame_055+056 aligned to hitbox active window. Files: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `src/data/moveData.ts`.
