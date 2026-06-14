import type { EvolutionLineEntry } from './codexTypes';

export const EVOLUTION_REGISTRY: Record<string, EvolutionLineEntry> = {
  'bloomfawn-line': {
    evolutionLineId: 'bloomfawn-line',
    entries: ['bloomfawn', 'bloomhart'],
  },
};

export const EVOLUTION_LINES = Object.values(EVOLUTION_REGISTRY);
