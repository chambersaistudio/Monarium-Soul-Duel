import type { CodexElement, TechniqueCategory } from './codex/codexTypes';

export interface SpecialMoveConfig {
  id: string;
  name: string;
  monariId: string;
  element: CodexElement;
  category: TechniqueCategory;
  auraCost: number;
  burstCost: number;
  openerType: 'physical-paw-strike' | 'water-impact';
  cinematicPath: string;
  description: string;
  power: number;
  accuracy: number;
}

export const SPECIAL_MOVE_REGISTRY: Record<string, SpecialMoveConfig> = {
  flarepaw: {
    id: 'flame-paw-barrage',
    name: 'Flame Paw Barrage',
    monariId: 'flarepaw',
    element: 'Fire',
    category: 'Special',
    auraCost: 35,
    burstCost: 100,
    openerType: 'physical-paw-strike',
    cinematicPath: '/assets/monari/flarepaw/cinematics/specials/flame_paw_barrage/flame_paw_barrage.mp4',
    description: 'Flarepaw rushes in with blazing paw strikes and unleashes a rapid cinematic fire barrage.',
    power: 80,
    accuracy: 92,
  },
  droplet: {
    id: 'water-wheel-smash',
    name: 'Water Wheel Smash',
    monariId: 'droplet',
    element: 'Water',
    category: 'Special',
    auraCost: 35,
    burstCost: 100,
    openerType: 'water-impact',
    cinematicPath: '/assets/monari/droplet/cinematics/specials/water_wheel_smash/water_wheel_smash.mp4',
    description: 'Droplet spins into a giant water wheel and crashes down with a powerful smash.',
    power: 82,
    accuracy: 92,
  },
};

export function getSpecialMoveForMonari(monariId: string): SpecialMoveConfig | undefined {
  return SPECIAL_MOVE_REGISTRY[monariId];
}
