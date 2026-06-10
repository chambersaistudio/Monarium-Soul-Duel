export type Element = 'fire' | 'water' | 'wind' | 'earth' | 'lightning' | 'shadow' | 'light' | 'void';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type MonariGender = 'male' | 'female' | 'unknown';

export interface FighterStats {
  maxHp: number;
  hp: number;
  maxAura: number;
  aura: number;
  power: number;
  defense: number;
  speed: number;
  jumpPower: number;
  weight: number;
  soulbond: number;
  maxSoulbond: number;
}

export interface MinariData {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  gender?: MonariGender;
  stats: FighterStats;
  coreAttackId: string;
  specialSlots: string[];
  abilityId: string;
  ultimateId: string;
  colorPrimary: number;
  colorSecondary: number;
  bodyShape: 'rect' | 'circle' | 'ellipse';
  bodyWidth: number;
  bodyHeight: number;
}
