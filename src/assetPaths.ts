/** Browser-facing paths for optional authored assets kept under public/. */
export const FLAREPAW_SHEET_PATHS = {
  /** Existing source sheet retained for asset-pipeline work. Do not load it in game because it has a white background. */
  source: '/assets/characters/flarepaw/flarepaw_sheet.png',
  /** Transparent 5-column by 4-row battle sheet used by the game. */
  transparent: '/assets/characters/flarepaw/flarepaw_sheet_transparent.png',
} as const;

/**
 * Keep the runtime pointed at the transparent sheet to avoid white-box artifacts.
 */
export const ACTIVE_FLAREPAW_SHEET_PATH = FLAREPAW_SHEET_PATHS.transparent;
