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

### 2026-06-05 — Guard ground-only restriction

#### Agent
Claude

#### Summary of What Changed
Guard can no longer be activated while Flarepaw is airborne. Jumping is blocked while guard state is active. Both changes are in `src/scenes/BattleScene.ts` `handlePlayerInput()`.

#### New or Changed Game States
- No new states added.
- Existing `guard` state now has an additional precondition: `isGrounded` must be true to enter it.

#### New or Changed Controls
- DOWN / S to enter guard: now only works when grounded. Mid-air presses are ignored.
- UP (jump): now blocked when `state === 'guard'`. Must release guard before jumping.

#### New or Changed Assets
- None.

#### New Known Issues
- None introduced.

#### What UI May Need Next
- Guard indicator (if any) only needs to show when player is grounded — it will never be active mid-air.
- Mobile guard button can be visually disabled or greyed while player is airborne.

---

### 2026-06-05

- Initial reusable handoff template added for Claude-to-Codex coordination.
