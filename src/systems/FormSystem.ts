import Phaser from 'phaser';
import type { FormData } from '../types/combat';
import type { FighterStats } from '../types/minari';

export interface FormState {
  active: boolean;
  formId: string;
  timeRemaining: number;
  damageMult: number;
  defenseMult: number;
  speedMult: number;
}

export class FormSystem {
  private scene: Phaser.Scene;
  private formData: FormData | null = null;
  private state: FormState = {
    active: false,
    formId: '',
    timeRemaining: 0,
    damageMult: 1,
    defenseMult: 1,
    speedMult: 1
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setFormData(data: FormData): void {
    this.formData = data;
  }

  canActivate(stats: FighterStats): boolean {
    if (!this.formData || this.state.active) return false;
    const { activationCondition, activationThreshold } = this.formData;
    if (activationCondition === 'soulbond') {
      return stats.soulbond >= activationThreshold;
    }
    if (activationCondition === 'hp') {
      return (stats.hp / stats.maxHp) * 100 <= activationThreshold;
    }
    return true;
  }

  activate(stats: FighterStats): boolean {
    if (!this.canActivate(stats)) return false;
    const fd = this.formData!;
    this.state = {
      active: true,
      formId: fd.id,
      timeRemaining: fd.duration,
      damageMult: fd.damageMult,
      defenseMult: fd.defenseMult,
      speedMult: fd.speedMult
    };
    return true;
  }

  update(delta: number, stats: FighterStats): void {
    if (!this.state.active || !this.formData) return;
    this.state.timeRemaining -= delta;
    // Drain aura while form is active
    stats.aura = Math.max(0, stats.aura - (this.formData.auraPerSecond * delta / 1000));
    if (this.state.timeRemaining <= 0 || stats.aura <= 0) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.state = {
      active: false,
      formId: '',
      timeRemaining: 0,
      damageMult: 1,
      defenseMult: 1,
      speedMult: 1
    };
  }

  get isActive(): boolean { return this.state.active; }
  get damageMult(): number { return this.state.damageMult; }
  get defenseMult(): number { return this.state.defenseMult; }
  get speedMult(): number { return this.state.speedMult; }
  get formId(): string { return this.state.formId; }
  get timeRemaining(): number { return this.state.timeRemaining; }
  get glowColor(): number { return this.formData?.glowColor ?? 0xffffff; }
  get displayText(): string { return this.formData?.displayText ?? ''; }
}
