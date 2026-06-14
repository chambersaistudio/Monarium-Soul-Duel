import { ABILITY_REGISTRY } from './abilityRegistry';
import { EVOLUTION_REGISTRY } from './evolutionRegistry';
import { MONARI_CODEX, MONARI_CODEX_ENTRIES } from './monariCodex';
import { TECHNIQUE_REGISTRY } from './techniqueRegistry';
import type { AbilityEntry, CodexBaseStats, MonariCodexEntry, TechniqueEntry } from './codexTypes';

export function getCodexEntry(slug: string): MonariCodexEntry | undefined {
  return MONARI_CODEX[slug];
}

export function getAllCodexEntries(): MonariCodexEntry[] {
  return MONARI_CODEX_ENTRIES;
}

export function getCodexTechnique(id: string): TechniqueEntry | undefined {
  return TECHNIQUE_REGISTRY[id];
}

export function getCodexAbility(id: string): AbilityEntry | undefined {
  return ABILITY_REGISTRY[id];
}

export function getEvolutionNames(entry: MonariCodexEntry): string {
  const line = EVOLUTION_REGISTRY[entry.evolutionLineId];
  if (!line) return entry.name;
  return line.entries.map(slug => MONARI_CODEX[slug]?.name ?? slug).join(' → ');
}

export function getBaseStatTotal(stats: CodexBaseStats): number {
  return stats.health + stats.aura + stats.attack + stats.specialAttack + stats.defense + stats.specialDefense + stats.speed;
}

export function getCodexImageCandidates(entry: MonariCodexEntry, size: 'icon' | 'full' = 'full'): string[] {
  const ordered = size === 'icon'
    ? [
        entry.assetPaths.portrait,
        entry.assetPaths.icon,
        entry.assetPaths.codex,
        entry.assetPaths.fullbody,
        ...(entry.assetPaths.legacy ?? []),
      ]
    : [
        entry.assetPaths.codex,
        entry.assetPaths.fullbody,
        entry.assetPaths.portrait,
        entry.assetPaths.icon,
        ...(entry.assetPaths.legacy ?? []),
      ];
  return ordered.filter((path, index, arr) => arr.indexOf(path) === index);
}
