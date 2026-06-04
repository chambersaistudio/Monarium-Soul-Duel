export type Mode = 'title' | 'field' | 'conversation' | 'duel' | 'result';
export type FighterId = 'flarepaw' | 'droplet';

export interface Vec { x: number; y: number }
export interface Spark extends Vec { vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Bolt extends Vec { vx: number; owner: FighterId; damage: number; life: number; color: string; radius: number }
export interface PopText extends Vec { text: string; color: string; life: number }
export interface Fighter extends Vec {
  id: FighterId; vx: number; vy: number; facing: number; hp: number; aura: number; soul: number;
  guard: boolean; stagger: number; dodge: number; attack: number; attackKind: string; combo: number; comboWindow: number;
  form: number; cooldown: number; grounded: boolean; aquaCooldown: number; auraRegenDelay: number;
}

export interface GameState {
  mode: Mode; clock: number; transition: number; shake: number; selected: number; hint: number;
  hero: Vec; rival: Vec; dialogue: number; result: 'victory' | 'defeat';
  fighters: [Fighter, Fighter]; bolts: Bolt[]; sparks: Spark[]; pops: PopText[];
}

export const SPECIALS = [
  { name: 'EMBER CLAWS', cost: 20, color: '#ffcf55', note: 'rapid close-range combo' },
  { name: 'BLAZE CHARGE', cost: 35, color: '#ff704d', note: 'armored rushing strike' },
  { name: 'FLAME VORTEX', cost: 45, color: '#ff52a1', note: 'ranged fire tornado' },
  { name: 'FLAME GUARD', cost: 25, color: '#b48cff', note: 'countering flame ward' },
];

export function freshFighter(id: FighterId): Fighter {
  return {
    id, x: id === 'flarepaw' ? 360 : 920, y: 570, vx: 0, vy: 0, facing: id === 'flarepaw' ? 1 : -1,
    hp: 100, aura: id === 'droplet' ? 70 : 55, soul: 0, guard: false, stagger: 0, dodge: 0, attack: 0, attackKind: '', combo: 0,
    comboWindow: 0, form: 0, cooldown: id === 'droplet' ? 1 : 0, grounded: true, aquaCooldown: 0, auraRegenDelay: 0,
  };
}

export function freshState(): GameState {
  return {
    mode: 'title', clock: 0, transition: 1, shake: 0, selected: 0, hint: 5, hero: { x: 410, y: 420 },
    rival: { x: 915, y: 350 }, dialogue: 0, result: 'victory', fighters: [freshFighter('flarepaw'), freshFighter('droplet')],
    bolts: [], sparks: [], pops: [],
  };
}
