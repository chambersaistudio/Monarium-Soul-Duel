export interface SafeTapOptions {
  /** Movement beyond this distance is treated as scroll/drag, not a tap. */
  moveThresholdPx?: number;
  /** Gestures longer than this are ignored as selection taps. */
  maxTapMs?: number;
  /** Optional selector/class hook for future selected/highlight-only behavior. */
  highlightClass?: string;
}

export interface SafeTapBinding {
  destroy: () => void;
}

const DEFAULT_MOVE_THRESHOLD_PX = 10;
const DEFAULT_MAX_TAP_MS = 650;

/**
 * Bind a scroll-safe activation gesture to an interactive element.
 *
 * Use this for cards/options that live inside scrollable panels. It intentionally
 * does NOT activate on pointerdown/touchstart. Selection happens only after a
 * confirmed short tap on pointerup, while scroll/drag movement always wins.
 */
export function bindSafeTapActivation(
  el: HTMLElement,
  onTap: () => void,
  options: SafeTapOptions = {},
): SafeTapBinding {
  const moveThresholdPx = options.moveThresholdPx ?? DEFAULT_MOVE_THRESHOLD_PX;
  const maxTapMs = options.maxTapMs ?? DEFAULT_MAX_TAP_MS;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let dragging = false;
  let pointerId: number | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
    startTime = performance.now();
    dragging = false;
    pointerId = e.pointerId;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > moveThresholdPx || dy > moveThresholdPx) dragging = true;
  };

  const onPointerCancel = (): void => {
    dragging = true;
    pointerId = null;
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    const elapsed = performance.now() - startTime;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    const isTap = !dragging && dx <= moveThresholdPx && dy <= moveThresholdPx && elapsed <= maxTapMs;
    pointerId = null;
    if (!isTap) return;
    if (options.highlightClass) el.classList.add(options.highlightClass);
    e.preventDefault();
    onTap();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onTap();
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('keydown', onKeyDown);

  return {
    destroy: () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('keydown', onKeyDown);
    },
  };
}
