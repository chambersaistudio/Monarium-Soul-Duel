import './OverworldMenuOverlay.css';
import { MINARI_ROSTER } from '../data/minariData';
import { elementLabel, rarityLabel } from '../config/uiTheme';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS } from '../data/classicMoveData';
import type { OverworldSave } from '../systems/PlayerSaveManager';
import { PlayerSaveManager } from '../systems/PlayerSaveManager';

// ── Element accent colours (CSS hex strings) ──────────────────────────────────

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

// ── Move category icon ────────────────────────────────────────────────────────

function catIcon(move: import('../types/classic').ClassicMoveConfig | undefined): string {
  if (!move) return '◎';
  if (move.holdsStance) return '🛡';
  if (move.category === 'special')  return '✦';
  if (move.category === 'physical') return '⚔';
  return '◎';
}

// ── Move descriptions ─────────────────────────────────────────────────────────

const MOVE_DESCRIPTIONS: Record<string, string> = {
  basic_attack:     'A reliable strike that costs no Aura.',
  guard:            'Brace for the next hit — significantly reduces incoming damage.',
  flame_paw_barrage:'Relentless fire claw combo that overwhelms the opponent.',
  ember_shot:       'A focused burst of flame launched at range.',
  heat_guard:       'Fire aura shield that burns enemies who strike Flarepaw.',
  blinding_flare:   'Bright flash disrupts the opponent, draining their Soul Sync.',
  aqua_ripple:      'A surging water projectile that hits hard at range.',
  crystal_knuckle:  'A hardened water-crystal punch delivered up close.',
  shell_guard:      'Surround the body in water armor to absorb the next hit.',
  tidal_feint:      'A deceptive water feint that saps the opponent\'s Soul Sync.',
  vine_snap:        'A whipping vine strike that stings on contact.',
  root_pulse:       'Shockwaves sent through earth roots erupt beneath the enemy.',
  bark_guard:       'Hardens bark plating to absorb the next incoming hit.',
  pollen_haze:      'Releases a status cloud that steadily drains Soul Sync.',
  shadow_coil:      'Dark energy coils around the opponent and constricts.',
};

// ── Menu item definitions ─────────────────────────────────────────────────────

const BONDER_MENU_ITEMS = [
  'Monari',
  'Bag',
  'Codex',
  'Player',
  'Settings',
  'Save',
  'Mode Select',
  'Back / Close',
] as const;

type BonderMenuItem = typeof BONDER_MENU_ITEMS[number];

// ── Callback interface ────────────────────────────────────────────────────────

export interface MenuCallbacks {
  onClose:      () => void;
  onModeSelect: () => void;
  onSave?:      () => void;
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
    const monari  = MINARI_ROSTER[id];
    const elem    = monari?.element ?? 'neutral';
    const color   = elemCss(elem);

    const card = document.createElement('div');
    card.className = 'owmenu__monari-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', monari?.name ?? id);

    // Avatar — fullbody first, then portrait, then hide
    const img = document.createElement('img');
    img.className = 'owmenu__card-avatar';
    img.src = `assets/monari/${id}/reference/fullbody.png`;
    img.alt = monari?.name ?? id;
    img.draggable = false;
    let cardImgFallback = 0;
    img.addEventListener('error', () => {
      cardImgFallback++;
      if (cardImgFallback === 1) {
        img.src = `assets/monari/${id}/portraits/neutral.png`;
      } else {
        img.style.display = 'none';
      }
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

      bars.appendChild(this.buildMiniBar('HP',  hp  / 600, '#3be071'));
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.showMonariDetail(id);
      }
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

    // ── Close button ──
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'owmenu-dmodal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dismissDetailModal(); });
    modal.appendChild(closeBtn);

    // ── Image column ──
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

    // ── Info column ──
    const infoCol = document.createElement('div');
    infoCol.className = 'owmenu-dmodal__info-col';

    const nameEl = document.createElement('div');
    nameEl.className = 'owmenu-dmodal__name';
    nameEl.textContent = monari.name;
    infoCol.appendChild(nameEl);

    const levelEl = document.createElement('div');
    levelEl.className = 'owmenu-dmodal__level';
    levelEl.textContent = `Lv.${realLevel}`;
    infoCol.appendChild(levelEl);

    // XP bar — only for player's own starter
    if (isPlayerStarter) {
      const save = this.playerSave!;
      const xpToNext = PlayerSaveManager.xpToNextLevel(save.monariLevel);
      const xpPct = save.monariLevel >= 100 ? 100 : Math.min(100, (save.monariXp / xpToNext) * 100);

      const xpWrap = document.createElement('div');
      xpWrap.className = 'owmenu-dmodal__xp-wrap';
      const xpTrack = document.createElement('div');
      xpTrack.className = 'owmenu-dmodal__xp-track';
      const xpFill = document.createElement('div');
      xpFill.className = 'owmenu-dmodal__xp-fill';
      xpFill.style.width = `${xpPct.toFixed(1)}%`;
      xpTrack.appendChild(xpFill);
      xpWrap.appendChild(xpTrack);
      const xpText = document.createElement('div');
      xpText.className = 'owmenu-dmodal__xp-text';
      xpText.textContent = save.monariLevel >= 100 ? 'MAX LEVEL' : `XP ${save.monariXp} / ${xpToNext}`;
      xpWrap.appendChild(xpText);
      infoCol.appendChild(xpWrap);
    }

    // Element + rarity badges
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

    // ── Stats ──
    const statsH = document.createElement('div');
    statsH.className = 'owmenu-dmodal__section-heading';
    statsH.textContent = 'Base Stats';
    infoCol.appendChild(statsH);

    const s = monari.stats;
    const lvScale = (base: number): number =>
      Math.round(base * (1 + (realLevel - 1) * LEVEL_GROWTH));

    const statDefs: Array<{ label: string; value: number }> = [
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

    // ── Moves ──
    const movesH = document.createElement('div');
    movesH.className = 'owmenu-dmodal__section-heading';
    movesH.textContent = 'Moves';
    infoCol.appendChild(movesH);

    const movesList = document.createElement('div');
    movesList.className = 'owmenu-dmodal__moves-list';

    const battleMoveIds: string[] = CLASSIC_COMMAND_SETS[id] ?? [];

    for (const moveId of battleMoveIds) {
      const move = CLASSIC_MOVES[moveId];
      const row  = document.createElement('div');
      row.className = 'owmenu-dmodal__move-row';

      const icon = catIcon(move);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'owmenu-dmodal__move-name';
      nameSpan.textContent = `${icon} ${move?.displayName ?? moveId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
      row.appendChild(nameSpan);

      if (move) {
        const metaSpan = document.createElement('span');
        metaSpan.className = 'owmenu-dmodal__move-meta';
        const auraCost = move.auraCost ?? 0;
        const parts: string[] = [
          `<span style="color:#ff8844">PWR ${move.power}</span>`,
          `<span style="color:#44aaff">AU ${auraCost}</span>`,
        ];
        if (move.accuracy != null) {
          parts.push(`<span style="color:#aac8dd">ACC ${move.accuracy}%</span>`);
        }
        metaSpan.innerHTML = parts.join(' <span style="color:#445">|</span> ');
        row.appendChild(metaSpan);
      }

      const infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'owmenu-dmodal__move-info-btn';
      infoBtn.setAttribute('aria-label', `Info: ${move?.displayName ?? moveId}`);
      infoBtn.textContent = 'ℹ';
      infoBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showMovePopup(moveId, move);
      });
      row.appendChild(infoBtn);

      movesList.appendChild(row);
    }
    infoCol.appendChild(movesList);

    modal.appendChild(infoCol);
    bg.appendChild(modal);
    document.body.appendChild(bg);
    this.detailModalEl = bg;

    bg.addEventListener('pointerdown', (e) => {
      if (e.target === bg) this.dismissDetailModal();
    });
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

  // ── Move detail popup ─────────────────────────────────────────────────────

  private showMovePopup(moveId: string, move: import('../types/classic').ClassicMoveConfig | undefined): void {
    this.dismissMovePopup();

    const bg = document.createElement('div');
    bg.className = 'owmenu-mpop-bg';

    const card = document.createElement('div');
    card.className = 'owmenu-mpop';

    const icon    = catIcon(move);
    const catLabel = move?.holdsStance ? 'Guard'
      : move?.category === 'special'  ? 'Special'
      : move?.category === 'physical' ? 'Physical'
      : 'Status';
    const typeColor = ELEM_CSS[move?.damageType ?? 'neutral'] ?? ELEM_CSS.neutral;
    const auraCost  = move?.auraCost ?? 0;
    const accStr    = (move?.accuracy != null) ? `${move.accuracy}%` : '100%';
    const desc      = MOVE_DESCRIPTIONS[moveId] ?? '';
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

  // ── Public close (called by external scene) ───────────────────────────────

  close(): void {
    this.dismissMovePopup();
    this.dismissDetailModal();
    this.hide();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(): void {
    this.dismissMovePopup();
    this.dismissDetailModal();
    this.root.remove();
  }
}
