export type ExpressionName = 'neutral' | 'happy' | 'serious' | 'shocked';

export const ASSET_MANIFEST = {
  portraits: {
    amari: {
      neutral: 'assets/characters/amari/portrait_neutral.png',
      happy: 'assets/characters/amari/portrait_happy.png',
      serious: 'assets/characters/amari/portrait_serious.png',
      shocked: 'assets/characters/amari/portrait_shocked.png'
    },
    renzo: {
      neutral: 'assets/characters/renzo/portrait_neutral.png',
      happy: 'assets/characters/renzo/portrait_happy.png',
      serious: 'assets/characters/renzo/portrait_serious.png',
      shocked: 'assets/characters/renzo/portrait_shocked.png'
    },
    vale: {
      neutral: 'assets/characters/vale/portrait_neutral.png',
      happy: 'assets/characters/vale/portrait_happy.png',
      serious: 'assets/characters/vale/portrait_serious.png',
      shocked: 'assets/characters/vale/portrait_shocked.png'
    }
  },
  monariPortraits: {
    flarepaw: 'assets/characters/flarepaw/portrait.png',
    droplet: 'assets/characters/droplet/portrait.png',
    sproutodon: 'assets/characters/sproutodon/portrait.png'
  }
} as const;

export function getCharacterPortraitPath(characterId: keyof typeof ASSET_MANIFEST.portraits, expression: ExpressionName = 'neutral'): string {
  return ASSET_MANIFEST.portraits[characterId][expression] ?? ASSET_MANIFEST.portraits[characterId].neutral;
}
