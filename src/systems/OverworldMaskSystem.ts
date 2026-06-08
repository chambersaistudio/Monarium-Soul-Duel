import Phaser from 'phaser';

export type MaskZoneType = 'walkable' | 'blocked' | 'portal' | 'interact' | 'encounter' | 'event';

/**
 * Reads a logic-mask PNG to determine walkability and zone types.
 *
 * Mask color conventions (exact solid colors, no gradients):
 *   #FFFFFF = walkable
 *   #000000 = blocked / collision
 *   #00FFFF = portal / map exit
 *   #00FF00 = interact zone (door, NPC hotspot)
 *   #FF00FF = wild encounter / orb spawn zone
 *   #FFFF00 = special event zone
 *   #FF0000 = hard blocked (danger, water, cliff)
 *
 * Paint the mask in any image editor using exact solid colors.
 * The game samples the pixel under the player's feet each frame.
 *
 * To create a mask for a new map:
 *   1. Duplicate the background image.
 *   2. Fill entirely white (#FFFFFF).
 *   3. Paint black (#000000) over buildings, walls, trees, water.
 *   4. Paint cyan (#00FFFF) over exit zones.
 *   5. Paint green (#00FF00) over interact doors / NPC hotspots.
 *   6. Paint magenta (#FF00FF) over wild encounter areas.
 *   7. Save as <mapId>_mask.png — no gradients, no anti-aliasing.
 */
export class OverworldMaskSystem {
  private maskData:   Uint8ClampedArray | null = null;
  private maskWidth:  number = 0;
  private maskHeight: number = 0;
  isLoaded = false;

  /** Call after the mask texture is loaded in Phaser. Returns true on success. */
  load(scene: Phaser.Scene, maskKey: string): boolean {
    if (!scene.textures.exists(maskKey)) return false;
    try {
      const src = scene.textures.get(maskKey).getSourceImage() as HTMLImageElement;
      if (!src?.width) return false;
      const cvs = document.createElement('canvas');
      cvs.width  = src.width;
      cvs.height = src.height;
      const ctx = cvs.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(src, 0, 0);
      this.maskData   = ctx.getImageData(0, 0, src.width, src.height).data;
      this.maskWidth  = src.width;
      this.maskHeight = src.height;
      this.isLoaded   = true;
      return true;
    } catch { return false; }
  }

  private sampleAt(nx: number, ny: number): { r: number; g: number; b: number } | null {
    if (!this.maskData) return null;
    const x = Phaser.Math.Clamp(Math.floor(nx * this.maskWidth),  0, this.maskWidth  - 1);
    const y = Phaser.Math.Clamp(Math.floor(ny * this.maskHeight), 0, this.maskHeight - 1);
    const i = (y * this.maskWidth + x) * 4;
    return { r: this.maskData[i], g: this.maskData[i + 1], b: this.maskData[i + 2] };
  }

  getZoneType(nx: number, ny: number): MaskZoneType {
    const p = this.sampleAt(nx, ny);
    if (!p) return 'walkable';
    const { r, g, b } = p;
    if (r < 64 && g < 64 && b < 64)   return 'blocked';    // black
    if (r > 190 && g < 64 && b < 64)  return 'blocked';    // red also blocked
    if (r < 64 && g > 190 && b > 190) return 'portal';     // cyan
    if (r < 64 && g > 190 && b < 64)  return 'interact';   // green
    if (r > 190 && g < 64 && b > 190) return 'encounter';  // magenta
    if (r > 190 && g > 190 && b < 64) return 'event';      // yellow
    return 'walkable';
  }

  isBlocked(nx: number, ny: number): boolean {
    return this.getZoneType(nx, ny) === 'blocked';
  }

  /** Sample multiple points of the player AABB for robust collision. */
  isBodyBlocked(nx: number, ny: number, nw: number, nh: number): boolean {
    const checks: Array<[number, number]> = [
      [nx - nw * 0.4, ny],          // feet left
      [nx + nw * 0.4, ny],          // feet right
      [nx - nw * 0.4, ny - nh * 0.5], // mid left
      [nx + nw * 0.4, ny - nh * 0.5], // mid right
    ];
    return checks.some(([cx, cy]) => this.isBlocked(cx, cy));
  }
}
