// IS_TOUCH_DEVICE — true on real touch devices, or when ?touch=1 is in the URL
export const FORCE_TOUCH: boolean =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('touch');

export const IS_TOUCH_DEVICE: boolean =
  FORCE_TOUCH ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
