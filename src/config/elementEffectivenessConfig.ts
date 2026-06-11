/**
 * Central element effectiveness chart for MONARIUM — MVP locked chart.
 * All in-battle type matchups flow through getElementModifier().
 *
 * Terminology (precise):
 *   "Effective" — the attacking element is STRONG AGAINST the defender → ×1.75
 *   "Resisted"  — the defending element RESISTS the attacking element  → ×0.75
 *   "Neutral"   — no special relationship                              → ×1.0
 *
 * Important distinction: "resisted" describes the defender resisting, NOT the
 * attacker being weak. These are not the same concept.
 *
 * Chart is keyed by the ATTACKING element.
 *   strongAgainst — defenders this element hits for ×1.75
 *   resistedBy    — defenders that reduce this element to ×0.75
 *
 * Starter triangle:
 *   Water beats Fire  (Water strong against Fire / Fire resisted by Water)
 *   Fire beats Flora  (Fire strong against Flora / Flora resisted by Fire)
 *   Flora beats Water (Flora strong against Water / Water resisted by Flora)
 *
 * Do NOT use 2× damage in MVP — MONARIUM's multi-layer systems (Aura, Sync,
 * Guard, Bond) make 2× too swingy. 1.75×/0.75× is the current starter-triangle range.
 *
 * To add matchups: edit ELEMENT_CHART only — all helpers derive from it.
 */

export type ElementName =
  | 'fire' | 'water' | 'flora' | 'wind' | 'thunder' | 'stone'
  | 'steel' | 'light' | 'dark' | 'aether' | 'ice' | 'neutral';

export const ELEMENT_MODIFIERS = {
  EFFECTIVE: 1.75,
  RESISTED:  0.75,
  NEUTRAL:   1.0,
} as const;

interface ElementRelations {
  /** Defending elements this attacking element deals ×1.75 against. */
  strongAgainst: ElementName[];
  /** Defending elements that reduce this element to ×0.75. */
  resistedBy:    ElementName[];
}

/**
 * MVP locked type chart.
 * Each entry is keyed by the ATTACKING element.
 */
const ELEMENT_CHART: Record<ElementName, ElementRelations> = {
  fire:    { strongAgainst: ['flora', 'steel', 'ice'],             resistedBy: ['water', 'stone'] },
  water:   { strongAgainst: ['fire', 'stone'],                      resistedBy: ['flora', 'thunder'] },
  flora:   { strongAgainst: ['water', 'stone'],                     resistedBy: ['fire', 'wind', 'ice'] },
  wind:    { strongAgainst: ['flora'],                               resistedBy: ['thunder', 'ice'] },
  thunder: { strongAgainst: ['water', 'wind'],                      resistedBy: ['stone'] },
  stone:   { strongAgainst: ['fire', 'thunder', 'wind', 'ice'],    resistedBy: ['water', 'flora', 'steel'] },
  steel:   { strongAgainst: ['stone', 'ice'],                       resistedBy: ['fire'] },
  light:   { strongAgainst: ['dark'],                                resistedBy: ['aether'] },
  dark:    { strongAgainst: ['aether'],                              resistedBy: ['light'] },
  aether:  { strongAgainst: ['light'],                               resistedBy: ['dark', 'steel'] },
  ice:     { strongAgainst: ['flora', 'wind', 'aether'],            resistedBy: ['fire', 'stone', 'steel'] },
  neutral: { strongAgainst: [],                                       resistedBy: [] },
};

/** Official display labels (Title-case). */
export const ELEMENT_LABELS: Record<ElementName, string> = {
  fire:    'Fire',
  water:   'Water',
  flora:   'Flora',
  wind:    'Wind',
  thunder: 'Thunder',
  stone:   'Stone',
  steel:   'Steel',
  light:   'Light',
  dark:    'Dark',
  aether:  'Aether',
  ice:     'Ice',
  neutral: 'Neutral',
};

/**
 * Returns the damage multiplier for an attack of `attacking` element
 * landing on a Monari whose element is `defending`.
 *
 * ×1.75 = attacking element is strong against the defender
 * ×0.75 = defending element resists the attacking element
 * ×1.0  = neutral (default for any unknown pairing)
 */
export function getElementModifier(attacking: string, defending: string): number {
  const chart = ELEMENT_CHART[attacking as ElementName];
  if (!chart) return ELEMENT_MODIFIERS.NEUTRAL;
  if (chart.strongAgainst.includes(defending as ElementName)) return ELEMENT_MODIFIERS.EFFECTIVE;
  if (chart.resistedBy.includes(defending as ElementName)) return ELEMENT_MODIFIERS.RESISTED;
  return ELEMENT_MODIFIERS.NEUTRAL;
}

/**
 * Short semantic label used internally and in the Battle Lab.
 *   ×1.75 → 'effective'
 *   ×0.75 → 'resisted'
 *   ×1.0  → 'neutral'
 */
export function getEffectivenessLabel(modifier: number): 'effective' | 'resisted' | 'neutral' {
  if (modifier > 1.0) return 'effective';
  if (modifier < 1.0) return 'resisted';
  return 'neutral';
}

/**
 * Battle callout message shown after a type-advantage/disadvantage hit.
 * Returns null for neutral hits (no message shown in normal battle).
 *   ×1.75 → "It was effective!"
 *   ×0.75 → "It was resisted!"
 *   ×1.0  → null
 */
export function getEffectivenessMessage(modifier: number): string | null {
  if (modifier > 1.0) return 'It was effective!';
  if (modifier < 1.0) return 'It was resisted!';
  return null;
}

/**
 * Long label for Battle Lab display.
 *   ×1.75 → "1.75× Effective"
 *   ×0.75 → "0.75× Resisted"
 *   ×1.0  → "1.0× Neutral"
 */
export function getEffectivenessBattleLabLabel(modifier: number): string {
  if (modifier > 1.0) return `${modifier}× Effective`;
  if (modifier < 1.0) return `${modifier}× Resisted`;
  return '1.0× Neutral';
}

// ── Starter triangle assertion tests ─────────────────────────────────────────

const STARTER_TRIANGLE_CASES = [
  { atk: 'water',   def: 'fire',   expected: 1.75, label: 'Water → Fire (effective)'  },
  { atk: 'fire',    def: 'flora',  expected: 1.75, label: 'Fire → Flora (effective)'  },
  { atk: 'flora',   def: 'water',  expected: 1.75, label: 'Flora → Water (effective)' },
  { atk: 'fire',    def: 'water',  expected: 0.75, label: 'Fire → Water (resisted)'   },
  { atk: 'water',   def: 'flora',  expected: 0.75, label: 'Water → Flora (resisted)'  },
  { atk: 'flora',   def: 'fire',   expected: 0.75, label: 'Flora → Fire (resisted)'   },
  { atk: 'neutral', def: 'fire',   expected: 1.0,  label: 'Neutral → Fire (neutral)'  },
] as const;

/**
 * Runs the 7 starter-triangle assertion cases.
 * Logs failures to console.error. Returns pass/total count and per-case log.
 */
export function runStarterTriangleAssertions(): { pass: number; total: number; log: string[] } {
  let pass = 0;
  const log: string[] = [];
  for (const c of STARTER_TRIANGLE_CASES) {
    const got = getElementModifier(c.atk, c.def);
    const ok  = Math.abs(got - c.expected) < 0.001;
    if (ok) {
      pass++;
      log.push(`✓ ${c.label}: ${got}`);
    } else {
      log.push(`✗ ${c.label}: expected ${c.expected}, got ${got}`);
      console.error(`[ElementChart FAIL] ${c.label}: expected ${c.expected}, got ${got}`);
    }
  }
  return { pass, total: STARTER_TRIANGLE_CASES.length, log };
}
