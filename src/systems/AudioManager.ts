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

  /**
   * Crossfade to a new BGM track over ~500 ms.
   * No-ops if the requested track is already playing.
   * Falls back to instant play if there is nothing currently playing.
   */
  fadeToBgm(key: string, volume = 0.65): void {
    if (this.bgmKey === key && this.bgm?.isPlaying) return;
    if (!this.bgm) { this.playBgm(key, volume); return; }
    const outgoing = this.bgm as Phaser.Sound.WebAudioSound;
    this.bgm = null;
    this.bgmKey = null;
    let step = 0;
    const steps = 10;
    const tick = setInterval(() => {
      step++;
      try { outgoing.setVolume(volume * (1 - step / steps)); } catch { /* no-op */ }
      if (step >= steps) {
        clearInterval(tick);
        try { outgoing.stop(); outgoing.destroy(); } catch { /* scene shutting down */ }
        this.playBgm(key, volume);
      }
    }, 50);
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
