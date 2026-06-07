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

### 2026-06-07 — Universal character animation pipeline

#### Agent
Claude

#### Summary of What Changed
The sprite system is now fully universal. Any character/Monari can be added by dropping PNG folders under `public/assets/characters/[charId]/[animName]/` and running `npm run gen:manifest`. No PreloadScene or MinariFighter code changes needed for new characters.

Key changes:
- `tools/gen-manifest.js` — scans all character directories, writes per-character `sprite-manifest.json` AND unified `src/generated/characters-manifest.ts`
- `src/config/animationConfig.ts` — new human-editable config: `ANIM_CONFIG` (FPS + loop per folder), `JUMP_PHASE_CONFIG`, `DEFAULT_ANIM_CONFIG`. Idle slowed to 6fps. `aura_step` folder pre-wired.
- `src/scenes/PreloadScene.ts` — fully rewritten; loops over all chars in `CHARACTERS_MANIFEST`; animation keys are now `${charId}_${folder}`; texture keys are `${charId}_${folder}_${stem}`; normalised keys are `n_${rawKey}`
- `src/entities/MinariFighter.ts` — all hardcoded `flarepaw_*` animation keys replaced with `` `${this.fighterId}_*` ``; sprite loading no longer gated on `data.id === 'flarepaw'` — any character with frames gets a real sprite
- `src/generated/flarepaw-manifest.ts` — **deleted** (superseded by `characters-manifest.ts`)

#### New or Changed Game States
- No game state changes. All existing states (`idle`, `run`, `jump`, `guard`, etc.) work identically; the animation key convention changed but behavior is the same.

#### New or Changed Controls
- No input changes.

#### New or Changed Assets
- `src/generated/characters-manifest.ts` — auto-generated, replaces old `flarepaw-manifest.ts`
- `src/config/animationConfig.ts` — new human-editable file; edit to tune animation speeds
- To add a new character: drop PNG folders → run `npm run gen:manifest` → done

#### New Known Issues
- None introduced.

#### What UI May Need Next
- Any HUD that reads `flarepaw_*_loaded` registry keys should now read `${charId}_*_loaded` to support multiple characters
- When Droplet or Amari get real sprite frames, run `npm run gen:manifest` and they'll appear in game automatically

---

### 2026-06-07 — Aura Step dodge mechanic

#### Agent
Claude

#### Summary of What Changed
New evasive mechanic: **Aura Step**. While holding Guard, tap Left or Right to perform a quick lateral step with a brief invincibility window. Rewards perfect timing (stepping through an active enemy attack) with Aura and Soul Sync bonuses.

Files changed: `src/entities/MinariFighter.ts`, `src/scenes/BattleScene.ts`, `src/systems/InputSystem.ts`.

#### New or Changed Game States
- `dodge` state now used by both the existing L-key backstep and Aura Step.
- Guard entry is blocked while in `dodge` state (was a pre-existing gap — guard could override a dodge mid-motion).
- Dodge velocity is now preserved for its full 220ms duration; previously the movement block would zero it each frame.

#### New or Changed Controls
- **Guard (S/↓) held + Left tap**: Aura Step left — costs 15 Aura, 160ms i-frames, 500px/s step
- **Guard (S/↓) held + Right tap**: Aura Step right — same cost and timing
- **Perfect timing** (step while enemy melee hitbox is active): +12 Aura refund, +8 Soul Sync, shows "Perfect Step!"
- Cooldown: 1200ms per Aura Step (independent of L-key dodge cooldown)

#### New Getters on MinariFighter (read-only, safe for UI)
- `isInvincible: boolean` — true during the 160ms i-frame window
- `auraStepReady: boolean` — true when step cooldown is 0 and aura ≥ 15

#### New Known Issues
- No Aura Step animation yet (step visually shows run animation + i-frame flicker only).
- AI (Droplet) does not use Aura Step — it still uses `startDodge()` only.

#### What UI May Need Next
- Aura Step cooldown indicator: grey out a step icon for 1200ms after use
- `isInvincible` could drive a brief shield-flash or step-trail particle effect
- "Perfect Step!" announce text already fires — just needs HUD styling
- Mobile: a guard+swipe gesture could map to Aura Step

---

### 2026-06-07 — Manifest-driven sprite loader + hurt animation

#### Agent
Claude

#### Summary of What Changed
PreloadScene is now fully manifest-driven. `tools/gen-manifest.js` scans `public/assets/characters/flarepaw/` and writes `src/generated/flarepaw-manifest.ts`. PreloadScene imports that file and loads every frame from every folder at startup — no hardcoded filenames. When frames change, run `npm run gen:manifest` and the game picks them up automatically.

Bounding-box normalization upgraded: instead of scaling the full source canvas to 512×512 (which made 1440×1440 frames tiny), the normaliser does a fast 256px scan to locate opaque pixels, then crops to that content region before scaling to 512×512 with NORM_BASE=40px baseline margin.

New `flarepaw_hurt` animation (5 frames: frame_049–053) is now registered and wired into `syncAnim` using the same `hurtAnimPlaying` flag pattern as `attackAnimPlaying`. Jump state falls back gracefully to idle when no `jump` folder exists.

Files changed: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `tools/gen-manifest.js`, `src/generated/flarepaw-manifest.ts`, `package.json`.

#### New or Changed Game States
- `hurt` state: now plays `flarepaw_hurt` animation once (repeat:0), then returns to idle after 350ms timer. Previously showed no animation.
- Registry key added: `flarepaw_hurt_loaded` (boolean).
- Registry key added: `flarepaw_jump_loaded` (boolean).

#### New or Changed Controls
- No input changes.

#### New or Changed Assets
- All Flarepaw animation folders now use `frame_NNN.png` naming (video-extracted, skipped numbers OK).
- 6 animation folders active: `idle` (14f), `run` (8f), `attack` (4f), `hurt` (5f), `guard` (8f), `flame_guard` (20f).
- No `jump` folder yet — jump/fall states display idle animation.
- `src/generated/flarepaw-manifest.ts` — auto-generated TypeScript const, do not edit manually.
- To regenerate after adding new frames: `npm run gen:manifest`.

#### New Known Issues
- No jump-specific frames available. Jump/fall states show idle animation in air.
- When a jump folder is added, run `npm run gen:manifest` to pick it up.

#### What UI May Need Next
- Debug overlay now shows `frame:fpn_idle_frame_NNN` — useful for reviewing animation timing.
- Hurt animation is now visible; any screen-shake or impact VFX could be triggered off `state === 'hurt'`.

---

### 2026-06-05 — Flarepaw attack animation (4-frame PNG sequence)

#### Agent
Claude

#### Summary of What Changed
Flarepaw now plays a 4-frame sprite animation when the attack button is pressed. Animation plays once per press (no loop). Returns to idle/run/airborne state automatically. Hitbox active window aligned to frame_055 + frame_056.

Files changed: `src/scenes/PreloadScene.ts`, `src/entities/MinariFighter.ts`, `src/data/moveData.ts`.

#### New or Changed Game States
- `attacking` state: no new fields, but animation now driven by `attackAnimPlaying` flag internally. UI reads `state === 'attacking'` as before.

#### New or Changed Controls
- J (attack button): unchanged. Now visually plays the 4-frame attack sequence.

#### New or Changed Assets
- `public/assets/characters/flarepaw/attack/frame_054.png` — startup frame
- `public/assets/characters/flarepaw/attack/frame_055.png` — first active/hit frame
- `public/assets/characters/flarepaw/attack/frame_056.png` — second active/hit frame
- `public/assets/characters/flarepaw/attack/frame_058.png` — recovery frame
- Naming pattern: `frame_NNN.png` where NNN is a zero-padded video frame number; skipped numbers are allowed.
- Same 512×512 transparent PNG normalization as all other Flarepaw frames.
- Registry key added: `flarepaw_attack_loaded` (boolean).

#### New Known Issues
- None introduced.

#### What UI May Need Next
- Attack indicator or combo counter could read `state === 'attacking'` and `attackState.comboIndex` if exposed.
- Mobile attack button: no changes needed — same input path.
- If a hit-flash or impact effect is wanted on contact, the active hitbox window now aligns with frame_055+056 (~83–167ms after press).

---

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
