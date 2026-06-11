import './OverworldDialogueOverlay.css';

// 200 ms guard: prevents the same tap that opens dialogue from immediately
// advancing it.
const ADVANCE_GUARD_MS = 200;

// ─────────────────────────────────────────────────────────────────────────────

export class OverworldDialogueOverlay {
  private root:        HTMLDivElement;
  private portraitImg: HTMLImageElement;
  private speakerEl:   HTMLSpanElement;
  private bodyEl:      HTMLParagraphElement;
  private hintEl:      HTMLSpanElement;

  private advanceCb:    (() => void) | null = null;
  private guardTimer:   ReturnType<typeof setTimeout> | null = null;
  private inputReady    = false;

  // Bound listener refs so we can remove them cleanly
  private pointerHandler: (e: PointerEvent) => void;
  private keyHandler:     (e: KeyboardEvent) => void;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'owdlg';
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');

    const panel = this.buildPanel();
    this.root.appendChild(panel);

    // Keep refs assigned during buildPanel
    this.portraitImg = panel.querySelector<HTMLImageElement>('.owdlg__portrait-img')!;
    this.speakerEl   = panel.querySelector<HTMLSpanElement>('.owdlg__speaker-name')!;
    this.bodyEl      = panel.querySelector<HTMLParagraphElement>('.owdlg__body')!;
    this.hintEl      = panel.querySelector<HTMLSpanElement>('.owdlg__hint')!;

    // Pointer / key handlers (bound once, re-used)
    this.pointerHandler = (e: PointerEvent) => {
      if (!this.inputReady || !this.advanceCb) return;
      e.stopPropagation();
      this.advanceCb();
    };
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.inputReady || !this.advanceCb) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.advanceCb();
      }
    };

    document.body.appendChild(this.root);
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'owdlg__panel';

    // Portrait
    const portraitWrap = document.createElement('div');
    portraitWrap.className = 'owdlg__portrait-wrap';

    const img = document.createElement('img');
    img.className = 'owdlg__portrait-img';
    img.alt = '';
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => { img.style.display = 'none'; });
    portraitWrap.appendChild(img);

    // Text area
    const textArea = document.createElement('div');
    textArea.className = 'owdlg__text-area';

    const speakerSpan = document.createElement('span');
    speakerSpan.className = 'owdlg__speaker-name';

    const bodyP = document.createElement('p');
    bodyP.className = 'owdlg__body';

    textArea.appendChild(speakerSpan);
    textArea.appendChild(bodyP);

    // Advance hint
    const hint = document.createElement('span');
    hint.className = 'owdlg__hint';
    hint.textContent = 'TAP TO CONTINUE';

    panel.appendChild(portraitWrap);
    panel.appendChild(textArea);
    panel.appendChild(hint);
    return panel;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  show(speakerId: string, speakerName: string, text: string, hasMore: boolean): void {
    // Reset portrait
    this.portraitImg.style.display = '';
    this.portraitImg.src = `assets/characters/${speakerId}/portraits/neutral.png`;

    this.speakerEl.textContent = speakerName;
    this.bodyEl.textContent    = text;

    // Advance hint
    this.hintEl.textContent = hasMore ? 'TAP TO CONTINUE' : 'TAP TO CLOSE';
    this.hintEl.classList.toggle('owdlg__hint--hidden', false);

    // Make visible
    this.root.classList.add('owdlg--visible');

    // Guard: block input for ADVANCE_GUARD_MS to prevent same-tap advance
    this.inputReady = false;
    if (this.guardTimer !== null) clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => {
      this.inputReady = true;
      this.guardTimer = null;
    }, ADVANCE_GUARD_MS);
  }

  hide(): void {
    this.root.classList.remove('owdlg--visible');
    this.inputReady = false;
    if (this.guardTimer !== null) {
      clearTimeout(this.guardTimer);
      this.guardTimer = null;
    }
  }

  setOnAdvance(cb: () => void): void {
    // Remove any existing listeners first
    this.clearOnAdvance();
    this.advanceCb = cb;
    this.root.addEventListener('pointerdown', this.pointerHandler);
    document.addEventListener('keydown', this.keyHandler);
  }

  clearOnAdvance(): void {
    this.advanceCb = null;
    this.root.removeEventListener('pointerdown', this.pointerHandler);
    document.removeEventListener('keydown', this.keyHandler);
  }

  destroy(): void {
    this.clearOnAdvance();
    if (this.guardTimer !== null) {
      clearTimeout(this.guardTimer);
      this.guardTimer = null;
    }
    this.root.remove();
  }
}
