# Safe Tap + Scroll Interactions

Use `bindSafeTapActivation` from `src/ui/safeTap.ts` for any future scrollable UI list or grid that contains tappable cards/options.

## Why

On touch devices, users often start a scroll gesture directly on top of a card. UI should not select/open that card unless the gesture is a real intentional tap.

## Standard behavior

`bindSafeTapActivation` makes scrolling win over selection:

- Never activates on `pointerdown` / `touchstart`.
- Stores start X/Y and gesture start time.
- Treats movement over the threshold as scrolling/dragging.
- Activates only on `pointerup` if movement stayed below the threshold and the gesture was short.
- Keeps `Enter` / `Space` keyboard activation for accessibility.

Default thresholds:

- Movement threshold: `10px`
- Max tap duration: `650ms`

## Usage

```ts
import { bindSafeTapActivation } from './safeTap';

bindSafeTapActivation(cardEl, () => {
  openCardDetail(id);
});
```

Use this pattern for Codex lists, inventory lists, team selectors, technique lists, settings rows, and any future scrollable menu with interactive entries.
