export const UI_THEME = {
  colors: {
    ink: 0x080814,
    panel: 0x101024,
    panelDeep: 0x070711,
    glass: 0x151630,
    stroke: 0xd7b56d,
    strokeDim: 0x6d5b9a,
    purple: 0x8c5cff,
    gold: 0xffd76a,
    whiteGold: 0xfff0b8,
    text: '#f6f0ff',
    textDim: '#aaa6c8',
    textMuted: '#6f6a90',
    danger: 0xff4e5f,
  },
  panels: {
    alpha: 0.84,
    deepAlpha: 0.94,
    radius: 16,
    strokeAlpha: 0.58,
    glowAlpha: 0.22,
  },
  bars: {
    hp: 0x3be071,
    hpWarn: 0xffd34f,
    hpDanger: 0xff4c5f,
    aura: 0x36ccff,
    auraDeep: 0x1778ff,
    soulSync: 0xffd84f,
    soulSyncDeep: 0xffa629,
    track: 0x141426,
  },
  rarity: {
    common: 0xc9d2e3,
    uncommon: 0x67e0a3,
    rare: 0x5fb7ff,
    super_rare: 0xb47cff,
    ultra_rare: 0xffcf5b,
    legendary: 0xff7f4f,
    mythic: 0xf3f0ff,
  },
  element: {
    // Official MVP element palette
    fire:    0xff6b35,
    water:   0x38c8ff,
    flora:   0x66c86d,
    wind:    0x66e7de,
    thunder: 0xffe65c,
    stone:   0xa08a6a,
    steel:   0x8899bb,
    light:   0xfff0b8,
    dark:    0x8b5cff,
    aether:  0xd7c6ff,
    ice:     0x88ddff,
    neutral: 0x9da3c7,
    // Legacy aliases (kept so old references don't break at runtime)
    ember:    0xff6b35,
    aqua:     0x38c8ff,
    terra:    0x66c86d,
    earth:    0x66c86d,
    shadow:   0x8b5cff,
    bolt:     0xffe65c,
    gale:     0x66e7de,
    physical: 0xd09055,
    none:     0x9da3c7,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 28 },
  fonts: {
    /** Primary UI font — used for names, labels, HUD text. Falls back to Arial. */
    family:  '"Orbitron", "Arial", sans-serif',
    /** Stat / value readout font — narrower, highly readable for numbers. */
    stat:    '"Rajdhani", "Arial Narrow", sans-serif',
    /** Legacy fallback — monospace for debug/BattleLab panels. */
    mono:    'monospace',
    tiny: '10px',
    sm:   '12px',
    md:   '14px',
    lg:   '18px',
    xl:   '24px',
  },
  buttons: {
    alpha: 0.78,
    selectedAlpha: 0.96,
    disabledAlpha: 0.32,
    radius: 14,
  },
  mobile: {
    hudScale: 1.08,
    minTap: 44,
    safeEdge: 12,
    joystickDeadzone: 0.22,
  },
} as const;

export type UIElementKey = keyof typeof UI_THEME.element;
export type UIRarityKey = keyof typeof UI_THEME.rarity;

export function elementColor(element?: string): number {
  const key = (element ?? 'none').toLowerCase() as UIElementKey;
  return UI_THEME.element[key] ?? UI_THEME.element.none;
}

export function rarityColor(rarity?: string): number {
  const key = (rarity ?? 'common').toLowerCase() as UIRarityKey;
  if (key === 'mythic') return UI_THEME.rarity.ultra_rare;
  return UI_THEME.rarity[key] ?? UI_THEME.rarity.common;
}

export function rarityLabel(rarity?: string): string {
  switch ((rarity ?? 'common').toLowerCase()) {
    case 'super_rare': return 'Super Rare';
    case 'ultra_rare':
    case 'mythic': return 'Ultra Rare';
    default: return (rarity ?? 'Common').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

export function elementLabel(element?: string): string {
  const normalized = (element ?? 'neutral').toLowerCase();
  const labels: Record<string, string> = {
    fire: 'Fire', water: 'Water', flora: 'Flora', wind: 'Wind',
    thunder: 'Thunder', stone: 'Stone', steel: 'Steel', light: 'Light',
    dark: 'Dark', aether: 'Aether', ice: 'Ice', neutral: 'Neutral',
  };
  return labels[normalized] ?? normalized.replace(/\b\w/g, c => c.toUpperCase());
}
