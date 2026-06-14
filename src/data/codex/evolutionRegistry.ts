import type { EvolutionLineEntry } from './codexTypes';

export const EVOLUTION_REGISTRY: Record<string, EvolutionLineEntry> = {
  'flarepaw-line': { evolutionLineId: 'flarepaw-line', entries: ['flarepaw'] },
  'droplet-line': { evolutionLineId: 'droplet-line', entries: ['droplet'] },
  'sproutodon-line': { evolutionLineId: 'sproutodon-line', entries: ['sproutodon'] },
  'bloomfawn-line': {
    evolutionLineId: 'bloomfawn-line',
    entries: ['bloomfawn', 'bloomhart'],
  },
};

export const EVOLUTION_LINES = Object.values(EVOLUTION_REGISTRY);
