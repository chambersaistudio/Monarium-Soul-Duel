# Agent Collaboration Rules

This repository uses two AI coding agents with intentionally separate areas of ownership.
Keep changes small, focused, and easy to merge.

## Source of Truth

- Start work from the latest official working branch used by Claude as the gameplay source of truth.
- Treat Claude's gameplay/engine branch as authoritative for combat, movement, animation, and controller behavior.
- If branch state is unclear, stop and confirm before making logic changes.

## Ownership Boundaries

### Claude owns gameplay and engine logic

Claude is responsible for:

- Gameplay state machines
- Combat logic
- Movement, physics, and collision behavior
- Animation sequencing and frame timing
- Sprite/frame loading behavior
- Controller and input behavior
- Training-mode gameplay behavior
- Any changes to protected gameplay files

### Codex owns UI and frontend polish

Codex is responsible for:

- HUD layout and presentation
- Menus, overlays, and labels
- Responsive and mobile presentation polish
- Non-gameplay UI affordances
- Documentation for UI contracts and AI handoff workflow

Codex should consume gameplay state through stable interfaces instead of changing gameplay internals.

## Protected Files and Areas

Do not touch protected files or areas unless the user explicitly instructs you to do so in the current task.
Protected files and areas include:

- `src/painter.ts`
- `src/main.ts`
- Animation files
- Sprite/frame loading files
- Controller files
- Combat logic files
- Package files such as `package.json` and lockfiles
- Image, audio, video, or other media files
- Binary files of any kind

Do not modify binary, image, or media files unless explicitly instructed.

## Animation and Asset Rules

- Never reintroduce sprite-sheet slicing.
- Use individual transparent PNG frame folders for animations.
- Keep frame folder names stable and descriptive.
- Preserve the spellings `guard` and `flame_guard` in paths, file names, docs, and UI labels.
- Do not use misspellings such as `gaurd` or `flame_gaurd`.

## Documentation and README Rules

- Avoid README edits unless the user specifically asks for them.
- Prefer focused docs under `docs/` for AI workflow, UI contracts, assets, and handoff notes.
- Keep documentation factual and update it when a change affects AI collaboration.

## Pull Request Rules

- Keep PRs small and low-conflict.
- Do not mix gameplay changes with UI polish changes unless explicitly requested.
- Do not mix docs-only workflow changes with runtime code changes.
- Clearly state which agent ownership area the PR affects.

## Verification

Before finishing, run an appropriate build or test command for the change.
For docs-only changes, run the normal project build when available to ensure the repository still builds.
