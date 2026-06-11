import './OverworldHudOverlay.css';

// ── Public state type ─────────────────────────────────────────────────────────

export interface OverworldHUDState {
  playerName: string;
  locationName: string;
  starterName: string;   // "Choose a starter" if none selected
  soulRank: number;
}

// ── Constructor options ───────────────────────────────────────────────────────

interface OverworldHudOptions {
  onMenuClick: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export class OverworldHudOverlay {
  private root: HTMLDivElement;

  // Refs to updateable elements
  private avatarImg!:   HTMLImageElement;
  private playerName!:  HTMLSpanElement;
  private playerSub!:   HTMLSpanElement;
  private locationEl!:  HTMLSpanElement;
  private menuBtn!:     HTMLButtonElement;

  private readonly options: OverworldHudOptions;

  constructor(options: OverworldHudOptions) {
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'owh';
    this.buildDOM();
    document.body.appendChild(this.root);
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildDOM(): void {
    this.root.appendChild(this.buildPlayerCard());
    this.root.appendChild(this.buildLocation());
    this.root.appendChild(this.buildMenuBtn());
  }

  private buildPlayerCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'owh__player-card';

    // Avatar circle
    const avatar = document.createElement('div');
    avatar.className = 'owh__avatar';

    const img = document.createElement('img');
    img.className = 'owh__avatar-img';
    img.alt = '';
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => { img.style.display = 'none'; });
    this.avatarImg = img;
    avatar.appendChild(img);

    // Player info column
    const info = document.createElement('div');
    info.className = 'owh__player-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'owh__player-name';
    nameSpan.textContent = '—';
    this.playerName = nameSpan;

    const subSpan = document.createElement('span');
    subSpan.className = 'owh__player-sub';
    subSpan.textContent = 'Soul Rank 1 · —';
    this.playerSub = subSpan;

    info.appendChild(nameSpan);
    info.appendChild(subSpan);

    card.appendChild(avatar);
    card.appendChild(info);
    return card;
  }

  private buildLocation(): HTMLSpanElement {
    const loc = document.createElement('span');
    loc.className = 'owh__location';
    loc.textContent = '—';
    this.locationEl = loc;
    return loc;
  }

  private buildMenuBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'owh__menu-btn';
    btn.textContent = 'MENU';
    btn.setAttribute('aria-label', 'Open bonder menu');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.options.onMenuClick();
    });
    this.menuBtn = btn;
    return btn;
  }

  // ── State updates ───────────────────────────────────────────────────────────

  update(state: OverworldHUDState): void {
    this.playerName.textContent = state.playerName || '—';
    this.playerSub.textContent  = `Soul Rank ${state.soulRank} · ${state.starterName || 'Choose a starter'}`;
    this.locationEl.textContent = state.locationName || '—';
  }

  setMenuOpen(open: boolean): void {
    if (open) {
      this.root.classList.add('owh--menu-open');
      this.menuBtn.textContent = 'CLOSE';
      this.menuBtn.setAttribute('aria-label', 'Close bonder menu');
    } else {
      this.root.classList.remove('owh--menu-open');
      this.menuBtn.textContent = 'MENU';
      this.menuBtn.setAttribute('aria-label', 'Open bonder menu');
    }
  }

  setPortraitSrc(url: string): void {
    this.avatarImg.style.display = '';
    this.avatarImg.src = url;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy(): void {
    this.root.remove();
  }
}
