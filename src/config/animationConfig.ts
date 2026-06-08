export interface AnimConfig {
  frameRate: number;
  repeat: number;      // -1 = loop forever, 0 = play once and hold last frame
  fallback?: string;   // folder name to display when this folder has no frames
}

// ── Per-folder defaults shared across ALL characters ──────────────────────────
// Edit these to tune animation speeds without touching PreloadScene.
// Keys match animation folder names: 'idle' → '<charId>_idle' in Phaser.
//
// 'jump' is not listed here — it is split into three phase-animations by
// PreloadScene (takeoff / air / land).  See JUMP_PHASE_CONFIG below.
export const ANIM_CONFIG: Record<string, AnimConfig> = {
  idle:         { frameRate: 6,  repeat: -1             },   // slow breathing cycle
  run:          { frameRate: 12, repeat: -1             },   // smooth loop
  attack:       { frameRate: 12, repeat: 0,  fallback: 'idle' },
  hurt:         { frameRate: 12, repeat: 0,  fallback: 'idle' },
  guard:        { frameRate: 8,  repeat: -1, fallback: 'idle' },
  flame_guard:  { frameRate: 12, repeat: -1, fallback: 'guard' },
  aura_step:    { frameRate: 14, repeat: 0,  fallback: 'idle' },
  jump_start:   { frameRate: 12, repeat: 0  },   // play once when leaving ground
  jump_air:     { frameRate: 6,  repeat: -1 },   // loop while floating at apex
  jump_forward: { frameRate: 10, repeat: -1 },   // loop while moving horizontally in air
  jump_fall:    { frameRate: 6,  repeat: -1 },   // loop while descending
  land:         { frameRate: 12, repeat: 0  },   // play once on ground contact
  // Add future folders here — they auto-wire when the PNG folder is dropped in.
};

// ── Jump phase animation timings ──────────────────────────────────────────────
// Applied to all characters that have a legacy 'jump' animation folder.
export const JUMP_PHASE_CONFIG = {
  takeoff: { frameRate: 14, repeat: 0  },   // first 2 frames, plays once
  air:     { frameRate: 1,  repeat: -1 },   // middle frame(s), held until landing
  land:    { frameRate: 1,  repeat: 0  },   // last frame, plays once
} as const;

// ── Fallback for unrecognised folders (custom Monari abilities) ───────────────
export const DEFAULT_ANIM_CONFIG: AnimConfig = { frameRate: 10, repeat: -1 };
