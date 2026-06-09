/**
 * CLI balance calculator for MONARIUM classic battles.
 * Prints stat blocks, damage ranges, and estimated turns-to-KO.
 *
 * Usage:
 *   npx tsx tools/balance_calculator.ts
 *   npx tsx tools/balance_calculator.ts --attacker flarepaw --attackerLevel 7 \
 *     --defender droplet --defenderLevel 7 --move flame_paw_barrage
 *
 * Or via package.json script:
 *   npm run balance
 */

import { MONARI_DEX } from '../src/data/monariDex';
import { MINARI_ROSTER } from '../src/data/minariData';
import { CLASSIC_MOVES } from '../src/data/classicMoveData';
import { CombatFormulaSystem } from '../src/systems/CombatFormulaSystem';
import { BattleCalculator } from '../src/systems/BattleCalculator';

// ── CLI arg parsing ────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? (process.argv[idx + 1] ?? fallback) : fallback;
}

const attackerId     = arg('attacker',      'flarepaw');
const defenderID     = arg('defender',      'droplet');
const attackerLevel  = parseInt(arg('attackerLevel', '7'), 10);
const defenderLevel  = parseInt(arg('defenderLevel', '7'), 10);
const moveId         = arg('move',          'basic_attack');

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.padEnd(n, ' ');
}

function printStats(id: string, level: number): void {
  const dex    = MONARI_DEX[id];
  if (!dex) { console.log(`  Unknown monari id: ${id}`); return; }
  const stats  = CombatFormulaSystem.calcBattleStats(dex.baseStats, level);
  console.log(`  ${id} (Lv.${level}) — ${dex.rarity}`);
  console.log(`    HP:${stats.maxHp}  Aura:${stats.maxAura}  ATK:${stats.attack}  SPK:${stats.specialAttack}  DEF:${stats.defense}  SPD_DEF:${stats.specialDefense}  SPD:${stats.speed}`);
}

function runScenario(
  label: string,
  atkId: string, atkLv: number,
  defId: string, defLv: number,
  mvId:  string,
): void {
  const atkDex = MONARI_DEX[atkId];
  const defDex = MONARI_DEX[defId];
  const move   = CLASSIC_MOVES[mvId];

  if (!atkDex) { console.log(`  Attacker '${atkId}' not found.`); return; }
  if (!defDex) { console.log(`  Defender '${defId}' not found.`); return; }
  if (!move)   { console.log(`  Move '${mvId}' not found.`); return; }

  const atkStats = CombatFormulaSystem.calcBattleStats(atkDex.baseStats, atkLv);
  const defStats = CombatFormulaSystem.calcBattleStats(defDex.baseStats, defLv);
  const defElement = MINARI_ROSTER[defId]?.element ?? 'normal';

  const range = BattleCalculator.calcRange({
    attackerStats:    atkStats,
    defenderStats:    defStats,
    moveElement:      move.damageType,
    defenderElement:  defElement,
    movePower:        move.power,
    moveCategory:     move.category,
    canCrit:          move.canCrit,
    attackerSyncTier: 'stable',
    defenderGuarding: false,
  });

  const turnsMin = range.avg > 0 ? Math.ceil(defStats.maxHp / range.max) : Infinity;
  const turnsMax = range.avg > 0 ? Math.ceil(defStats.maxHp / range.min) : Infinity;
  const turnsAvg = range.avg > 0 ? Math.ceil(defStats.maxHp / range.avg) : Infinity;

  console.log(`\n  ── ${label} ──`);
  console.log(`  ${atkId} Lv.${atkLv}  →  ${defId} Lv.${defLv}  via [${move.displayName}]`);
  console.log(`  Damage: min=${range.min} avg=${range.avg} max=${range.max}  crit=${range.critMin}–${range.critMax}`);
  console.log(`  Target HP: ${defStats.maxHp}  →  Turns to KO: ~${turnsAvg} (${turnsMin}–${turnsMax})`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('  MONARIUM Balance Calculator');
console.log('═══════════════════════════════════════════════════════');

// Stat blocks for the requested pair
console.log('\nStat blocks:');
printStats(attackerId, attackerLevel);
printStats(defenderID, defenderLevel);

// User-requested scenario
const userMove = CLASSIC_MOVES[moveId];
if (userMove) {
  runScenario('Custom', attackerId, attackerLevel, defenderID, defenderLevel, moveId);
} else {
  console.log(`\n  Note: move '${moveId}' not found in CLASSIC_MOVES.`);
}

// ── Built-in balance test suite ───────────────────────────────────────────────

console.log('\n\nBalance suite (Level 7):');
console.log('────────────────────────────────────────────────────────');

runScenario('1. Flarepaw basic → Droplet',      'flarepaw',   7, 'droplet',    7, 'basic_attack');
runScenario('2. Flarepaw special → Droplet',    'flarepaw',   7, 'droplet',    7, 'flame_paw_barrage');
runScenario('3. Droplet aqua (adv) → Flarepaw', 'droplet',    7, 'flarepaw',   7, 'aqua_ripple');
runScenario('4. Umbravine basic → Sproutodon',  'umbravine',  7, 'sproutodon', 7, 'basic_attack');
runScenario('5. Umbravine shadow → Umbrelette', 'umbravine',  7, 'umbrelette', 7, 'shadow_coil');

console.log('\n');
