/**
 * Central element effectiveness chart for MONARIUM.
 * All in-battle type matchups flow through getElementModifier().
 *
 * Official element list: Neutral, Ember, Aqua, Terra, Gale, Bolt, Ice, Shadow, Light, Aether.
 * Unspecified matchups default to 1.0 (neutral).
 *
 * Starter triangle (MVP):
 *   Aqua → Ember 1.25 / Ember → Aqua 0.75
 *   Ember → Terra 1.25 / Terra → Ember 0.75
 *   Terra → Aqua  1.25 / Aqua  → Terra 0.75
 *
 * To add matchups: edit ELEMENT_CHART below only — nothing else changes.
 */

export type ElementName =
  | 'neutral' | 'ember' | 'aqua' | 'terra'
  | 'gale'   | 'bolt'  | 'ice'  | 'shadow'
  | 'light'  | 'aether';

export const ELEMENT_MODIFIERS = {
  EFFECTIVE: 1.25,
  RESISTED:  0.75,
  NEUTRAL:   1.0,
} as const;

/** Display labels for the UI (Title-case). */
export const ELEMENT_LABELS: Record<ElementName, string> = {
  neutral: 'Neutral',
  ember:   'Ember',
  aqua:    'Aqua',
  terra:   'Terra',
  gale:    'Gale',
  bolt:    'Bolt',
  ice:     'Ice',
  shadow:  'Shadow',
  light:   'Light',
  aether:  'Aether',
};

/**
 * attackingElement → defendingElement → modifier.
 * Omit a pair to default to 1.0.
 */
const ELEMENT_CHART: Partial<Record<ElementName, Partial<Record<ElementName, number>>>> = {
  // Starter triangle
  aqua:   { ember: 1.25, terra: 0.75 },
  ember:  { terra: 1.25, aqua:  0.75 },
  terra:  { aqua:  1.25, ember: 0.75 },
  // Shadow / Light
  shadow: { light: 1.25, shadow: 0.75 },
  light:  { shadow: 1.25, light:  0.75 },
  // Neutral never hits for advantage or resistance in MVP pass
};

export function getElementModifier(attacking: string, defending: string): number {
  return ELEMENT_CHART[attacking as ElementName]?.[defending as ElementName]
    ?? ELEMENT_MODIFIERS.NEUTRAL;
}

/** Player-facing effectiveness text, or null for neutral (no message shown). */
export function getEffectivenessMessage(modifier: number): string | null {
  if (modifier > 1.0) return 'It was effective!';
  if (modifier < 1.0) return 'It was resisted!';
  return null;
}

/** Short label for the Battle Lab display: "1.25 (Effective)" etc. */
export function getEffectivenessLabel(modifier: number): string {
  if (modifier > 1.0) return `${modifier}× (Effective)`;
  if (modifier < 1.0) return `${modifier}× (Resisted)`;
  return `${modifier}× (Neutral)`;
}
