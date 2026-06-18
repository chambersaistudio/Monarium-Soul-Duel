import { getCommandSet, CLASSIC_TECHNIQUE_SLOTS } from '../data/classicMoveData';

export type MonariOwnership = 'bonded' | 'released';

export interface OverworldSave {
  starterMonariId: string;
  playerName: string;
  monariLevel: number;
  monariXp: number;
  // Bond relationship with starter
  bondLevel: number;
  bondXp: number;
  // Battle consumables
  potionCount: number;
  // Ownership registry: monariId → ownership status
  ownedMonari: Record<string, MonariOwnership>;
  // Per-Monari custom technique slots (4 ids each, excludes basic_attack/guard)
  customMovesets?: Record<string, [string, string, string, string]>;
}

const SAVE_KEY = 'monarium_overworld_save';

const BOND_LEVEL_CAP = 10;

const DEFAULTS: OverworldSave = {
  starterMonariId: 'flarepaw',
  playerName: 'Amari',
  monariLevel: 7,
  monariXp: 0,
  bondLevel: 1,
  bondXp: 0,
  potionCount: 3,
  ownedMonari: {},
};

export class PlayerSaveManager {
  // ── Level XP ────────────────────────────────────────────────────────────────

  static xpToNextLevel(level: number): number {
    return level * 100;
  }

  static calcXpGain(playerLevel: number, enemyLevel: number): number {
    const base = enemyLevel * 20;
    const ratio = enemyLevel / Math.max(1, playerLevel);
    const mult = Math.max(0.5, Math.min(2.5, Math.sqrt(ratio) * 1.5));
    return Math.max(1, Math.floor(base * mult));
  }

  static addXp(save: OverworldSave, xpGain: number): { save: OverworldSave; levelsGained: number } {
    let level = save.monariLevel;
    let xp = save.monariXp + xpGain;
    let levelsGained = 0;
    while (level < 100 && xp >= this.xpToNextLevel(level)) {
      xp -= this.xpToNextLevel(level);
      level++;
      levelsGained++;
    }
    return { save: { ...save, monariLevel: level, monariXp: xp }, levelsGained };
  }

  // ── Bond XP (cap = 10) ──────────────────────────────────────────────────────

  static bondXpToNextLevel(level: number): number {
    return level * 50;
  }

  static calcBondXpGain(enemyLevel: number): number {
    return Math.max(1, Math.floor(enemyLevel * 8));
  }

  static addBondXp(save: OverworldSave, gain: number): { save: OverworldSave; levelsGained: number } {
    let level = save.bondLevel ?? 1;
    let xp = (save.bondXp ?? 0) + gain;
    let levelsGained = 0;
    while (level < BOND_LEVEL_CAP && xp >= this.bondXpToNextLevel(level)) {
      xp -= this.bondXpToNextLevel(level);
      level++;
      levelsGained++;
    }
    if (level >= BOND_LEVEL_CAP) xp = 0;
    return { save: { ...save, bondLevel: level, bondXp: xp }, levelsGained };
  }

  // ── Bond chance formula ──────────────────────────────────────────────────────

  static calcBondChance(
    enemyHpRatio: number,
    enemyLevel: number,
    playerLevel: number,
    rarity: string,
  ): number {
    const rarityBase: Record<string, number> = {
      common: 0.78, uncommon: 0.62, rare: 0.46,
      epic: 0.28, legendary: 0.14, mythic: 0.07,
    };
    const base      = rarityBase[rarity] ?? 0.46;
    const hpBonus   = (1 - enemyHpRatio) * 0.32;
    const lvPenalty = Math.max(0, (enemyLevel - playerLevel) * 0.03);
    return Math.max(0.05, Math.min(0.95, base + hpBonus - lvPenalty));
  }

  // ── Technique movesets ───────────────────────────────────────────────────────

  /** Returns the full command list (basic_attack, guard, + 4 technique slots) for battle / UI. */
  static getMonariMoveset(save: OverworldSave, monariId: string): string[] {
    const custom = save.customMovesets?.[monariId];
    return getCommandSet(monariId, custom ?? undefined);
  }

  /** Saves a custom 4-slot technique selection for a given Monari. */
  static setCustomSlots(
    save: OverworldSave,
    monariId: string,
    slots: [string, string, string, string],
  ): OverworldSave {
    return {
      ...save,
      customMovesets: {
        ...(save.customMovesets ?? {}),
        [monariId]: slots,
      },
    };
  }

  /** Returns the 4 active technique slots for a given Monari (custom or default). */
  static getTechniqueSlots(save: OverworldSave, monariId: string): [string, string, string, string] {
    return (
      save.customMovesets?.[monariId] ??
      (CLASSIC_TECHNIQUE_SLOTS[monariId] as [string, string, string, string]) ??
      ['basic_attack', 'basic_attack', 'basic_attack', 'basic_attack']
    );
  }

  // ── Ownership ────────────────────────────────────────────────────────────────

  static isOwned(save: OverworldSave, id: string): boolean {
    return (save.ownedMonari ?? {})[id] === 'bonded';
  }

  static bondMonari(save: OverworldSave, id: string): OverworldSave {
    return {
      ...save,
      ownedMonari: { ...(save.ownedMonari ?? {}), [id]: 'bonded' },
    };
  }

  /** Returns all bonded Monari IDs, with the starter first. */
  static getBondedTeam(save: OverworldSave): string[] {
    const owned = save.ownedMonari ?? {};
    const bonded = Object.keys(owned).filter(id => owned[id] === 'bonded');
    if (save.starterMonariId && !bonded.includes(save.starterMonariId)) {
      bonded.unshift(save.starterMonariId);
    }
    return bonded;
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  static hasSave(): boolean {
    return !!localStorage.getItem(SAVE_KEY);
  }

  static load(): OverworldSave {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as OverworldSave;
      return { ...parsed, monariLevel: Math.max(7, parsed.monariLevel ?? 7) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  static persist(data: OverworldSave): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable */ }
  }

  static createFreshSave(
    starterMonariId: string,
    playerName: string,
    level = 7,
  ): OverworldSave {
    return {
      starterMonariId,
      playerName,
      monariLevel: level,
      monariXp: 0,
      bondLevel: 1,
      bondXp: 0,
      potionCount: 3,
      ownedMonari: { [starterMonariId]: 'bonded' },
    };
  }
}
