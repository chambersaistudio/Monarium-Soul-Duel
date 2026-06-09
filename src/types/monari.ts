export type MonariElement = 'Ember' | 'Aqua' | 'Terra' | 'Shadow' | 'Aether';
export type MonariRarity = 'Common' | 'Rare' | 'Super Rare' | 'Ultra Rare' | 'Legendary';

export interface MonariBaseStats {
  hp: number;
  aura: number;
  attack: number;
  specialAttack: number;
  defense: number;
  specialDefense: number;
  speed: number;
}

export interface MonariDexEntry {
  id: 'flarepaw' | 'droplet' | 'sproutodon' | string;
  name: string;
  element: MonariElement;
  rarity: MonariRarity;
  level: number;
  role: string;
  baseStats: MonariBaseStats;
}
