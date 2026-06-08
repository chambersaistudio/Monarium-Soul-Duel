/**
 * Config for Classic Soul Duel scene.
 * Change values here — no other code edits needed to swap backgrounds or music.
 */
export const CLASSIC_BATTLE_CONFIG = {
  /**
   * Background image key.
   * Drop a PNG at:  public/assets/backgrounds/classic/<background>.png
   * Then update this string.  Scene falls back to a procedural gradient if
   * the file is absent.
   */
  background: 'forest_shrine_01',

  /**
   * BGM audio key to loop during battle.
   * Must match an entry in AUDIO_FILES in audioConfig.ts.
   */
  bgm: 'bgm_battle',
} as const;
