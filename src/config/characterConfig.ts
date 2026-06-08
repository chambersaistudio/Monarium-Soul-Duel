export interface CharacterRenderConfig {
  spriteFacingRight: boolean;  // true = sprites authored facing right; false = facing left (flip logic inverts)
  spriteYOffset: number;       // extra px to push sprite down; tune if floating above shadow
  animOverrides?: Record<string, { frameRate?: number; repeat?: number }>;
}

export const CHARACTER_RENDER_CONFIG: Record<string, CharacterRenderConfig> = {
  flarepaw: {
    spriteFacingRight: true,
    spriteYOffset: 0,
  },
  droplet: {
    spriteFacingRight: false,  // Droplet sprites authored facing left — invert flip rule
    spriteYOffset: 0,
    animOverrides: {
      run: { frameRate: 4 },   // 2-frame cycle — slow to avoid strobe
    },
  },
};

export const DEFAULT_RENDER_CONFIG: CharacterRenderConfig = {
  spriteFacingRight: true,
  spriteYOffset: 0,
};
