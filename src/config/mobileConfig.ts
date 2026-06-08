// IS_TOUCH_DEVICE — true on real touch devices, or when ?touch=1 is in the URL
export const FORCE_TOUCH: boolean =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('touch');

export const IS_TOUCH_DEVICE: boolean =
  FORCE_TOUCH ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

// SAFE_MODE — reduced asset loading for mobile.
// Active when IS_TOUCH_DEVICE, or when ?safe=1 / ?classicOnly=1 is in the URL.
// Forces desktop to use the mobile-safe load path for testing: ?safe=1
export const SAFE_MODE: boolean =
  IS_TOUCH_DEVICE ||
  (typeof location !== 'undefined' && (
    new URLSearchParams(location.search).has('safe') ||
    new URLSearchParams(location.search).has('classicOnly')
  ));

// Animation folders that are NOT needed for Classic Soul Duel — skipped in safe mode.
// Flarepaw's flame_guard alone is 20 frames × 8.3 MB = 166 MB; skipping it is critical.
export const SAFE_SKIP_FOLDERS = new Set([
  'flame_guard',
  'jump', 'jump_start', 'jump_air', 'jump_forward', 'jump_fall', 'land',
  'frames',
]);

// Max frames per animation folder in safe mode (evenly spaced from the full set).
// 4 frames × 5 folders × 8.3 MB ≈ 166 MB for flarepaw — within iOS Safari limits.
export const SAFE_MAX_FRAMES = 4;
