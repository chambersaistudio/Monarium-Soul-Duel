import './BattleHudOverlay.css';
import { CLASSIC_MOVES, BACK_COMMAND } from '../data/classicMoveData';
import { MINARI_ROSTER } from '../data/minariData';
import { FORCE_MOBILE_HUD } from '../config/mobileConfig';
import type { BattleHUDData, SoulSyncTier } from '../types/progression';

// ── Element accent colours (CSS hex strings) ──────────────────────────────────
const ELEM_COLORS: Record<string, string> = {
  fire:    '#ff6b35', water:   '#38c8ff', flora:   '#66c86d',
  wind:    '#66e7de', thunder: '#ffe65c', stone:   '#a08a6a',
  steel:   '#8899bb', light:   '#fff0b8', dark:    '#8b5cff',
  aether:  '#d7c6ff', ice:     '#88ddff', neutral: '#9da3c7',
  // legacy aliases
  ember: '#ff6b35', aqua: '#38c8ff', terra: '#66c86d', shadow: '#8b5cff',
  bolt: '#ffe65c', gale: '#66e7de', physical: '#d09055', none: '#9da3c7',
};

const ELEM_COLORS_DARK: Record<string, string> = {
  fire: 'rgba(255, 107, 53, 0.48)',    water: 'rgba(56, 200, 255, 0.40)',
  flora: 'rgba(102, 200, 109, 0.38)',  wind: 'rgba(102, 231, 222, 0.35)',
  thunder: 'rgba(255, 230, 92, 0.40)', stone: 'rgba(160, 138, 106, 0.40)',
  steel: 'rgba(136, 153, 187, 0.38)', light: 'rgba(255, 240, 184, 0.30)',
  dark: 'rgba(139, 92, 255, 0.45)',   aether: 'rgba(215, 198, 255, 0.32)',
  ice: 'rgba(136, 221, 255, 0.38)',   neutral: 'rgba(157, 163, 199, 0.32)',
  none: 'rgba(157, 163, 199, 0.32)',
};

function elemColor(e: string | undefined): string {
  return ELEM_COLORS[e ?? 'neutral'] ?? ELEM_COLORS.neutral;
}

function syncFillColor(tier: SoulSyncTier): string {
  switch (tier) {
    case 'locked_in': return '#d9a826';
    case 'stable':    return '#aa8822';
    case 'shaken':    return '#cc7733';
    case 'broken':    return '#884422';
  }
}

function hpColorClass(ratio: number): string {
  if (ratio > 0.5) return 'bhud__bar-fill--hp';
  if (ratio > 0.25) return 'bhud__bar-fill--hp-warn';
  return 'bhud__bar-fill--hp-crit';
}

function elemLabel(type?: string): string {
  const m: Record<string, string> = {
    fire: 'Fire', water: 'Water', flora: 'Flora', wind: 'Wind',
    thunder: 'Thunder', stone: 'Stone', steel: 'Steel', light: 'Light',
    dark: 'Dark', aether: 'Aether', ice: 'Ice', none: 'Guard',
  };
  return m[type ?? ''] ?? 'Neutral';
}

// ── Main button definitions ───────────────────────────────────────────────────

const MAIN_BTNS = [
  { key: 'fight'  , label: 'FIGHT', asset: 'assets/ui/battle/buttons/btn_fight.png' },
  { key: 'bag'    , label: 'BAG'  , asset: 'assets/ui/battle/buttons/btn_bag.png'   },
  { key: 'capture', label: 'BOND' , asset: 'assets/ui/battle/buttons/btn_bond.png'  },
  { key: 'run'    , label: 'RUN'  , asset: 'assets/ui/battle/buttons/btn_run.png'   },
] as const;

type MainKey = typeof MAIN_BTNS[number]['key'];

// ── Public callback interface ─────────────────────────────────────────────────

export interface HudOverlayCallbacks {
  onMainCommand: (key: MainKey) => void;
  onMoveSelect:  (id: string) => void;
  onBack:        () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export class BattleHudOverlay {
  private root:      HTMLDivElement;

  // Status bar fills — player
  private pHpFill!:   HTMLDivElement;
  private pAuraFill!: HTMLDivElement;
  private pSyncFill!: HTMLDivElement;
  private pHpVal!:    HTMLSpanElement;

  // Status bar fills — enemy
  private eHpFill!:   HTMLDivElement;
  private eAuraFill!: HTMLDivElement;
  private eSyncFill!: HTMLDivElement;
  private eHpVal!:    HTMLSpanElement;

  // Bottom sync strips
  private bpSyncFill!: HTMLDivElement;
  private beSyncFill!: HTMLDivElement;

  // Turn badge
  private turnNumEl!: HTMLSpanElement;

  // Command panels
  private mainPanel!:  HTMLDivElement;
  private movesPanel!: HTMLDivElement;
  private mainBtns:    HTMLButtonElement[] = [];
  private moveBtns:    HTMLButtonElement[] = [];

  // Navigation state
  private mainCursor = 0;
  private moveCursor = 0;
  private moveIds:   string[] = [];
  private menuOpen   = false;
  private inMoves    = false;

  private readonly cb: HudOverlayCallbacks;

  constructor(callbacks: HudOverlayCallbacks) {
    this.cb   = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'bhud';
    if (FORCE_MOBILE_HUD) this.root.classList.add('bhud--mobile-preview');
    this.buildDOM();
    document.body.appendChild(this.root);
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildDOM(): void {
    this.root.appendChild(this.buildTop());
    const spacer = document.createElement('div');
    spacer.className = 'bhud__spacer';
    this.root.appendChild(spacer);
    this.root.appendChild(this.buildCommandArea());
    this.root.appendChild(this.buildBottomBars());
  }

  private buildTop(): HTMLDivElement {
    const top = document.createElement('div');
    top.className = 'bhud__top';
    top.appendChild(this.buildPlayerCard());
    top.appendChild(this.buildTurnBadge());
    top.appendChild(this.buildEnemyCard());
    return top;
  }

  private buildPlayerCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'bhud__status bhud__status--player';
    card.id = 'bhud-player-card';
    card.innerHTML = `
      <div class="bhud__name-row">
        <span class="bhud__elem-dot" id="bhud-p-dot"></span>
        <span class="bhud__name"     id="bhud-p-name">---</span>
        <img  class="bhud__gender"   id="bhud-p-gender" src="" alt="" draggable="false" style="display:none">
        <span class="bhud__level"    id="bhud-p-level">Lv.1</span>
        <span class="bhud__bond-pill" id="bhud-p-bond">B.1</span>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__bar-label">HP</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--hp" id="bhud-p-hp-fill" style="width:100%"></div>
        </div>
        <span class="bhud__hp-val" id="bhud-p-hp-val">---</span>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__bar-label">AU</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--aura" id="bhud-p-aura-fill" style="width:100%"></div>
        </div>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__bar-label">SYNC</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--sync" id="bhud-p-sync-fill" style="width:0%"></div>
        </div>
      </div>
    `;
    this.pHpFill   = card.querySelector<HTMLDivElement>('#bhud-p-hp-fill')!;
    this.pAuraFill = card.querySelector<HTMLDivElement>('#bhud-p-aura-fill')!;
    this.pSyncFill = card.querySelector<HTMLDivElement>('#bhud-p-sync-fill')!;
    this.pHpVal    = card.querySelector<HTMLSpanElement>('#bhud-p-hp-val')!;
    return card;
  }

  private buildEnemyCard(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'bhud__status bhud__status--enemy';
    card.id = 'bhud-enemy-card';
    card.innerHTML = `
      <div class="bhud__name-row">
        <span class="bhud__level"    id="bhud-e-level">Lv.1</span>
        <img  class="bhud__gender"   id="bhud-e-gender" src="" alt="" draggable="false" style="display:none">
        <span class="bhud__name"     id="bhud-e-name">---</span>
        <span class="bhud__elem-dot" id="bhud-e-dot"></span>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__hp-val"   id="bhud-e-hp-val">---</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--hp" id="bhud-e-hp-fill" style="width:100%"></div>
        </div>
        <span class="bhud__bar-label">HP</span>
      </div>
      <div class="bhud__bar-row">
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--aura" id="bhud-e-aura-fill" style="width:100%"></div>
        </div>
        <span class="bhud__bar-label">AU</span>
      </div>
      <div class="bhud__bar-row">
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--sync" id="bhud-e-sync-fill" style="width:0%"></div>
        </div>
        <span class="bhud__bar-label">SYNC</span>
      </div>
    `;
    this.eHpFill   = card.querySelector<HTMLDivElement>('#bhud-e-hp-fill')!;
    this.eAuraFill = card.querySelector<HTMLDivElement>('#bhud-e-aura-fill')!;
    this.eSyncFill = card.querySelector<HTMLDivElement>('#bhud-e-sync-fill')!;
    this.eHpVal    = card.querySelector<HTMLSpanElement>('#bhud-e-hp-val')!;
    return card;
  }

  private buildTurnBadge(): HTMLDivElement {
    const badge = document.createElement('div');
    badge.className = 'bhud__turn-badge';
    badge.innerHTML = `
      <span class="bhud__turn-label">TURN</span>
      <span class="bhud__turn-num" id="bhud-turn-num">01</span>
    `;
    this.turnNumEl = badge.querySelector<HTMLSpanElement>('#bhud-turn-num')!;
    return badge;
  }

  private buildCommandArea(): HTMLDivElement {
    const cmd = document.createElement('div');
    cmd.className = 'bhud__command';

    const bg = document.createElement('div');
    bg.className = 'bhud__command-bg';

    this.mainPanel = document.createElement('div');
    this.mainPanel.className = 'bhud__main-panel';
    this.buildMainBtns(this.mainPanel);

    this.movesPanel = document.createElement('div');
    this.movesPanel.className = 'bhud__moves-panel';

    bg.appendChild(this.mainPanel);
    bg.appendChild(this.movesPanel);
    cmd.appendChild(bg);
    return cmd;
  }

  private buildMainBtns(container: HTMLDivElement): void {
    this.mainBtns = [];
    MAIN_BTNS.forEach((cfg, i) => {
      const btn = document.createElement('button');
      btn.className = 'bhud__cmd-btn';
      btn.dataset.cmd = cfg.key;
      btn.setAttribute('aria-label', cfg.label);
      btn.type = 'button';

      // PNG image — baked-in text; no extra label rendered
      const img = document.createElement('img');
      img.className = 'bhud__btn-img';
      img.src = cfg.asset;
      img.alt = '';
      img.draggable = false;
      img.addEventListener('load', () => img.classList.add('bhud--loaded'));
      img.addEventListener('error', () => { img.style.display = 'none'; });

      // Fallback label shown only when PNG is absent
      const fb = document.createElement('span');
      fb.className = 'bhud__btn-fb';
      fb.textContent = cfg.label;
      fb.setAttribute('aria-hidden', 'true');

      btn.appendChild(img);
      btn.appendChild(fb);

      btn.addEventListener('pointerenter', () => {
        if (!this.menuOpen || this.inMoves) return;
        this.mainCursor = i;
        this.refreshMainCursor();
      });
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.menuOpen || this.inMoves) return;
        this.mainCursor = i;
        this.refreshMainCursor();
        this.cb.onMainCommand(cfg.key);
      });

      container.appendChild(btn);
      this.mainBtns.push(btn);
    });
  }

  private buildBottomBars(): HTMLDivElement {
    const bottom = document.createElement('div');
    bottom.className = 'bhud__bottom';

    const pStrip = document.createElement('div');
    pStrip.className = 'bhud__sync-strip';
    pStrip.innerHTML = `
      <span class="bhud__sync-label">SOUL SYNC</span>
      <div class="bhud__sync-track">
        <div class="bhud__sync-fill" id="bhud-bp-sync" style="width:0%"></div>
      </div>
    `;
    this.bpSyncFill = pStrip.querySelector<HTMLDivElement>('#bhud-bp-sync')!;

    const eStrip = document.createElement('div');
    eStrip.className = 'bhud__sync-strip bhud__sync-strip--enemy';
    eStrip.innerHTML = `
      <div class="bhud__sync-track">
        <div class="bhud__sync-fill" id="bhud-be-sync" style="width:0%"></div>
      </div>
      <span class="bhud__sync-label">SOUL SYNC</span>
    `;
    this.beSyncFill = eStrip.querySelector<HTMLDivElement>('#bhud-be-sync')!;

    bottom.appendChild(pStrip);
    bottom.appendChild(eStrip);
    return bottom;
  }

  // ── State update ────────────────────────────────────────────────────────────

  update(data: BattleHUDData, playerLevel: number, enemyLevel: number): void {
    this.updateCard('player', data, playerLevel);
    this.updateCard('enemy',  data, enemyLevel);

    // Bottom strips
    const bpPct = Math.max(0, Math.min(100, data.playerSync));
    const bePct = Math.max(0, Math.min(100, data.enemySync));
    this.bpSyncFill.style.width      = `${bpPct}%`;
    this.bpSyncFill.style.background  = syncFillColor(data.playerSyncTier);
    this.beSyncFill.style.width       = `${bePct}%`;
    this.beSyncFill.style.background  = syncFillColor(data.enemySyncTier);
  }

  private updateCard(side: 'player' | 'enemy', data: BattleHUDData, level: number): void {
    const p    = side === 'player';
    const id   = p ? data.playerMonariId   : data.enemyMonariId;
    const name = p ? data.playerMonariName  : data.enemyMonariName;
    const hp   = p ? data.playerHp          : data.enemyHp;
    const maxH = p ? data.playerMaxHp        : data.enemyMaxHp;
    const au   = p ? data.playerAura         : data.enemyAura;
    const maxA = p ? data.playerMaxAura       : data.enemyMaxAura;
    const sync = p ? data.playerSync         : data.enemySync;
    const tier = p ? data.playerSyncTier     : data.enemySyncTier;
    const bond = p ? data.playerBondLevel    : 1;
    const px   = p ? 'p' : 'e';

    // Monari data
    const minData  = MINARI_ROSTER[id];
    const elem     = minData?.element ?? 'neutral';
    const gender   = minData?.gender;

    // Name & level
    const nameEl = document.getElementById(`bhud-${px}-name`);
    if (nameEl) nameEl.textContent = name;
    const lvEl = document.getElementById(`bhud-${px}-level`);
    if (lvEl) lvEl.textContent = `Lv.${level}`;

    // Element dot
    const dotEl = document.getElementById(`bhud-${px}-dot`) as HTMLElement | null;
    if (dotEl) {
      dotEl.style.background = elemColor(elem);
      dotEl.style.boxShadow  = `0 0 5px ${elemColor(elem)}`;
    }

    // Update card border tint to element
    const card = document.getElementById(`bhud-${p ? 'player' : 'enemy'}-card`);
    if (card) {
      card.style.borderColor = ELEM_COLORS_DARK[elem] ?? 'rgba(68,78,168,0.55)';
    }

    // Gender icon
    const genderEl = document.getElementById(`bhud-${px}-gender`) as HTMLImageElement | null;
    if (genderEl) {
      if (gender && gender !== 'unknown') {
        genderEl.src = `assets/ui/icons/gender_${gender}.png`;
        genderEl.style.display = '';
      } else {
        genderEl.style.display = 'none';
      }
    }

    // Bond tag (player only)
    const bondEl = document.getElementById(`bhud-${px}-bond`);
    if (bondEl && p) bondEl.textContent = `B.${bond}`;

    // HP bar
    const hpFill = p ? this.pHpFill : this.eHpFill;
    const hpRatio = maxH > 0 ? Math.max(0, hp / maxH) : 0;
    hpFill.style.width = `${Math.round(hpRatio * 100)}%`;
    hpFill.className = `bhud__bar-fill ${hpColorClass(hpRatio)}`;

    // Aura bar
    const auraFill = p ? this.pAuraFill : this.eAuraFill;
    const auRatio  = maxA > 0 ? Math.max(0, au / maxA) : 0;
    auraFill.style.width = `${Math.round(auRatio * 100)}%`;

    // Sync bar
    const syncFill = p ? this.pSyncFill : this.eSyncFill;
    const syncPct  = Math.max(0, Math.min(100, sync));
    syncFill.style.width      = `${syncPct}%`;
    syncFill.style.background  = syncFillColor(tier);

    // HP value text
    const hpVal = p ? this.pHpVal : this.eHpVal;
    hpVal.textContent = `${Math.ceil(hp)}/${maxH}`;
  }

  setTurnNumber(n: number): void {
    if (this.turnNumEl) this.turnNumEl.textContent = String(n).padStart(2, '0');
  }

  // ── Menu show / hide ────────────────────────────────────────────────────────

  showMenu(): void {
    this.menuOpen = true;
    this.root.classList.add('bhud--menu-visible');
    this.showMainPanel();
  }

  hideMenu(): void {
    this.menuOpen = false;
    this.inMoves  = false;
    this.root.classList.remove('bhud--menu-visible');
  }

  showMainPanel(): void {
    this.inMoves    = false;
    this.mainCursor = 0;
    this.mainPanel.classList.add('bhud--active');
    this.movesPanel.classList.remove('bhud--active');
    this.refreshMainCursor();
  }

  showMovesPanel(moveIds: string[], playerAura: number, guardBlocked = false): void {
    this.inMoves    = true;
    this.moveCursor = 0;
    this.moveIds    = moveIds;
    this.mainPanel.classList.remove('bhud--active');
    this.movesPanel.classList.add('bhud--active');
    this.buildMoveBtns(moveIds, playerAura, guardBlocked);
    this.refreshMoveCursor();
  }

  private buildMoveBtns(ids: string[], playerAura: number, guardBlocked: boolean): void {
    this.movesPanel.innerHTML = '';
    this.moveBtns = [];

    const nonBack  = ids.filter(id => id !== BACK_COMMAND);
    const hasBack  = ids.includes(BACK_COMMAND);
    const utilIds  = nonBack.filter(id => id === 'basic_attack' || (CLASSIC_MOVES[id]?.holdsStance ?? false));
    const specIds  = nonBack.filter(id => id !== 'basic_attack' && !(CLASSIC_MOVES[id]?.holdsStance ?? false));

    // Update moveIds to match the dock button order for keyboard confirm()
    this.moveIds = [...utilIds, ...specIds, ...(hasBack ? [BACK_COMMAND] : [])];

    // Utility column
    if (utilIds.length > 0) {
      const col = document.createElement('div');
      col.className = 'bhud__move-util-col';
      for (const id of utilIds) {
        const move     = CLASSIC_MOVES[id];
        const isGuard  = move?.holdsStance ?? false;
        const cost     = move?.auraCost ?? 0;
        const blocked  = isGuard && guardBlocked;
        const noAura   = cost > 0 && playerAura < cost;
        const dimmed   = blocked || noAura;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bhud__move-btn bhud__move-btn--utility'
          + (dimmed ? ' bhud__move-btn--dimmed' : '');
        btn.setAttribute('aria-label', move?.displayName ?? id);
        if (dimmed) btn.disabled = true;

        const nameStr  = id === 'basic_attack' ? 'BASIC ATK' : (move?.displayName?.toUpperCase() ?? id.toUpperCase());
        const metaStr  = id === 'basic_attack'
          ? `+${move?.auraGain ?? 0} AU`
          : (isGuard ? `Guard · P+4` : (cost > 0 ? `${cost} AU` : ''));
        btn.innerHTML  = `<span class="bhud__move-name">${nameStr}${blocked ? ' <span class="bhud__move-locked">LOCKED</span>' : ''}</span>`
          + (metaStr ? `<span class="bhud__move-meta">${metaStr}</span>` : '');

        const idx = this.moveBtns.length;
        btn.addEventListener('pointerenter', () => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
        });
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
          this.cb.onMoveSelect(id);
        });
        col.appendChild(btn);
        this.moveBtns.push(btn);
      }
      this.movesPanel.appendChild(col);
    }

    // Divider
    if (utilIds.length > 0 && specIds.length > 0) {
      const div = document.createElement('div');
      div.className = 'bhud__move-divider';
      this.movesPanel.appendChild(div);
    }

    // Specials row
    if (specIds.length > 0) {
      const row = document.createElement('div');
      row.className = 'bhud__move-spec-row';
      for (const id of specIds) {
        const move    = CLASSIC_MOVES[id];
        const cost    = move?.auraCost ?? 0;
        const dimmed  = cost > 0 && playerAura < cost;
        const accent  = elemColor(move?.damageType);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bhud__move-btn bhud__move-btn--special'
          + (dimmed ? ' bhud__move-btn--dimmed' : '');
        btn.setAttribute('aria-label', move?.displayName ?? id);
        if (dimmed) btn.disabled = true;
        btn.style.setProperty('--move-accent', accent);

        const nameStr = move?.displayName?.toUpperCase() ?? id.toUpperCase();
        const costStr = cost > 0 ? `${cost} AU · ${elemLabel(move?.damageType)}` : elemLabel(move?.damageType);
        btn.innerHTML = `<span class="bhud__move-name">${nameStr}</span>`
          + `<span class="bhud__move-meta">${costStr}</span>`;

        const idx = this.moveBtns.length;
        btn.addEventListener('pointerenter', () => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
        });
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
          this.cb.onMoveSelect(id);
        });
        row.appendChild(btn);
        this.moveBtns.push(btn);
      }
      this.movesPanel.appendChild(row);
    }

    // Back chip
    if (hasBack) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bhud__move-btn bhud__move-btn--back';
      btn.setAttribute('aria-label', 'Back');
      btn.innerHTML = '<span class="bhud__move-name">← BACK</span>';

      const idx = this.moveBtns.length;
      btn.addEventListener('pointerenter', () => {
        if (!this.menuOpen || !this.inMoves) return;
        this.moveCursor = idx;
        this.refreshMoveCursor();
      });
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!this.menuOpen || !this.inMoves) return;
        this.moveCursor = idx;
        this.refreshMoveCursor();
        this.cb.onBack();
      });
      this.movesPanel.appendChild(btn);
      this.moveBtns.push(btn);
    }

    this.refreshMoveCursor();
  }

  // ── Cursor drawing ──────────────────────────────────────────────────────────

  refreshMainCursor(): void {
    this.mainBtns.forEach((btn, i) => {
      const sel = i === this.mainCursor;
      btn.classList.toggle('bhud__cmd-btn--selected',   sel);
      btn.classList.toggle('bhud__cmd-btn--unselected', !sel);
    });
  }

  refreshMoveCursor(): void {
    this.moveBtns.forEach((btn, i) => {
      btn.classList.toggle('bhud__move-btn--selected', i === this.moveCursor);
    });
  }

  // ── Keyboard navigation helpers ─────────────────────────────────────────────

  navLeft(): void {
    if (!this.menuOpen) return;
    if (!this.inMoves) {
      this.mainCursor = (this.mainCursor - 1 + MAIN_BTNS.length) % MAIN_BTNS.length;
      this.refreshMainCursor();
    } else {
      const n = this.moveBtns.length;
      if (n === 0) return;
      this.moveCursor = (this.moveCursor - 1 + n) % n;
      this.refreshMoveCursor();
    }
  }

  navRight(): void {
    if (!this.menuOpen) return;
    if (!this.inMoves) {
      this.mainCursor = (this.mainCursor + 1) % MAIN_BTNS.length;
      this.refreshMainCursor();
    } else {
      const n = this.moveBtns.length;
      if (n === 0) return;
      this.moveCursor = (this.moveCursor + 1) % n;
      this.refreshMoveCursor();
    }
  }

  confirm(): void {
    if (!this.menuOpen) return;
    if (!this.inMoves) {
      this.cb.onMainCommand(MAIN_BTNS[this.mainCursor].key);
    } else {
      const id = this.moveIds[this.moveCursor];
      if (id === BACK_COMMAND) this.cb.onBack();
      else                     this.cb.onMoveSelect(id);
    }
  }

  back(): void {
    if (this.menuOpen && this.inMoves) this.cb.onBack();
  }

  isInMainPanel(): boolean { return !this.inMoves; }

  get curMainCursor(): number { return this.mainCursor; }
  get curMoveCursor(): number { return this.moveCursor; }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy(): void {
    this.root.remove();
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
