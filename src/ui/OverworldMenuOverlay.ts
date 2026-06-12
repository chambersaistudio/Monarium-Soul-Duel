import './OverworldMenuOverlay.css';
import { MINARI_ROSTER } from '../data/minariData';
import { elementLabel, rarityLabel } from '../config/uiTheme';
import { CLASSIC_MOVES, CLASSIC_TECHNIQUE_LIBRARY } from '../data/classicMoveData';
import { MONARI_ABILITIES } from '../data/abilities';
import type { OverworldSave } from '../systems/PlayerSaveManager';
import { PlayerSaveManager } from '../systems/PlayerSaveManager';

// ── Element accent colours ─────────────────────────────────────────────────────

const ELEM_CSS: Record<string, string> = {
  fire:    '#ff6b35', water:   '#38c8ff', flora:   '#66c86d',
  wind:    '#66e7de', thunder: '#ffe65c', stone:   '#a08a6a',
  steel:   '#8899bb', light:   '#fff0b8', dark:    '#8b5cff',
  aether:  '#d7c6ff', ice:     '#88ddff', neutral: '#9da3c7',
  none:    '#9da3c7',
};

function elemCss(element: string | undefined): string {
  return ELEM_CSS[element ?? 'neutral'] ?? ELEM_CSS.neutral;
}

function statPct(value: number, max = 400): string {
  return `${Math.min(100, Math.max(0, (value / max) * 100)).toFixed(1)}%`;
}

const LEVEL_DISPLAY = 7;
const LEVEL_GROWTH  = 0.05;

function scaleStat(base: number): number {
  return Math.round(base * (1 + (LEVEL_DISPLAY - 1) * LEVEL_GROWTH));
}

// ── Move category icon ─────────────────────────────────────────────────────────

function catIcon(move: import('../types/classic').ClassicMoveConfig | undefined): string {
  if (!move) return '◎';
  if (move.holdsStance) return '🛡';
  if (move.category === 'special')  return '✦';
  if (move.category === 'physical') return '⚔';
  return '◎';
}

// ── Menu items ─────────────────────────────────────────────────────────────────

const BONDER_MENU_ITEMS = [
  'Monari',
  'Techniques',
  'Bag',
  'Player',
  'Codex',
  'Settings',
  'Save',
  'Mode Select',
  'Back / Close',
] as const;

type BonderMenuItem = typeof BONDER_MENU_ITEMS[number];

// ── Callback interface ─────────────────────────────────────────────────────────

export interface MenuCallbacks {
  onClose:      () => void;
  onModeSelect: () => void;
  onSave?:      () => void;
}

// ── Swap state ─────────────────────────────────────────────────────────────────

interface SwapState {
  monariId:   string;
  slotIndex:  number;  // 0–3
  oldMoveId:  string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class OverworldMenuOverlay {
  private root:   HTMLDivElement;
  private panel:  HTMLDivElement;
  private readonly cb: MenuCallbacks;

  private currentTeamIds: string[] = [];
  private playerSave: OverworldSave | null = null;
  private playerTeamIds: string[] = [];
  private movePopupEl:   HTMLDivElement | null = null;
  private detailModalEl: HTMLDivElement | null = null;
  private techModalEl:   HTMLDivElement | null = null;

  // Technique swap state
  private swapState: SwapState | null = null;

  constructor(callbacks: MenuCallbacks) {
    this.cb = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'owmenu';

    this.panel = document.createElement('div');
    this.panel.className = 'owmenu__panel';

    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }

  // ── Visibility helpers ────────────────────────────────────────────────────

  isVisible(): boolean {
    return this.root.classList.contains('owmenu--visible');
  }

  private show(): void {
    this.root.classList.add('owmenu--visible');
  }

  private hide(): void {
    this.root.classList.remove('owmenu--visible');
  }

  // ── Bonder Menu ───────────────────────────────────────────────────────────

  showBonderMenu(teamIds?: string[], save?: OverworldSave): void {
    if (teamIds) this.playerTeamIds = [...teamIds];
    if (save)    this.playerSave    = save;
    this.panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'owmenu__title';
    title.textContent = 'Menu';
    this.panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'owmenu__item-list';

    for (const item of BONDER_MENU_ITEMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'owmenu__item-btn';
      btn.textContent = item;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleBonderMenuClick(item as BonderMenuItem, btn);
      });
      list.appendChild(btn);
    }

    this.panel.appendChild(list);
    this.show();
  }

  private handleBonderMenuClick(item: BonderMenuItem, btn?: HTMLButtonElement): void {
    switch (item) {
      case 'Monari':
        this.showTeamScreen(this.playerTeamIds);
        break;
      case 'Techniques':
        if (this.playerTeamIds.length === 1) {
          this.showTechniquesModal(this.playerTeamIds[0]);
        } else if (this.playerTeamIds.length === 0) {
          this.showComingSoon('Techniques');
        } else {
          this.showTeamScreen(this.playerTeamIds);
        }
        break;
      case 'Player':
        this.showPlayerPage();
        break;
      case 'Save':
        if (this.cb.onSave) {
          this.cb.onSave();
          if (btn) {
            const orig = btn.textContent ?? 'Save';
            btn.textContent = 'Saved ✓';
            btn.disabled = true;
            setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
          }
        } else {
          this.showComingSoon(item);
        }
        break;
      case 'Mode Select':
        this.cb.onModeSelect();
        break;
      case 'Back / Close':
        this.cb.onClose();
        this.hide();
        break;
      case 'Bag':
        this.showBagPage();
        break;
      default:
        this.showComingSoon(item);
        break;
    }
  }

  private showComingSoon(featureName: string): void {
    this.panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'owmenu__title';
    title.textContent = featureName;
    this.panel.appendChild(title);

    const msg = document.createElement('div');
    msg.className = 'owmenu__coming-soon';
    msg.textContent = 'Coming soon…';
    this.panel.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'owmenu__detail-actions';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'owmenu__back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.showBonderMenu();
    });
    actions.appendChild(backBtn);

    this.panel.appendChild(actions);
  }

  private showBagPage(): void {
    this.panel.innerHTML = '';
    const save = this.playerSave;

    const title = document.createElement('div');
    title.className = 'owmenu__title';
    title.textContent = 'Bag';
    this.panel.appendChild(title);

    const content = document.createElement('div');
    content.className = 'owmenu__bag-content';

    if (!save) {
      const msg = document.createElement('div');
      msg.className = 'owmenu__coming-soon';
      msg.textContent = 'No save data found.';
      content.appendChild(msg);
    } else {
      const potionCount = save.potionCount ?? 0;
      if (potionCount > 0) {
        const row = document.createElement('div');
        row.className = 'owmenu__bag-item-row';
        row.innerHTML = `
          <div class="owmenu__bag-item-icon">🧪</div>
          <div class="owmenu__bag-item-info">
            <span class="owmenu__bag-item-name">Potion</span>
            <span class="owmenu__bag-item-desc">+15 HP · Uses turn in battle</span>
          </div>
          <span class="owmenu__bag-item-qty">×${potionCount}</span>
        `;
        content.appendChild(row);
      } else {
        const empty = document.createElement('div');
        empty.className = 'owmenu__empty-state';
        empty.textContent = 'Bag is empty.';
        content.appendChild(empty);
      }
    }

    this.panel.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'owmenu__detail-actions';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'owmenu__back-btn';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.showBonderMenu(); });
    actions.appendChild(backBtn);
    this.panel.appendChild(actions);
    this.show();
  }

  // ── Player Page ───────────────────────────────────────────────────────────

  private showPlayerPage(): void {
    this.panel.innerHTML = '';

    const save = this.playerSave;

    const title = document.createElement('div');
    title.className = 'owmenu__title';
    title.textContent = 'Player';
    this.panel.appendChild(title);

    const body = document.createElement('div');
    body.className = 'owmenu__player-body';

    if (!save) {
      const msg = document.createElement('div');
      msg.className = 'owmenu__coming-soon';
      msg.textContent = 'No save data found.';
      body.appendChild(msg);
    } else {
      // Portrait (starter portrait)
      const portrait = document.createElement('div');
      portrait.className = 'owmenu__player-portrait';
      const pImg = document.createElement('img');
      pImg.className = 'owmenu__player-portrait-img';
      pImg.src = `assets/monari/${save.starterMonariId}/portraits/neutral.png`;
      pImg.alt = save.playerName;
      pImg.draggable = false;
      let pfb = 0;
      pImg.addEventListener('error', () => {
        pfb++;
        if (pfb === 1) pImg.src = `assets/monari/${save.starterMonariId}/reference/fullbody.png`;
        else pImg.style.display = 'none';
      });
      portrait.appendChild(pImg);
      body.appendChild(portrait);

      const infoWrap = document.createElement('div');
      infoWrap.className = 'owmenu__player-info';

      // Name + rank
      const nameRow = document.createElement('div');
      nameRow.className = 'owmenu__player-name-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'owmenu__player-name';
      nameEl.textContent = save.playerName;
      nameRow.appendChild(nameEl);
      const rankEl = document.createElement('span');
      rankEl.className = 'owmenu__player-rank';
      rankEl.textContent = `Soul Rank ${this.calcSoulRank(save)}`;
      nameRow.appendChild(rankEl);
      infoWrap.appendChild(nameRow);

      // Starter info
      const starterMonari = MINARI_ROSTER[save.starterMonariId];
      if (starterMonari) {
        const starterRow = document.createElement('div');
        starterRow.className = 'owmenu__player-starter';
        starterRow.innerHTML = `Partner: <span style="color:${elemCss(starterMonari.element)}">${starterMonari.name}</span> Lv.${save.monariLevel}`;
        infoWrap.appendChild(starterRow);
      }

      // Level XP bar
      const xpToNext = PlayerSaveManager.xpToNextLevel(save.monariLevel);
      const xpPct = save.monariLevel >= 100 ? 100 : Math.min(100, (save.monariXp / xpToNext) * 100);
      infoWrap.appendChild(this.buildInfoBar(
        `XP  ${save.monariXp} / ${xpToNext}`,
        xpPct,
        '#36ccff',
      ));

      // Bond XP bar
      const BOND_CAP = 10;
      const bondLevel = save.bondLevel ?? 1;
      const bondXp    = save.bondXp ?? 0;
      const bondToNext = PlayerSaveManager.bondXpToNextLevel(bondLevel);
      const bondPct   = bondLevel >= BOND_CAP ? 100 : Math.min(100, (bondXp / bondToNext) * 100);
      const bondLabel = bondLevel >= BOND_CAP
        ? `Bond Lv. ${bondLevel} — MAX`
        : `Bond Lv. ${bondLevel}  ·  ${bondXp} / ${bondToNext} XP`;
      infoWrap.appendChild(this.buildInfoBar(bondLabel, bondPct, '#a855f7'));

      // Stats row
      const statsRow = document.createElement('div');
      statsRow.className = 'owmenu__player-stats';
      statsRow.innerHTML = `
        <span class="owmenu__pstat">Potions <b>${save.potionCount ?? 0}</b></span>
        <span class="owmenu__pstat">Bonded <b>${PlayerSaveManager.getBondedTeam(save).length}</b></span>
      `;
      infoWrap.appendChild(statsRow);

      body.appendChild(infoWrap);
    }

    this.panel.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'owmenu__detail-actions';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'owmenu__back-btn';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.showBonderMenu(); });
    actions.appendChild(backBtn);
    this.panel.appendChild(actions);
    this.show();
  }

  private calcSoulRank(save: OverworldSave): number {
    return Math.max(1, Math.floor(save.monariLevel / 10) + 1);
  }

  private buildInfoBar(label: string, pct: number, color: string): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'owmenu__player-bar-wrap';
    const track = document.createElement('div');
    track.className = 'owmenu__player-bar-track';
    const fill = document.createElement('div');
    fill.className = 'owmenu__player-bar-fill';
    fill.style.width = `${pct.toFixed(1)}%`;
    fill.style.background = color;
    track.appendChild(fill);
    wrap.appendChild(track);
    const lbl = document.createElement('div');
    lbl.className = 'owmenu__player-bar-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    return wrap;
  }

  // ── Team screen ───────────────────────────────────────────────────────────

  showTeamScreen(teamIds: string[]): void {
    this.currentTeamIds = [...teamIds];
    this.panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'owmenu__title';
    title.textContent = 'Monari Team';
    this.panel.appendChild(title);

    if (teamIds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'owmenu__empty-state';
      empty.textContent = 'No Monari partnered yet.';
      this.panel.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'owmenu__team-grid';

      for (const id of teamIds) {
        const monari = MINARI_ROSTER[id];
        if (!monari) continue;
        const card = this.buildMonariCard(id);
        grid.appendChild(card);
      }

      this.panel.appendChild(grid);
    }

    const actions = document.createElement('div');
    actions.className = 'owmenu__detail-actions';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'owmenu__back-btn';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.showBonderMenu();
    });
    actions.appendChild(backBtn);

    this.panel.appendChild(actions);
    this.show();
  }

  private buildMonariCard(id: string): HTMLDivElement {
    const monari = MINARI_ROSTER[id];
    const elem   = monari?.element ?? 'neutral';
    const color  = elemCss(elem);

    const card = document.createElement('div');
    card.className = 'owmenu__monari-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', monari?.name ?? id);

    const img = document.createElement('img');
    img.className = 'owmenu__card-avatar';
    img.src = `assets/monari/${id}/reference/fullbody.png`;
    img.alt = monari?.name ?? id;
    img.draggable = false;
    let cardImgFallback = 0;
    img.addEventListener('error', () => {
      cardImgFallback++;
      if (cardImgFallback === 1) img.src = `assets/monari/${id}/portraits/neutral.png`;
      else img.style.display = 'none';
    });
    card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'owmenu__card-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'owmenu__card-name';
    nameEl.textContent = monari?.name ?? id;
    info.appendChild(nameEl);

    const displayLevel = (this.playerSave && id === this.playerSave.starterMonariId)
      ? this.playerSave.monariLevel
      : LEVEL_DISPLAY;
    const levelEl = document.createElement('div');
    levelEl.className = 'owmenu__card-level';
    levelEl.textContent = `Lv.${displayLevel}`;
    info.appendChild(levelEl);

    const badge = document.createElement('span');
    badge.className = 'owmenu__elem-badge';
    badge.style.color = color;
    badge.textContent = elementLabel(elem);
    info.appendChild(badge);

    if (monari) {
      const bars = document.createElement('div');
      bars.className = 'owmenu__mini-bars';
      const hp   = scaleStat(monari.stats.maxHp);
      const aura = scaleStat(monari.stats.maxAura);
      bars.appendChild(this.buildMiniBar('HP',  hp   / 600, '#3be071'));
      bars.appendChild(this.buildMiniBar('AU',  aura / 400, '#36ccff'));
      bars.appendChild(this.buildMiniBar('PWR', monari.stats.power / 150, color));
      info.appendChild(bars);
    }

    card.appendChild(info);

    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.showMonariDetail(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.showMonariDetail(id); }
    });

    return card;
  }

  private buildMiniBar(label: string, ratio: number, color: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'owmenu__mini-bar';
    const lbl = document.createElement('span');
    lbl.className = 'owmenu__mini-bar-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const track = document.createElement('div');
    track.className = 'owmenu__mini-bar-track';
    const fill = document.createElement('div');
    fill.className = 'owmenu__mini-bar-fill';
    fill.style.width = `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
    fill.style.background = color;
    track.appendChild(fill);
    row.appendChild(track);
    return row;
  }

  // ── Monari Detail — centered modal ────────────────────────────────────────

  showMonariDetail(id: string): void {
    const monari = MINARI_ROSTER[id];
    if (!monari) return;

    this.dismissDetailModal();

    const elem  = monari.element ?? 'neutral';
    const color = elemCss(elem);
    const isPlayerStarter = this.playerSave && id === this.playerSave.starterMonariId;
    const realLevel = isPlayerStarter ? this.playerSave!.monariLevel : LEVEL_DISPLAY;

    const bg = document.createElement('div');
    bg.className = 'owmenu-dmodal-bg';

    const modal = document.createElement('div');
    modal.className = 'owmenu-dmodal';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'owmenu-dmodal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dismissDetailModal(); });
    modal.appendChild(closeBtn);

    // Image column
    const imgCol = document.createElement('div');
    imgCol.className = 'owmenu-dmodal__img-col';
    const imgEl = document.createElement('img');
    imgEl.className = 'owmenu-dmodal__img';
    imgEl.alt = monari.name;
    imgEl.draggable = false;
    imgEl.src = `assets/monari/${id}/reference/fullbody.png`;
    let imgFallback = 0;
    imgEl.addEventListener('error', () => {
      imgFallback++;
      if (imgFallback === 1) imgEl.src = `assets/monari/${id}/portraits/neutral.png`;
      else imgEl.style.display = 'none';
    });
    imgCol.appendChild(imgEl);
    modal.appendChild(imgCol);

    // Info column
    const infoCol = document.createElement('div');
    infoCol.className = 'owmenu-dmodal__info-col';

    // Name row (name + gender icon)
    const nameRow = document.createElement('div');
    nameRow.className = 'owmenu-dmodal__name-row';
    const nameEl = document.createElement('div');
    nameEl.className = 'owmenu-dmodal__name';
    nameEl.textContent = monari.name;
    nameRow.appendChild(nameEl);
    if (monari.gender && monari.gender !== 'unknown') {
      const gIcon = document.createElement('img');
      gIcon.className = 'owmenu-dmodal__gender';
      gIcon.src = `assets/ui/icons/gender_${monari.gender}.png`;
      gIcon.alt = monari.gender;
      gIcon.draggable = false;
      nameRow.appendChild(gIcon);
    }
    infoCol.appendChild(nameRow);

    const levelEl = document.createElement('div');
    levelEl.className = 'owmenu-dmodal__level';
    levelEl.textContent = `Lv.${realLevel}`;
    infoCol.appendChild(levelEl);

    // XP bars (only for player's starter)
    if (isPlayerStarter && this.playerSave) {
      const save = this.playerSave;
      const xpToNext = PlayerSaveManager.xpToNextLevel(save.monariLevel);
      const xpPct = save.monariLevel >= 100 ? 100 : Math.min(100, (save.monariXp / xpToNext) * 100);
      infoCol.appendChild(this.buildXpBar(
        save.monariLevel >= 100 ? 'MAX LEVEL' : `XP  ${save.monariXp} / ${xpToNext}`,
        xpPct,
        'owmenu-dmodal__xp-track',
        'owmenu-dmodal__xp-fill',
        'owmenu-dmodal__xp-text',
      ));

      const BOND_CAP = 10;
      const bondLevel = save.bondLevel ?? 1;
      const bondXp    = save.bondXp ?? 0;
      const bondToNext = PlayerSaveManager.bondXpToNextLevel(bondLevel);
      const bondPct   = bondLevel >= BOND_CAP ? 100 : Math.min(100, (bondXp / bondToNext) * 100);
      const bondWrap = document.createElement('div');
      bondWrap.className = 'owmenu-dmodal__bond-wrap';
      const bondLabel = document.createElement('div');
      bondLabel.className = 'owmenu-dmodal__bond-label';
      bondLabel.textContent = bondLevel >= BOND_CAP ? `Bond Lv. ${bondLevel} — MAX` : `Bond Lv. ${bondLevel}`;
      bondWrap.appendChild(bondLabel);
      bondWrap.appendChild(this.buildXpBar(
        bondLevel >= BOND_CAP ? 'MAX BOND' : `Bond XP  ${bondXp} / ${bondToNext}`,
        bondPct,
        'owmenu-dmodal__bond-track',
        'owmenu-dmodal__bond-fill',
        'owmenu-dmodal__bond-text',
      ));
      infoCol.appendChild(bondWrap);
    }

    // Badges
    const badgesRow = document.createElement('div');
    badgesRow.className = 'owmenu-dmodal__badges';
    const elemBadge = document.createElement('span');
    elemBadge.className = 'owmenu-dmodal__elem-badge';
    elemBadge.style.color = color;
    elemBadge.textContent = elementLabel(elem);
    badgesRow.appendChild(elemBadge);
    const rarBadge = document.createElement('span');
    rarBadge.className = 'owmenu-dmodal__rar-badge';
    rarBadge.textContent = rarityLabel(monari.rarity);
    badgesRow.appendChild(rarBadge);
    infoCol.appendChild(badgesRow);

    // Stats
    const statsH = document.createElement('div');
    statsH.className = 'owmenu-dmodal__section-heading';
    statsH.textContent = 'Base Stats';
    infoCol.appendChild(statsH);

    const s = monari.stats;
    const lvScale = (base: number): number =>
      Math.round(base * (1 + (realLevel - 1) * LEVEL_GROWTH));
    const statDefs = [
      { label: 'HP',      value: lvScale(s.maxHp)    },
      { label: 'Attack',  value: lvScale(s.power)     },
      { label: 'Sp.Atk',  value: Math.round(lvScale(s.power) * 0.88)  },
      { label: 'Defense', value: lvScale(s.defense)   },
      { label: 'Sp.Def',  value: Math.round(lvScale(s.defense) * 0.88) },
      { label: 'Speed',   value: lvScale(s.speed)     },
      { label: 'Aura',    value: lvScale(s.maxAura)   },
    ];
    const statRows = document.createElement('div');
    statRows.className = 'owmenu-dmodal__stat-rows';
    for (const def of statDefs) {
      statRows.appendChild(this.buildDetailStatRow(def.label, def.value, color));
    }
    infoCol.appendChild(statRows);

    // Techniques button
    const techBtn = document.createElement('button');
    techBtn.type = 'button';
    techBtn.className = 'owmenu-dmodal__tech-btn';
    techBtn.textContent = '⚔ Techniques →';
    techBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dismissDetailModal();
      this.showTechniquesModal(id);
    });
    infoCol.appendChild(techBtn);

    modal.appendChild(infoCol);
    bg.appendChild(modal);
    document.body.appendChild(bg);
    this.detailModalEl = bg;

    bg.addEventListener('pointerdown', (e) => {
      if (e.target === bg) this.dismissDetailModal();
    });
  }

  private buildXpBar(
    text: string,
    pct: number,
    trackClass: string,
    fillClass: string,
    textClass: string,
  ): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'owmenu-dmodal__xp-wrap';
    const track = document.createElement('div');
    track.className = trackClass;
    const fill = document.createElement('div');
    fill.className = fillClass;
    fill.style.width = `${pct.toFixed(1)}%`;
    track.appendChild(fill);
    wrap.appendChild(track);
    const label = document.createElement('div');
    label.className = textClass;
    label.textContent = text;
    wrap.appendChild(label);
    return wrap;
  }

  private buildDetailStatRow(label: string, value: number, barColor: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'owmenu-dmodal__stat-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'owmenu-dmodal__stat-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);
    const barWrap = document.createElement('div');
    barWrap.className = 'owmenu-dmodal__stat-bar-wrap';
    const fill = document.createElement('div');
    fill.className = 'owmenu-dmodal__stat-fill';
    fill.style.width = statPct(value, 400);
    fill.style.background = barColor;
    barWrap.appendChild(fill);
    row.appendChild(barWrap);
    const valEl = document.createElement('span');
    valEl.className = 'owmenu-dmodal__stat-val';
    valEl.textContent = String(value);
    row.appendChild(valEl);
    return row;
  }

  private dismissDetailModal(): void {
    this.detailModalEl?.remove();
    this.detailModalEl = null;
  }

  // ── Techniques modal ──────────────────────────────────────────────────────

  showTechniquesModal(id: string): void {
    const monari = MINARI_ROSTER[id];
    if (!monari) return;

    this.swapState = null;
    this.dismissTechModal();

    const save = this.playerSave;
    const equippedSlots = save
      ? PlayerSaveManager.getTechniqueSlots(save, id)
      : ['basic_attack', 'basic_attack', 'basic_attack', 'basic_attack'] as [string,string,string,string];
    const libraryIds = CLASSIC_TECHNIQUE_LIBRARY[id] ?? [];
    const ability = MONARI_ABILITIES[id];

    const bg = document.createElement('div');
    bg.className = 'owmenu-tech-bg';

    const modal = document.createElement('div');
    modal.className = 'owmenu-tech';
    modal.id = 'owmenu-tech-modal';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'owmenu-tech__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.swapState = null;
      this.dismissTechModal();
    });
    modal.appendChild(closeBtn);

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'owmenu-tech__title';
    titleBar.textContent = `TECHNIQUES — ${monari.name.toUpperCase()}`;
    modal.appendChild(titleBar);

    // Ability banner
    if (ability) {
      const abilityBanner = document.createElement('div');
      abilityBanner.className = 'owmenu-tech__ability';
      abilityBanner.innerHTML = `
        <span class="owmenu-tech__ability-label">ABILITY</span>
        <span class="owmenu-tech__ability-name">${ability.name}</span>
        <span class="owmenu-tech__ability-desc">${ability.description}</span>
      `;
      modal.appendChild(abilityBanner);
    }

    // Swap hint bar (shown when swap mode active)
    const swapHint = document.createElement('div');
    swapHint.className = 'owmenu-tech__swap-hint';
    swapHint.id = 'owmenu-tech-swap-hint';
    swapHint.textContent = 'Tap a technique in the library to swap it in.';
    swapHint.style.display = 'none';
    modal.appendChild(swapHint);

    // Body (left + right)
    const body = document.createElement('div');
    body.className = 'owmenu-tech__body';

    // ── Left: Equipped ──
    const equippedCol = document.createElement('div');
    equippedCol.className = 'owmenu-tech__col';
    const equippedH = document.createElement('div');
    equippedH.className = 'owmenu-tech__col-heading';
    equippedH.textContent = 'EQUIPPED  (4 slots)';
    equippedCol.appendChild(equippedH);

    equippedSlots.forEach((moveId, slotIdx) => {
      const move = CLASSIC_MOVES[moveId];
      const row = this.buildTechRow(moveId, move, slotIdx + 1);
      row.id = `owmenu-tech-slot-${slotIdx}`;
      row.setAttribute('data-slot', String(slotIdx));
      row.style.cursor = 'pointer';
      row.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.enterSwapMode(id, slotIdx, moveId, swapHint);
      });
      equippedCol.appendChild(row);
    });

    // Permanent actions section (below equipped, non-swappable)
    const permHeading = document.createElement('div');
    permHeading.className = 'owmenu-tech__col-heading owmenu-tech__col-heading--perm';
    permHeading.textContent = 'PERMANENT';
    equippedCol.appendChild(permHeading);

    for (const permId of ['basic_attack', 'guard'] as const) {
      const permMove = CLASSIC_MOVES[permId];
      const permRow = this.buildTechRow(permId, permMove);
      permRow.classList.add('owmenu-tech__move-row--perm');
      equippedCol.appendChild(permRow);
    }

    // ── Right: Library ──
    const libraryCol = document.createElement('div');
    libraryCol.className = 'owmenu-tech__col owmenu-tech__col--library';
    const libraryH = document.createElement('div');
    libraryH.className = 'owmenu-tech__col-heading';
    libraryH.textContent = 'MOVE LIBRARY';
    libraryCol.appendChild(libraryH);

    for (const moveId of libraryIds) {
      const move = CLASSIC_MOVES[moveId];
      const row = this.buildTechRow(moveId, move);
      row.setAttribute('data-lib-move', moveId);
      row.style.cursor = 'default';
      libraryCol.appendChild(row);
    }

    const libFooter = document.createElement('div');
    libFooter.className = 'owmenu-tech__lib-footer';
    libFooter.textContent = 'New techniques unlock as you level up.';
    libraryCol.appendChild(libFooter);

    body.appendChild(equippedCol);
    body.appendChild(libraryCol);
    modal.appendChild(body);

    bg.appendChild(modal);
    document.body.appendChild(bg);
    this.techModalEl = bg;

    bg.addEventListener('pointerdown', (e) => {
      if (e.target === bg) {
        this.swapState = null;
        this.dismissTechModal();
      }
    });
  }

  private enterSwapMode(
    monariId: string,
    slotIndex: number,
    oldMoveId: string,
    hintEl: HTMLElement,
  ): void {
    // Toggle: tap the same slot again to cancel
    if (this.swapState && this.swapState.slotIndex === slotIndex && this.swapState.monariId === monariId) {
      this.cancelSwapMode(hintEl);
      return;
    }
    this.swapState = { monariId, slotIndex, oldMoveId };
    hintEl.style.display = 'block';

    const modal = document.getElementById('owmenu-tech-modal');
    if (!modal) return;

    // Highlight selected slot
    modal.querySelectorAll('.owmenu-tech__move-row').forEach(el => {
      (el as HTMLElement).classList.remove('owmenu-tech__move-row--swap-source');
    });
    document.getElementById(`owmenu-tech-slot-${slotIndex}`)?.classList.add('owmenu-tech__move-row--swap-source');

    // Remove old swap buttons from library rows
    modal.querySelectorAll('.owmenu-tech__swap-btn').forEach(b => b.remove());

    // Add SWAP button to each library row
    modal.querySelectorAll('[data-lib-move]').forEach(el => {
      const libRow = el as HTMLElement;
      const libMoveId = libRow.dataset.libMove!;
      libRow.classList.add('owmenu-tech__move-row--lib-active');

      const swapBtn = document.createElement('button');
      swapBtn.type = 'button';
      swapBtn.className = 'owmenu-tech__swap-btn';
      swapBtn.textContent = '↓';
      swapBtn.setAttribute('aria-label', 'Swap in');
      swapBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.swapState) {
          this.executeSwap(monariId, this.swapState.slotIndex, libMoveId, hintEl);
        }
      });
      libRow.appendChild(swapBtn);
    });
  }

  private cancelSwapMode(hintEl: HTMLElement): void {
    this.swapState = null;
    hintEl.style.display = 'none';
    const modal = document.getElementById('owmenu-tech-modal');
    modal?.querySelectorAll('.owmenu-tech__move-row--swap-source').forEach(el =>
      (el as HTMLElement).classList.remove('owmenu-tech__move-row--swap-source'));
    modal?.querySelectorAll('.owmenu-tech__swap-btn').forEach(b => b.remove());
    modal?.querySelectorAll('.owmenu-tech__move-row--lib-active').forEach(el =>
      (el as HTMLElement).classList.remove('owmenu-tech__move-row--lib-active'));
  }

  private executeSwap(
    monariId: string,
    slotIndex: number,
    newMoveId: string,
    _hintEl: HTMLElement,
  ): void {
    if (!this.playerSave) return;

    const slots = PlayerSaveManager.getTechniqueSlots(this.playerSave, monariId);
    slots[slotIndex] = newMoveId;
    const newSave = PlayerSaveManager.setCustomSlots(this.playerSave, monariId, slots);
    this.playerSave = newSave;
    PlayerSaveManager.persist(newSave);

    this.swapState = null;
    this.dismissTechModal();
    this.showTechniquesModal(monariId);
  }

  private buildTechRow(
    moveId: string,
    move: import('../types/classic').ClassicMoveConfig | undefined,
    slot?: number,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'owmenu-tech__move-row';

    if (slot !== undefined) {
      const num = document.createElement('span');
      num.className = 'owmenu-tech__slot-num';
      num.textContent = `${slot}`;
      row.appendChild(num);
    }

    const icon = catIcon(move);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'owmenu-tech__move-name';
    nameSpan.textContent = `${icon} ${move?.displayName ?? moveId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
    row.appendChild(nameSpan);

    if (move) {
      const metaSpan = document.createElement('span');
      metaSpan.className = 'owmenu-tech__move-meta';
      const au = move.auraCost ?? 0;
      const parts: string[] = [
        `<span style="color:#ff8844">PWR ${move.power}</span>`,
        `<span style="color:#44aaff">AU ${au}</span>`,
      ];
      if (move.accuracy != null) parts.push(`<span style="color:#aac8dd">ACC ${move.accuracy}%</span>`);
      metaSpan.innerHTML = parts.join(' <span style="color:#445">|</span> ');
      row.appendChild(metaSpan);
    }

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'owmenu-tech__info-btn';
    infoBtn.textContent = 'ℹ';
    infoBtn.setAttribute('aria-label', `Details: ${move?.displayName ?? moveId}`);
    infoBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showMovePopup(moveId, move);
    });
    row.appendChild(infoBtn);

    return row;
  }

  private dismissTechModal(): void {
    this.techModalEl?.remove();
    this.techModalEl = null;
  }

  // ── Move detail popup ─────────────────────────────────────────────────────

  private showMovePopup(
    moveId: string,
    move: import('../types/classic').ClassicMoveConfig | undefined,
  ): void {
    this.dismissMovePopup();

    const bg = document.createElement('div');
    bg.className = 'owmenu-mpop-bg';

    const card = document.createElement('div');
    card.className = 'owmenu-mpop';

    const icon     = catIcon(move);
    const catLabel = move?.holdsStance ? 'Guard'
      : move?.category === 'special'  ? 'Special'
      : move?.category === 'physical' ? 'Physical'
      : 'Status';
    const typeColor = ELEM_CSS[move?.damageType ?? 'neutral'] ?? ELEM_CSS.neutral;
    const auraCost  = move?.auraCost ?? 0;
    const accStr    = (move?.accuracy != null) ? `${move.accuracy}%` : '100%';
    const desc      = move?.description ?? '';
    const name      = move?.displayName ?? moveId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const typeLabel = (move?.damageType ?? 'neutral');
    const typeStr   = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

    card.innerHTML = `
      <div class="owmenu-mpop__header">
        <span class="owmenu-mpop__name">${name}</span>
        <button class="owmenu-mpop__close" type="button">✕</button>
      </div>
      <div class="owmenu-mpop__badges">
        <span class="owmenu-mpop__cat">${icon} ${catLabel}</span>
        <span class="owmenu-mpop__type" style="color:${typeColor}">● ${typeStr}</span>
      </div>
      <div class="owmenu-mpop__stats">
        <div class="owmenu-mpop__stat"><span class="owmenu-mpop__stat-label">Power</span><span class="owmenu-mpop__stat-val" style="color:#ff8844">${move?.power ?? 0}</span></div>
        <div class="owmenu-mpop__stat"><span class="owmenu-mpop__stat-label">Aura Cost</span><span class="owmenu-mpop__stat-val" style="color:#44aaff">AU ${auraCost}</span></div>
        <div class="owmenu-mpop__stat"><span class="owmenu-mpop__stat-label">Accuracy</span><span class="owmenu-mpop__stat-val">${accStr}</span></div>
      </div>
      ${desc ? `<p class="owmenu-mpop__desc">${desc}</p>` : ''}
    `;

    bg.appendChild(card);
    document.body.appendChild(bg);
    this.movePopupEl = bg;

    (card.querySelector('.owmenu-mpop__close') as HTMLButtonElement).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dismissMovePopup();
    });
    bg.addEventListener('pointerdown', (e) => {
      if (e.target === bg) this.dismissMovePopup();
    });
  }

  private dismissMovePopup(): void {
    this.movePopupEl?.remove();
    this.movePopupEl = null;
  }

  // ── Public close ──────────────────────────────────────────────────────────

  close(): void {
    this.swapState = null;
    this.dismissMovePopup();
    this.dismissDetailModal();
    this.dismissTechModal();
    this.hide();
  }

  destroy(): void {
    this.swapState = null;
    this.dismissMovePopup();
    this.dismissDetailModal();
    this.dismissTechModal();
    this.root.remove();
  }
}
