/**
 * In-battle Soul Sync state machine.
 * One instance per active Monari (player and enemy each have their own).
 * Read docs/gameplay/MONARIUM_GAME_MECHANICS.md §5 before modifying.
 */

import type { SoulSyncState, SoulSyncTier } from '../types/progression';
import {
  SYNC_THRESHOLDS,
  SYNC_EVENTS,
  SYNC_PASSIVE_PER_TURN,
  STARTING_SYNC_BY_BOND_LEVEL,
  SYNC_TIER_BONUSES,
} from '../config/progressionConfig';

export class SoulSyncSystem {
  private monariId: string;
  private sync:     number;

  constructor(monariId: string, bondLevel: number) {
    this.monariId = monariId;
    const clamped = Math.max(1, Math.min(10, bondLevel));
    this.sync     = STARTING_SYNC_BY_BOND_LEVEL[clamped] ?? 70;
  }

  // ── Sync event handlers ───────────────────────────────────────────────────

  onLandAttack():    void { this.adjust(SYNC_EVENTS.LAND_ATTACK); }
  onMissAttack():    void { this.adjust(SYNC_EVENTS.MISS_ATTACK); }
  onTakeCrit():      void { this.adjust(SYNC_EVENTS.TAKE_CRIT); }
  onTakeHeavyHit():  void { this.adjust(SYNC_EVENTS.TAKE_HEAVY_HIT); }
  onGuardSuccess():  void { this.adjust(SYNC_EVENTS.GUARD_SUCCESS); }
  onDodgeSuccess():  void { this.adjust(SYNC_EVENTS.DODGE_SUCCESS); }
  onTypeAdvantage(): void { this.adjust(SYNC_EVENTS.TYPE_ADVANTAGE); }
  onSyncBreakHit():  void { this.adjust(SYNC_EVENTS.SYNC_BREAK_HIT); }
  onSwap():          void { this.adjust(SYNC_EVENTS.SWAP_OUT); }
  onLowHpPressure(): void { this.adjust(SYNC_EVENTS.LOW_HP_PRESSURE); }

  applyDelta(delta: number): void { this.adjust(delta); }

  /** Call once at end of each turn for passive recovery. */
  onTurnEnd(bondLevel: number): void {
    const clamped = Math.max(1, Math.min(10, bondLevel));
    const passive = SYNC_PASSIVE_PER_TURN[clamped] ?? 0;
    if (passive > 0) this.adjust(passive);
  }

  // ── State accessors ───────────────────────────────────────────────────────

  getState(): SoulSyncState {
    return { monariId: this.monariId, sync: this.sync, tier: this.computeTier() };
  }

  getSyncValue(): number { return this.sync; }
  getTier():      SoulSyncTier { return this.computeTier(); }

  getBonuses() {
    return SYNC_TIER_BONUSES[this.computeTier()];
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private adjust(delta: number): void {
    this.sync = Math.max(0, Math.min(100, this.sync + delta));
  }

  private computeTier(): SoulSyncTier {
    if (this.sync >= SYNC_THRESHOLDS.LOCKED_IN) return 'locked_in';
    if (this.sync >= SYNC_THRESHOLDS.STABLE)    return 'stable';
    if (this.sync >= SYNC_THRESHOLDS.SHAKEN)    return 'shaken';
    return 'broken';
  }
}
