import { ACTIVE_FLAREPAW_SHEET_PATH } from './assetPaths';

export type FlarepawAnimation = 'idle' | 'run' | 'jump' | 'action';

const COLUMNS = 5;
const ROWS = 4;
const animationRow: Record<FlarepawAnimation, number> = { idle: 0, run: 1, jump: 2, action: 3 };
const framesPerSecond: Record<FlarepawAnimation, number> = { idle: 5, run: 10, jump: 8, action: 9 };

export class FlarepawSheet {
  readonly image = new Image();
  private available = false;

  constructor(path = ACTIVE_FLAREPAW_SHEET_PATH) {
    this.image.decoding = 'async';
    this.image.addEventListener('load', () => { this.available = true; });
    this.image.addEventListener('error', () => { this.available = false; });
    this.image.src = path;
  }

  get ready() { return this.available && this.image.naturalWidth > 0 && this.image.naturalHeight > 0; }
  get frameWidth() { return this.ready ? this.image.naturalWidth / COLUMNS : 0; }
  get frameHeight() { return this.ready ? this.image.naturalHeight / ROWS : 0; }

  draw(c: CanvasRenderingContext2D, animation: FlarepawAnimation, time: number, displayHeight = 250) {
    if (!this.ready) return false;
    const sourceWidth = this.frameWidth, sourceHeight = this.frameHeight;
    const frame = Math.floor(time * framesPerSecond[animation]) % COLUMNS;
    // Round cell boundaries independently because the authored 1536px sheet is not evenly divisible by five.
    const sourceLeft = Math.round(frame * sourceWidth), sourceRight = Math.round((frame + 1) * sourceWidth);
    const sourceTop = Math.round(animationRow[animation] * sourceHeight), sourceBottom = Math.round((animationRow[animation] + 1) * sourceHeight);
    const displayWidth = displayHeight * sourceWidth / sourceHeight;
    c.drawImage(
      this.image,
      sourceLeft, sourceTop, sourceRight - sourceLeft, sourceBottom - sourceTop,
      -displayWidth / 2, -displayHeight + 12, displayWidth, displayHeight,
    );
    return true;
  }
}
