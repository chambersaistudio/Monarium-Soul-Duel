export interface OverworldSave {
  starterMonariId: string;
  playerName: string;
  monariLevel: number;
  monariXp: number;
}

const SAVE_KEY = 'monarium_overworld_save';

const DEFAULTS: OverworldSave = {
  starterMonariId: 'flarepaw',
  playerName: 'Amari',
  monariLevel: 1,
  monariXp: 0,
};

export class PlayerSaveManager {
  static xpToNextLevel(level: number): number {
    return level * 100;
  }

  /** Base XP earned from winning vs an enemy, scaled by level ratio. */
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
}
