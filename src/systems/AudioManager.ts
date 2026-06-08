import type Phaser from 'phaser';

/**
 * Thin wrapper around Phaser's sound manager.
 * All methods fail silently if the requested audio key was not loaded
 * (missing files, 404s during preload, etc.).
 *
 * Usage:
 *   private audio!: AudioManager;
 *   create(): void { this.audio = new AudioManager(this); }
 */
export class AudioManager {
  private readonly scene: Phaser.Scene;
  private bgmKey: string | null = null;
  private bgm:    Phaser.Sound.BaseSound | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── BGM ──────────────────────────────────────────────────────────────────

  /**
   * Start a looping BGM track.  Safe to call redundantly with the same key
   * (will not restart if already playing).
   */
  playBgm(key: string, volume = 0.65): void {
    if (this.bgmKey === key && this.bgm?.isPlaying) return;
    this.stopBgm();
    if (!this.has(key)) return;
    this.bgmKey = key;
    this.bgm    = this.scene.sound.add(key, { loop: true, volume });
    this.bgm.play();
  }

  /** Stop and destroy the current BGM (e.g. before a scene transition). */
  stopBgm(): void {
    if (!this.bgm) return;
    try { this.bgm.stop(); this.bgm.destroy(); } catch { /* scene shutting down */ }
    this.bgm    = null;
    this.bgmKey = null;
  }

  // ── SFX ──────────────────────────────────────────────────────────────────

  /** Play a one-shot sound effect.  Silently no-ops if the key is absent. */
  playSfx(key: string, volume = 0.85): void {
    if (!this.has(key)) return;
    try { this.scene.sound.play(key, { volume }); } catch { /* ok */ }
  }

  /** Play a UI interaction sound at a slightly lower volume. */
  playUi(key: string): void { this.playSfx(key, 0.7); }

  /**
   * Play the hurt/vocal sound for a character.
   * Key convention: '<charId>_hurt'  (matches AUDIO_FILES entries).
   */
  playCreatureHurt(charId: string): void { this.playSfx(`${charId}_hurt`); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private has(key: string): boolean {
    try { return this.scene.cache.audio.has(key); } catch { return false; }
  }
}
