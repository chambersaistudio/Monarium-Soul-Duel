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
  private destroyed = false;

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
  private eAuVal!:    HTMLSpanElement;
  private eSyncVal!:  HTMLSpanElement;

  // Aura / sync value spans — player
  private pAuVal!:   HTMLSpanElement;
  private pSyncVal!: HTMLSpanElement;

  // Turn badge
  private turnNumEl!: HTMLSpanElement;

  // Command panels
  private mainPanel!:  HTMLDivElement;
  private movesPanel!: HTMLDivElement;
  private bagPanel!:   HTMLDivElement;
  private bondPanel!:  HTMLDivElement;
  private mainBtns:    HTMLButtonElement[] = [];
  private moveBtns:    HTMLButtonElement[] = [];

  // Navigation state
  private mainCursor = 0;
  private moveCursor = 0;
  private moveIds:   string[] = [];
  private menuOpen   = false;
  private inMoves    = false;

  // Move info popup (long-press)
  private moveInfoEl: HTMLDivElement | null = null;

  private readonly cb: HudOverlayCallbacks;

  constructor(callbacks: HudOverlayCallbacks) {
    document.querySelectorAll('.bhud').forEach(node => node.remove());
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
        <span class="bhud__hp-val" id="bhud-p-au-val">---</span>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__bar-label">SYNC</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--sync" id="bhud-p-sync-fill" style="width:0%"></div>
        </div>
        <span class="bhud__hp-val" id="bhud-p-sync-val">---</span>
      </div>
    `;
    this.pHpFill   = card.querySelector<HTMLDivElement>('#bhud-p-hp-fill')!;
    this.pAuraFill = card.querySelector<HTMLDivElement>('#bhud-p-aura-fill')!;
    this.pSyncFill = card.querySelector<HTMLDivElement>('#bhud-p-sync-fill')!;
    this.pHpVal    = card.querySelector<HTMLSpanElement>('#bhud-p-hp-val')!;
    this.pAuVal    = card.querySelector<HTMLSpanElement>('#bhud-p-au-val')!;
    this.pSyncVal  = card.querySelector<HTMLSpanElement>('#bhud-p-sync-val')!;
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
        <span class="bhud__hp-val" id="bhud-e-au-val">---</span>
        <div class="bhud__bar-track">
          <div class="bhud__bar-fill bhud__bar-fill--aura" id="bhud-e-aura-fill" style="width:100%"></div>
        </div>
        <span class="bhud__bar-label">AU</span>
      </div>
      <div class="bhud__bar-row">
        <span class="bhud__hp-val" id="bhud-e-sync-val">---</span>
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
    this.eAuVal    = card.querySelector<HTMLSpanElement>('#bhud-e-au-val')!;
    this.eSyncVal  = card.querySelector<HTMLSpanElement>('#bhud-e-sync-val')!;
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

    this.bagPanel = document.createElement('div');
    this.bagPanel.className = 'bhud__bag-panel';

    this.bondPanel = document.createElement('div');
    this.bondPanel.className = 'bhud__bond-panel';

    bg.appendChild(this.mainPanel);
    bg.appendChild(this.movesPanel);
    bg.appendChild(this.bagPanel);
    bg.appendChild(this.bondPanel);
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

  // ── State update ────────────────────────────────────────────────────────────

  update(data: BattleHUDData, playerLevel: number, enemyLevel: number): void {
    if (this.destroyed || !this.root.isConnected) return;
    this.updateCard('player', data, playerLevel);
    this.updateCard('enemy',  data, enemyLevel);
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
    const px   = p ? 'p' : 'e';

    // Monari data
    const minData  = MINARI_ROSTER[id];
    const elem     = minData?.element ?? 'neutral';
    const gender   = minData?.gender;

    // Name & level
    const nameEl = this.root.querySelector<HTMLElement>(`#bhud-${px}-name`);
    if (nameEl) nameEl.textContent = name;
    const lvEl = this.root.querySelector<HTMLElement>(`#bhud-${px}-level`);
    if (lvEl) lvEl.textContent = `Lv.${level}`;

    // Element dot
    const dotEl = this.root.querySelector<HTMLElement>(`#bhud-${px}-dot`);
    if (dotEl) {
      dotEl.style.background = elemColor(elem);
      dotEl.style.boxShadow  = `0 0 5px ${elemColor(elem)}`;
    }

    // Update card border tint to element
    const card = this.root.querySelector<HTMLElement>(`#bhud-${p ? 'player' : 'enemy'}-card`);
    if (card) {
      card.style.borderColor = ELEM_COLORS_DARK[elem] ?? 'rgba(68,78,168,0.55)';
    }

    // Gender icon
    const genderEl = this.root.querySelector<HTMLImageElement>(`#bhud-${px}-gender`);
    if (genderEl) {
      if (gender && gender !== 'unknown') {
        genderEl.src = `assets/ui/icons/gender_${gender}.png`;
        genderEl.style.display = '';
      } else {
        genderEl.style.display = 'none';
      }
    }

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

    // AU value text
    const auVal = p ? this.pAuVal : this.eAuVal;
    if (auVal) auVal.textContent = `${Math.ceil(au)}/${maxA}`;

    // Sync value text
    const syncValEl = p ? this.pSyncVal : this.eSyncVal;
    if (syncValEl) syncValEl.textContent = `${Math.round(sync)}/100`;
  }

  setTurnNumber(n: number): void {
    if (this.turnNumEl) this.turnNumEl.textContent = String(n).padStart(2, '0');
  }

  // ── Menu show / hide ────────────────────────────────────────────────────────

  showMenu(): void {
    if (this.destroyed) return;
    this.menuOpen = true;
    this.root.classList.add('bhud--menu-visible');
    this.showMainPanel();
  }

  hideMenu(): void {
    if (this.destroyed) return;
    this.menuOpen = false;
    this.inMoves  = false;
    this.dismissMoveInfoPopup();
    this.root.classList.remove('bhud--menu-visible');
  }

  showMainPanel(): void {
    if (this.destroyed) return;
    this.inMoves    = false;
    this.mainCursor = 0;
    this.mainPanel.classList.add('bhud--active');
    this.movesPanel.classList.remove('bhud--active');
    this.bagPanel.classList.remove('bhud--active');
    this.bondPanel.classList.remove('bhud--active');
    this.dismissMoveInfoPopup();
    this.refreshMainCursor();
  }

  // ── Bag panel ──────────────────────────────────────────────────────────────

  showBagPanel(potionCount: number, onUsePotion: () => void, onBack: () => void): void {
    this.inMoves = false;
    this.mainPanel.classList.remove('bhud--active');
    this.movesPanel.classList.remove('bhud--active');
    this.bondPanel.classList.remove('bhud--active');
    this.bagPanel.classList.add('bhud--active');
    this.bagPanel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'bhud__sub-title';
    title.textContent = 'BAG';
    this.bagPanel.appendChild(title);

    const items = document.createElement('div');
    items.className = 'bhud__bag-items';

    if (potionCount > 0) {
      const row = document.createElement('div');
      row.className = 'bhud__bag-item';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'bhud__bag-item-info';
      infoDiv.innerHTML = `<span class="bhud__bag-item-name">Potion</span><span class="bhud__bag-item-desc">+15 HP · Uses turn</span>`;
      row.appendChild(infoDiv);

      const countEl = document.createElement('span');
      countEl.className = 'bhud__bag-item-count';
      countEl.textContent = `×${potionCount}`;
      row.appendChild(countEl);

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'bhud__bag-use-btn';
      useBtn.textContent = 'USE';
      useBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); onUsePotion(); });
      row.appendChild(useBtn);

      items.appendChild(row);
    } else {
      const empty = document.createElement('div');
      empty.className = 'bhud__bag-empty';
      empty.textContent = 'Bag is empty.';
      items.appendChild(empty);
    }

    this.bagPanel.appendChild(items);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'bhud__sub-back';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); onBack(); });
    this.bagPanel.appendChild(backBtn);
  }

  hideBagPanel(): void {
    this.bagPanel.classList.remove('bhud--active');
  }

  // ── Bond panel ──────────────────────────────────────────────────────────────

  showBondPanel(
    monariName: string,
    chance: number,
    alreadyOwned: boolean,
    onConfirm: () => void,
    onBack: () => void,
  ): void {
    this.inMoves = false;
    this.mainPanel.classList.remove('bhud--active');
    this.movesPanel.classList.remove('bhud--active');
    this.bagPanel.classList.remove('bhud--active');
    this.bondPanel.classList.add('bhud--active');
    this.bondPanel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'bhud__sub-title';
    title.textContent = 'BOND';
    this.bondPanel.appendChild(title);

    if (alreadyOwned) {
      const msg = document.createElement('div');
      msg.className = 'bhud__bond-owned';
      msg.textContent = `${monariName} is already bonded to you!`;
      this.bondPanel.appendChild(msg);
    } else {
      const pct   = Math.round(chance * 100);
      const color = pct >= 60 ? '#44dd88' : pct >= 30 ? '#ffaa22' : '#ff6644';

      const nameEl = document.createElement('div');
      nameEl.className = 'bhud__bond-target';
      nameEl.textContent = monariName;
      this.bondPanel.appendChild(nameEl);

      const chanceEl = document.createElement('div');
      chanceEl.className = 'bhud__bond-chance';
      chanceEl.innerHTML = `Bond Chance: <span style="color:${color};font-weight:700">${pct}%</span>`;
      this.bondPanel.appendChild(chanceEl);

      if (pct < 40) {
        const hint = document.createElement('div');
        hint.className = 'bhud__bond-hint';
        hint.textContent = 'Lower HP improves your chance.';
        this.bondPanel.appendChild(hint);
      }

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'bhud__bond-confirm';
      confirmBtn.textContent = 'BOND';
      confirmBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); onConfirm(); });
      this.bondPanel.appendChild(confirmBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'bhud__sub-back';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); onBack(); });
    this.bondPanel.appendChild(backBtn);
  }

  hideBondPanel(): void {
    this.bondPanel.classList.remove('bhud--active');
  }

  showMovesPanel(moveIds: string[], playerAura: number, guardBlocked = false): void {
    if (this.destroyed) return;
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
    const utilIds  = nonBack.filter(id => id === 'basic_attack' || id === 'guard');
    const specIds  = nonBack.filter(id => id !== 'basic_attack' && id !== 'guard');

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

        const catSym   = move?.category === 'special' ? '✦ ' : '⚔ ';
        const nameStr  = id === 'basic_attack' ? `${catSym}BASIC ATK` : `${catSym}${move?.displayName?.toUpperCase() ?? id.toUpperCase()}`;
        const metaStr  = id === 'basic_attack'
          ? `PWR ${move?.power ?? 0} | +${move?.auraGain ?? 0} AU | ${move?.accuracy ?? 100}%`
          : (isGuard ? `Guard Stance${blocked ? '' : ''}` : (cost > 0 ? `AU ${cost}` : ''));
        btn.innerHTML  = `<span class="bhud__move-name">${nameStr}${blocked ? ' <span class="bhud__move-locked">LOCKED</span>' : ''}</span>`
          + (metaStr ? `<span class="bhud__move-meta">${metaStr}</span>` : '');

        const idx = this.moveBtns.length;
        let lpTimer_u: ReturnType<typeof setTimeout> | null = null;
        let lpFired_u = false;
        let lpStartX_u = 0, lpStartY_u = 0;

        btn.addEventListener('pointerenter', () => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
        });
        btn.addEventListener('pointerdown', (e) => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          lpFired_u = false;
          lpStartX_u = e.clientX;
          lpStartY_u = e.clientY;
          this.moveCursor = idx;
          this.refreshMoveCursor();
          lpTimer_u = window.setTimeout(() => {
            lpFired_u = true;
            this.showMoveInfoPopup(id);
          }, 500);
        });
        btn.addEventListener('pointermove', (e) => {
          if (Math.abs(e.clientX - lpStartX_u) > 8 || Math.abs(e.clientY - lpStartY_u) > 8) {
            if (lpTimer_u) { clearTimeout(lpTimer_u); lpTimer_u = null; }
          }
        });
        btn.addEventListener('pointerup', (e) => {
          e.preventDefault();
          if (lpTimer_u) { clearTimeout(lpTimer_u); lpTimer_u = null; }
          if (!this.menuOpen || !this.inMoves || dimmed || lpFired_u) return;
          this.cb.onMoveSelect(id);
        });
        btn.addEventListener('pointercancel', () => {
          if (lpTimer_u) { clearTimeout(lpTimer_u); lpTimer_u = null; }
          lpFired_u = false;
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

        const catSym  = move?.category === 'special' ? '✦ ' : '⚔ ';
        const nameStr = `${catSym}${move?.displayName?.toUpperCase() ?? id.toUpperCase()}`;
        const hasSyncDmg = (move?.syncDamage ?? 0) !== 0;
        const costStr = hasSyncDmg
          ? `SYNC ${move!.syncDamage} | AU ${cost} | ${move?.accuracy ?? 100}%`
          : (move?.holdsStance
            ? `Guard Stance | AU ${cost}`
            : `PWR ${move?.power ?? 0} | AU ${cost} | ACC ${move?.accuracy ?? 100}%`);
        btn.innerHTML = `<span class="bhud__move-name">${nameStr}</span>`
          + `<span class="bhud__move-meta">${costStr}</span>`;

        const idx = this.moveBtns.length;
        let lpTimer_s: ReturnType<typeof setTimeout> | null = null;
        let lpFired_s = false;
        let lpStartX_s = 0, lpStartY_s = 0;

        btn.addEventListener('pointerenter', () => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          this.moveCursor = idx;
          this.refreshMoveCursor();
        });
        btn.addEventListener('pointerdown', (e) => {
          if (!this.menuOpen || !this.inMoves || dimmed) return;
          lpFired_s = false;
          lpStartX_s = e.clientX;
          lpStartY_s = e.clientY;
          this.moveCursor = idx;
          this.refreshMoveCursor();
          lpTimer_s = window.setTimeout(() => {
            lpFired_s = true;
            this.showMoveInfoPopup(id);
          }, 500);
        });
        btn.addEventListener('pointermove', (e) => {
          if (Math.abs(e.clientX - lpStartX_s) > 8 || Math.abs(e.clientY - lpStartY_s) > 8) {
            if (lpTimer_s) { clearTimeout(lpTimer_s); lpTimer_s = null; }
          }
        });
        btn.addEventListener('pointerup', (e) => {
          e.preventDefault();
          if (lpTimer_s) { clearTimeout(lpTimer_s); lpTimer_s = null; }
          if (!this.menuOpen || !this.inMoves || dimmed || lpFired_s) return;
          this.cb.onMoveSelect(id);
        });
        btn.addEventListener('pointercancel', () => {
          if (lpTimer_s) { clearTimeout(lpTimer_s); lpTimer_s = null; }
          lpFired_s = false;
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

  // ── Move info popup (long-press) ────────────────────────────────────────────

  showMoveInfoPopup(moveId: string): void {
    this.dismissMoveInfoPopup();
    const move = CLASSIC_MOVES[moveId];
    const bg = document.createElement('div');
    bg.className = 'bhud-minfo-bg';
    const card = document.createElement('div');
    card.className = 'bhud-minfo';

    const icon = move?.holdsStance ? '🛡' : move?.category === 'special' ? '✦' : move?.category === 'physical' ? '⚔' : '◎';
    const catLabel = move?.holdsStance ? 'Guard' : move?.category === 'special' ? 'Special' : move?.category === 'physical' ? 'Physical' : 'Status';
    const typeColor = ({
      fire:'#ff6b35',water:'#38c8ff',flora:'#66c86d',wind:'#66e7de',
      thunder:'#ffe65c',stone:'#a08a6a',dark:'#8b5cff',neutral:'#9da3c7',none:'#9da3c7'
    } as Record<string,string>)[move?.damageType ?? 'neutral'] ?? '#9da3c7';
    const name = move?.displayName ?? moveId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const au = move?.auraCost ?? 0;
    const acc = move?.accuracy ?? 100;
    const desc = move?.description ?? '';
    const typeLabel = (move?.damageType ?? 'neutral');
    const typeStr = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

    card.innerHTML = `
      <div class="bhud-minfo__header">
        <span class="bhud-minfo__name">${name}</span>
        <button class="bhud-minfo__close" type="button">✕</button>
      </div>
      <div class="bhud-minfo__badges">
        <span class="bhud-minfo__cat">${icon} ${catLabel}</span>
        <span class="bhud-minfo__type" style="color:${typeColor}">● ${typeStr}</span>
      </div>
      <div class="bhud-minfo__stats">
        <div class="bhud-minfo__stat"><span class="bhud-minfo__sl">PWR</span><span class="bhud-minfo__sv" style="color:#ff8844">${move?.power ?? 0}</span></div>
        <div class="bhud-minfo__stat"><span class="bhud-minfo__sl">AU</span><span class="bhud-minfo__sv" style="color:#44aaff">${au}</span></div>
        <div class="bhud-minfo__stat"><span class="bhud-minfo__sl">ACC</span><span class="bhud-minfo__sv">${acc}%</span></div>
      </div>
      ${desc ? `<p class="bhud-minfo__desc">${desc}</p>` : ''}
      <div class="bhud-minfo__hint">Hold for details · Tap to use</div>
    `;

    bg.appendChild(card);
    document.body.appendChild(bg);
    this.moveInfoEl = bg;

    (card.querySelector('.bhud-minfo__close') as HTMLButtonElement).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dismissMoveInfoPopup();
    });
    bg.addEventListener('pointerdown', (e) => {
      if (e.target === bg) this.dismissMoveInfoPopup();
    });
  }

  dismissMoveInfoPopup(): void {
    this.moveInfoEl?.remove();
    this.moveInfoEl = null;
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.dismissMoveInfoPopup();
    this.root.replaceChildren();
    this.root.remove();
    this.mainBtns = [];
    this.moveBtns = [];
  }

  hide(): void {
    if (this.destroyed) return;
    this.root.style.display = 'none';
  }
}
