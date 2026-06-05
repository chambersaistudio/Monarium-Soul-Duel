# UI Contract

This document defines the boundary between gameplay logic and UI presentation.
Claude owns gameplay/engine behavior. Codex owns UI/HUD/menu/mobile presentation polish.

## Core Rule

UI may read gameplay state and render it, but UI must not directly mutate gameplay state.
When UI needs new information or a new interaction, request a small read-only selector, event, command, or documented interface from gameplay logic instead of editing internals.

## UI May Read

The UI may read stable, presentation-oriented state such as:

- Player HP and opponent HP
- Player Aura and opponent Aura
- Current animation state
- Guard active state
- Flame guard active state
- Training mode enabled or disabled
- Round, match, or encounter status when exposed by gameplay logic
- Cooldowns, lockouts, prompts, or labels when exposed as read-only values
- Input hints or tutorial state when exposed for presentation

## UI Must Never Mutate Directly

The UI must not directly write or patch:

- HP, damage, healing, or defeat state
- Aura gain, Aura spend, or Aura caps
- Current animation state or animation frame index
- Guard or flame guard activation flags
- Training mode behavior or gameplay rules
- Movement, velocity, facing, position, collision, or gravity values
- Attack, hitbox, hurtbox, knockback, stun, or combo state
- Controller/input state owned by gameplay logic
- Sprite/frame loading data
- Any protected gameplay file listed in `AGENTS.md`

## Requesting New Data From Gameplay Logic

When Codex needs new UI data:

1. Document the need in `docs/AI_HANDOFF.md` or the PR description.
2. Describe the exact UI question, for example: "Should the HUD show flame guard as active?"
3. Ask Claude to expose a read-only value, selector, event payload, or command result.
4. Keep the returned data simple and presentation-friendly.
5. Do not infer hidden gameplay state by reading private internals, frame counters, or asset paths.

Preferred patterns:

- Read-only selectors for HUD values.
- Event payloads for transient UI notifications.
- Commands for user-intent requests, with gameplay logic deciding whether the command succeeds.
- Plain data structures that do not expose mutable engine objects.

## Requesting UI-Initiated Actions

When UI needs a button, menu item, or mobile control to trigger gameplay behavior:

- UI should send intent, not mutate state.
- Gameplay logic should validate the intent.
- Gameplay logic should own cooldowns, costs, lockouts, and state transitions.
- UI should render success, failure, or disabled state based on read-only data returned by gameplay logic.

Examples:

- UI may request "toggle training mode" through a gameplay-owned command.
- UI may request "activate guard" through an input/command path owned by gameplay logic.
- UI may display HP, Aura, current animation state, guard active, flame guard active, and training mode after gameplay exposes them.

## Current Known Presentation States

The following states are currently expected to be useful for UI presentation:

| State | UI Use | Mutation Owner |
| --- | --- | --- |
| HP | Health bars, damage feedback, defeat messaging | Gameplay logic |
| Aura | Aura meter, ability readiness, cost messaging | Gameplay logic |
| Current animation state | Debug labels, move labels, animation-aware HUD hints | Gameplay logic |
| Guard active | Guard indicator, tutorial prompts, mobile button state | Gameplay logic |
| Flame guard active | Flame guard indicator, effects labels, mobile button state | Gameplay logic |
| Training mode | Training badge, debug/testing HUD, tutorial messaging | Gameplay logic |

## Conflict Avoidance

- UI work should not edit gameplay files to make a value easier to display.
- Gameplay work should not redesign HUD, menus, or mobile presentation as part of a combat change.
- If a change requires both sides, split it into a gameplay PR and a UI PR with a handoff note.
