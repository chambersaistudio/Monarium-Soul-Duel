import type Phaser from 'phaser';

const GAMEPLAY_SCENE_KEYS = [
  'StoryOverworldScene',
  'ClassicOverworldScene',
  'ClassicSoulDuelScene',
  'BattleLabScene',
  'BattleLabSetupScene',
  'OverworldScene',
  'BattleScene',
];

/** Stop any gameplay scenes that may have been left active behind boot/menu scenes. */
export function stopGameplayScenes(scene: Phaser.Scene): void {
  for (const key of GAMEPLAY_SCENE_KEYS) {
    if (key === scene.scene.key) continue;
    if (!scene.scene.isActive(key) && !scene.scene.isPaused(key)) continue;
    scene.scene.stop(key);
  }
}

/** True when the app is already in a playable scene rather than boot/title flow. */
export function hasActiveGameplayScene(scene: Phaser.Scene): boolean {
  return GAMEPLAY_SCENE_KEYS.some(key => key !== scene.scene.key && scene.scene.isActive(key));
}
