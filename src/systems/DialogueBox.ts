import Phaser from 'phaser';
import { ASSET_MANIFEST, type ExpressionName } from '../config/assetManifest';
import { UI_THEME } from '../config/uiTheme';

export interface DialogueLine {
  speaker: string;
  characterId?: keyof typeof ASSET_MANIFEST.portraits;
  expression?: ExpressionName;
  text: string;
}

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  private portraitFrame: Phaser.GameObjects.Graphics;
  private portraitImage?: Phaser.GameObjects.Image;
  private portraitFallback: Phaser.GameObjects.Graphics;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private lines: DialogueLine[] = [];
  private index = 0;
  private onComplete?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const boxW = Math.min(w - 56, 820);
    const boxH = 128;
    const x = (w - boxW) / 2;
    const y = h - boxH - 24;

    this.container = scene.add.container(0, 0).setDepth(260).setVisible(false);
    this.panel = scene.add.graphics();
    this.drawPanel(x, y, boxW, boxH);

    this.portraitFrame = scene.add.graphics();
    this.drawPortraitFrame(x + 20, y + 20);
    this.portraitFallback = scene.add.graphics();
    this.drawFallbackPortrait(x + 54, y + 64, UI_THEME.colors.aether);

    this.speakerText = scene.add.text(x + 104, y + 18, '', {
      fontSize: '14px', color: '#fff8ea', fontFamily: UI_THEME.fonts.bold
    });
    this.bodyText = scene.add.text(x + 104, y + 44, '', {
      fontSize: '16px', color: '#f3edff', fontFamily: UI_THEME.fonts.body,
      wordWrap: { width: boxW - 138 }, lineSpacing: 5
    });
    this.promptText = scene.add.text(x + boxW - 26, y + boxH - 24, 'Tap / Enter', {
      fontSize: '11px', color: '#ffd37a', fontFamily: UI_THEME.fonts.bold
    }).setOrigin(1, 0.5);

    scene.tweens.add({ targets: this.promptText, alpha: 0.42, duration: 650, yoyo: true, repeat: -1 });
    this.container.add([this.panel, this.portraitFrame, this.portraitFallback, this.speakerText, this.bodyText, this.promptText]);
    this.container.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerdown', () => this.advance());
  }

  get visible(): boolean { return this.container.visible; }

  show(lines: DialogueLine[], onComplete?: () => void): void {
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete;
    this.container.setVisible(true);
    this.renderLine();
  }

  advance(): void {
    if (!this.container.visible) return;
    this.index += 1;
    if (this.index >= this.lines.length) {
      this.close();
      this.onComplete?.();
      return;
    }
    this.renderLine();
  }

  close(): void {
    this.container.setVisible(false);
    this.onComplete = undefined;
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private renderLine(): void {
    const line = this.lines[this.index];
    this.speakerText.setText(line.speaker);
    this.bodyText.setText(line.text);
    this.setPortrait(line.characterId, line.expression ?? 'neutral');
  }

  private setPortrait(characterId?: keyof typeof ASSET_MANIFEST.portraits, expression: ExpressionName = 'neutral'): void {
    this.portraitImage?.destroy();
    this.portraitImage = undefined;
    if (!characterId) {
      this.portraitFallback.setVisible(true);
      return;
    }

    const path = ASSET_MANIFEST.portraits[characterId][expression] ?? ASSET_MANIFEST.portraits[characterId].neutral;
    const key = `portrait_${characterId}_${expression}`;
    if (!this.scene.textures.exists(key)) {
      this.scene.load.image(key, path);
      this.scene.load.once(`filecomplete-image-${key}`, () => this.applyPortraitTexture(key));
      this.scene.load.once('loaderror', () => this.portraitFallback.setVisible(true));
      if (!this.scene.load.isLoading()) this.scene.load.start();
      this.portraitFallback.setVisible(true);
      return;
    }
    this.applyPortraitTexture(key);
  }

  private applyPortraitTexture(key: string): void {
    if (!this.container.visible || !this.scene.textures.exists(key)) return;
    const w = this.scene.scale.width;
    const boxW = Math.min(w - 56, 820);
    const x = (w - boxW) / 2;
    const y = this.scene.scale.height - 128 - 24;
    this.portraitFallback.setVisible(false);
    this.portraitImage = this.scene.add.image(x + 54, y + 64, key).setDisplaySize(66, 66).setDepth(261);
    this.container.add(this.portraitImage);
  }

  private drawPanel(x: number, y: number, w: number, h: number): void {
    this.panel.fillStyle(UI_THEME.colors.aether, 0.12);
    this.panel.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 22);
    this.panel.fillGradientStyle(0x241633, 0x171224, 0x090812, 0x1c1230, 0.88, 0.82, 0.78, 0.82);
    this.panel.fillRoundedRect(x, y, w, h, 18);
    this.panel.fillStyle(0xffffff, 0.08);
    this.panel.fillRoundedRect(x + 12, y + 10, w - 24, 20, 12);
    this.panel.lineStyle(2, UI_THEME.colors.aetherBright, 0.5);
    this.panel.strokeRoundedRect(x, y, w, h, 18);
    this.panel.lineStyle(1, UI_THEME.colors.gold, 0.35);
    this.panel.lineBetween(x + 94, y + 18, x + 94, y + h - 18);
  }

  private drawPortraitFrame(x: number, y: number): void {
    this.portraitFrame.fillStyle(UI_THEME.colors.aether, 0.18);
    this.portraitFrame.fillRoundedRect(x - 4, y - 4, 76, 88, 18);
    this.portraitFrame.fillGradientStyle(0x3d2656, 0x241633, 0x120d20, 0x3d2656, 0.96, 0.9, 0.86, 0.92);
    this.portraitFrame.fillRoundedRect(x, y, 68, 80, 16);
    this.portraitFrame.lineStyle(1, UI_THEME.colors.gold, 0.65);
    this.portraitFrame.strokeRoundedRect(x, y, 68, 80, 16);
  }

  private drawFallbackPortrait(x: number, y: number, color: number): void {
    this.portraitFallback.fillStyle(color, 0.24);
    this.portraitFallback.fillCircle(x, y, 28);
    this.portraitFallback.fillStyle(UI_THEME.colors.gold, 0.9);
    this.portraitFallback.fillCircle(x, y - 5, 12);
    this.portraitFallback.fillStyle(0xffffff, 0.8);
    this.portraitFallback.fillCircle(x - 5, y - 8, 2);
    this.portraitFallback.fillCircle(x + 5, y - 8, 2);
  }
}
