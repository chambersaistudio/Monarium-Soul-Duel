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
}

const SAVE_KEY = 'monarium_overworld_save';

const DEFAULTS: OverworldSave = {
  starterMonariId: 'flarepaw',
  playerName: 'Amari',
  monariLevel: 1,
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

  // ── Bond XP ─────────────────────────────────────────────────────────────────

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
    while (level < 100 && xp >= this.bondXpToNextLevel(level)) {
      xp -= this.bondXpToNextLevel(level);
      level++;
      levelsGained++;
    }
    return { save: { ...save, bondLevel: level, bondXp: xp }, levelsGained };
  }

  // ── Bond chance formula ──────────────────────────────────────────────────────

  /** Returns a 0–1 bond chance. Lower HP and lower rarity → higher chance. */
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
    // Ensure starter is included
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
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  static persist(data: OverworldSave): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable */ }
  }

  /** Create a brand-new save for a given starter, initialising ownership. */
  static createFreshSave(
    starterMonariId: string,
    playerName: string,
    level = 1,
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
