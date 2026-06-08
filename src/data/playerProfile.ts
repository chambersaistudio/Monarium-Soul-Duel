/**
 * Default player profile values.
 * Runtime state (chosen starter, etc.) is stored in Phaser's game registry:
 *   registry.set('classic_player_name',    string)
 *   registry.set('classic_player_starter', string | null)
 *   registry.set('classic_renzo_starter',  string | null)
 *   registry.set('classic_starter_chosen', boolean)
 *   registry.set('classic_current_map',    string)
 *   registry.set('classic_spawn_name',     string)
 *   registry.set('classic_battle_context', ClassicBattleContext | null)
 */
export const PLAYER_PROFILE = {
  displayName: 'Amari',
  walkSpeed: 130,   // px/s at reference 960-wide viewport
} as const;

/** Given player's starter id, returns Renzo's type-advantage counter-pick. */
export function renzoCounterPick(playerStarterId: string): string {
  switch (playerStarterId) {
    case 'flarepaw':  return 'droplet';     // water beats fire
    case 'droplet':   return 'umbravine';   // grass/shadow beats water
    case 'umbravine': return 'flarepaw';    // fire beats grass
    default:          return 'droplet';
  }
}
