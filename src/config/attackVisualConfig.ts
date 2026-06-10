/**
 * Attack visual pipeline data structures.
 * Each entry describes the VFX asset, framing, and metadata for one attack.
 * Assets are 2D/2.5D anime-style, contained within the battle frame,
 * default direction is left-to-right (player attacking enemy).
 */

export type AttackElement =
  | 'fire' | 'water' | 'flora' | 'wind' | 'thunder'
  | 'stone' | 'steel' | 'light' | 'dark' | 'aether' | 'ice' | 'neutral';

export type AnimDirection = 'ltr' | 'rtl' | 'both';

export interface AttackVisualConfig {
  /** Matches the move id in classicMoveData. */
  attackId:     string;
  element:      AttackElement;
  /** Path to sprite sheet or animation atlas (relative to public/). */
  animPath?:    string;
  /** Path to a single still frame used as a preview or fallback. */
  previewPath?: string;
  /** Default play direction. 'ltr' = player → enemy, 'rtl' = enemy → player. */
  direction:    AnimDirection;
  /** Base power value (mirrors classicMoveData — used for VFX intensity scaling). */
  power?:       number;
  /** Aura cost from classicMoveData — can drive particle density or colour. */
  auraCost?:    number;
  /** Free-form notes for artists and engineers. */
  notes?:       string;
}

/** Registry of all defined attack visuals, keyed by attackId. */
export const ATTACK_VISUALS: Record<string, AttackVisualConfig> = {
  basic_attack: {
    attackId:  'basic_attack',
    element:   'neutral',
    direction: 'ltr',
    power:     40,
    notes:     'Generic strike impact flash — white/grey burst, no element tint.',
  },
  guard: {
    attackId:  'guard',
    element:   'neutral',
    direction: 'both',
    notes:     'Defensive shimmer / barrier pulse around the guarding Monari.',
  },
  flame_paw_barrage: {
    attackId:   'flame_paw_barrage',
    element:    'fire',
    direction:  'ltr',
    power:      55,
    notes:      'Three rapid fire-claw slashes with ember scatter.',
  },
  ember_shot: {
    attackId:  'ember_shot',
    element:   'fire',
    direction: 'ltr',
    power:     60,
    auraCost:  20,
    notes:     'Compact fireball projectile, pops on contact.',
  },
  heat_guard: {
    attackId:  'heat_guard',
    element:   'fire',
    direction: 'both',
    auraCost:  15,
    notes:     'Flame-aura barrier around caster — orange glow pulse.',
  },
  blinding_flare: {
    attackId:  'blinding_flare',
    element:   'fire',
    direction: 'ltr',
    power:     75,
    auraCost:  30,
    notes:     'Wide screen-filling flash, then recedes to reveal hit.',
  },
  aqua_ripple: {
    attackId:  'aqua_ripple',
    element:   'water',
    direction: 'ltr',
    power:     50,
    notes:     'Expanding water-ring wave, dampens on impact.',
  },
  crystal_knuckle: {
    attackId:  'crystal_knuckle',
    element:   'water',
    direction: 'ltr',
    power:     65,
    notes:     'Ice-crystal fist slam, shatters on hit.',
  },
  shell_guard: {
    attackId:  'shell_guard',
    element:   'water',
    direction: 'both',
    auraCost:  15,
    notes:     'Bubble shield encases caster — teal shimmer.',
  },
  tidal_feint: {
    attackId:  'tidal_feint',
    element:   'water',
    direction: 'ltr',
    power:     70,
    auraCost:  25,
    notes:     'Dash-through wave attack, leaves water splash trail.',
  },
  vine_snap: {
    attackId:  'vine_snap',
    element:   'flora',
    direction: 'ltr',
    power:     50,
    notes:     'Whipping vine strike — green crack VFX.',
  },
  root_pulse: {
    attackId:  'root_pulse',
    element:   'flora',
    direction: 'ltr',
    power:     60,
    notes:     'Ground-erupting roots spike upward under enemy.',
  },
  bark_guard: {
    attackId:  'bark_guard',
    element:   'flora',
    direction: 'both',
    auraCost:  15,
    notes:     'Bark-plate armour materialises around caster — earthy brown glow.',
  },
  pollen_haze: {
    attackId:  'pollen_haze',
    element:   'flora',
    direction: 'ltr',
    power:     65,
    auraCost:  25,
    notes:     'Toxic pollen cloud drifts ltr, lingers on enemy.',
  },
  shadow_coil: {
    attackId:  'shadow_coil',
    element:   'dark',
    direction: 'ltr',
    power:     60,
    notes:     'Tendril of shadow wraps and squeezes — purple/black spiral.',
  },
};

export function getAttackVisual(attackId: string): AttackVisualConfig | undefined {
  return ATTACK_VISUALS[attackId];
}
