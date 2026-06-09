export const UI_THEME = {
  fonts: {
    body: '"Segoe UI", "Avenir Next", Arial, sans-serif',
    bold: '"Segoe UI Semibold", "Avenir Next", Arial, sans-serif'
  },
  colors: {
    glassTop: 0x241633,
    glassMid: 0x161827,
    glassDeep: 0x080712,
    aether: 0x8f5cff,
    aetherBright: 0xb996ff,
    gold: 0xffd37a,
    ember: 0xff7a35,
    emberSoft: 0xffb260,
    aqua: 0x42cfff,
    aquaSoft: 0xa7efff,
    terra: 0x58d878,
    shadow: 0x3a214f,
    hpStart: 0x35f08a,
    hpEnd: 0xb7ffd4,
    text: 0xfff8ea,
    mutedText: 0xd8d0eb,
    disabledText: 0x9185a8
  },
  opacity: {
    panel: 0.78,
    shelf: 0.34,
    glow: 0.16,
    disabled: 0.56
  },
  radius: {
    panel: 14,
    card: 13,
    pill: 11
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18
  }
} as const;

export type UiTheme = typeof UI_THEME;
