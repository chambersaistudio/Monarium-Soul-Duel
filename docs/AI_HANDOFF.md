# AI Handoff Template

Use this template when Claude hands gameplay, engine, animation, combat, or control changes to Codex for UI/HUD/menu/mobile follow-up.
Create a new dated entry below and keep the notes concise.

## Handoff Entry Template

### Date

YYYY-MM-DD

### Agent

Claude

### Summary of What Changed

- Briefly describe the gameplay, engine, animation, combat, control, or asset-related change.
- Include the affected player, enemy, state, move, system, or scene.
- Link or name the relevant PR/branch/commit if available.

### New or Changed Game States

- State name:
  - Meaning:
  - Possible values:
  - When it changes:
  - Whether UI may read it:

### New or Changed Controls

- Control input:
  - Action:
  - Context where it works:
  - Any lockout, cooldown, or interaction rule:

### New or Changed Assets

- Asset path:
  - Purpose:
  - Frame naming pattern:
  - Expected dimensions or alignment notes:
  - Transparency requirement:

### New Known Issues

- Issue:
  - Reproduction steps:
  - Current workaround, if any:
  - Whether UI should hide, label, or expose it:

### What UI May Need Next

- HUD updates:
- Menu or overlay updates:
- Mobile/responsive updates:
- Player-facing labels or tutorial copy:
- Any new read-only data Codex should request from gameplay logic:

## Handoff Log

### 2026-06-05

- Initial reusable handoff template added for Claude-to-Codex coordination.
- Codex UI follow-up note: the HUD can read and display selected special slot, current player state, guard active, and flame guard active from existing battle data. Training mode is documented in the UI contract, but no battle-scene read-only training-mode flag is currently exposed; Claude should expose a simple `trainingModeActive` value before Codex renders that indicator in battle.
