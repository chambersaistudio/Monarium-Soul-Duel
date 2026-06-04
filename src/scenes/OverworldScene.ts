import Phaser from 'phaser';
import { OverworldPlayer } from '../entities/OverworldPlayer';
import { RivalNPC } from '../entities/RivalNPC';
import { SoulSpriteOrb } from '../entities/SoulSpriteOrb';
import { InputSystem } from '../systems/InputSystem';

type DialogueState = 'none' | 'showing' | 'done';

export class OverworldScene extends Phaser.Scene {
  private player!: OverworldPlayer;
  private rival!: RivalNPC;
  private orbs: SoulSpriteOrb[] = [];
  private inputSys!: InputSystem;
  private dialogueState: DialogueState = 'none';
  private dialogueBox!: Phaser.GameObjects.Container;
  private bgGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.bgGfx = this.add.graphics();
    this.drawTrainingField(w, h);

    this.player = new OverworldPlayer(this, 200, h - 160);
    this.rival = new RivalNPC(this, w - 180, h - 160);

    const orbPositions = [
      { x: w * 0.35, y: h - 200 },
      { x: w * 0.5, y: h - 250 },
      { x: w * 0.65, y: h - 190 }
    ];
    orbPositions.forEach((pos, i) => {
      this.orbs.push(new SoulSpriteOrb(this, pos.x, pos.y, i));
    });

    this.inputSys = new InputSystem(this);
    this.dialogueBox = this.createDialogueBox(w, h);
    this.dialogueBox.setVisible(false);

    this.add.text(w / 2, 20, 'TRAINING FIELD', {
      fontSize: '14px', color: '#88ff88', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2, letterSpacing: 6
    }).setOrigin(0.5).setDepth(50);

    this.add.text(20, 20, '← Arrow Keys to move  |  E = Interact with Rival', {
      fontSize: '11px', color: '#666666', fontFamily: 'monospace'
    }).setDepth(50);

    this.cameras.main.fadeIn(400);
  }

  private drawTrainingField(w: number, h: number): void {
    const g = this.bgGfx;
    g.clear();

    // Sky gradient
    for (let i = 0; i < h * 0.55; i += 3) {
      const t = i / (h * 0.55);
      const r = Math.floor(Phaser.Math.Linear(30, 80, t));
      const gv = Math.floor(Phaser.Math.Linear(60, 130, t));
      const b = Math.floor(Phaser.Math.Linear(120, 180, t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, i, w, 3);
    }

    // Distant hills
    g.fillStyle(0x3a7040, 0.5);
    g.fillEllipse(w * 0.15, h * 0.52, 320, 120);
    g.fillEllipse(w * 0.55, h * 0.50, 400, 130);
    g.fillEllipse(w * 0.85, h * 0.53, 280, 110);

    // Ground
    const groundY = h - 220;
    g.fillStyle(0x4a9e50, 1);
    g.fillRect(0, groundY, w, h - groundY);
    g.lineStyle(1, 0x3a8040, 0.4);
    for (let x = 0; x < w; x += 80) g.lineBetween(x, groundY, x, h);
    for (let y = groundY; y < h; y += 60) g.lineBetween(0, y, w, y);
    g.fillStyle(0x2a6030, 1);
    g.fillRect(0, h - 60, w, 60);

    // Academy building silhouette
    g.fillStyle(0x1a2a3a, 0.7);
    g.fillRect(w * 0.72, h * 0.2, 180, h * 0.32);
    g.fillRect(w * 0.72 - 10, h * 0.18, 200, 18);
    g.fillStyle(0xddcc88, 0.6);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        g.fillRect(w * 0.72 + 10 + col * 40, h * 0.24 + row * 50, 24, 30);
      }
    }

    // Trees
    this.drawTree(g, w * 0.08, groundY - 20);
    this.drawTree(g, w * 0.92, groundY - 20);
    this.drawTree(g, w * 0.15, groundY - 10);

    // Platform strip
    g.fillStyle(0x5db864, 1);
    g.fillRect(60, h - 230, w - 120, 14);
    g.fillStyle(0x3a9040, 1);
    g.fillRect(60, h - 220, w - 120, 4);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x5a3010, 1);
    g.fillRect(x - 8, y, 16, 50);
    g.fillStyle(0x2a7030, 1);
    g.fillEllipse(x, y - 20, 70, 80);
    g.fillStyle(0x3a8840, 0.6);
    g.fillEllipse(x + 10, y - 30, 50, 60);
  }

  private createDialogueBox(w: number, h: number): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setDepth(200);

    const bg = this.add.graphics();
    const boxW = w - 80;
    const boxH = 120;
    const boxX = 40;
    const boxY = h - 160;

    bg.fillStyle(0x0a0a1a, 0.92);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0x4488ff, 0.8);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);

    const nameTag = this.add.text(boxX + 16, boxY - 16, ' Rival ', {
      fontSize: '13px', color: '#88aaff', fontFamily: 'monospace',
      fontStyle: 'bold', backgroundColor: '#0a0a1a',
      padding: { x: 4, y: 2 }
    }).setDepth(201);

    const dialogueText = this.add.text(boxX + 20, boxY + 18,
      '"You ready for a Soul Duel?"\n\nStep into the arena and prove your Monari is the strongest!',
      {
        fontSize: '15px', color: '#e0e8ff', fontFamily: 'monospace',
        wordWrap: { width: boxW - 40 }, lineSpacing: 4
      }
    ).setDepth(201);

    const promptText = this.add.text(boxX + boxW - 20, boxY + boxH - 18, '[ENTER] Battle!', {
      fontSize: '12px', color: '#ffff88', fontFamily: 'monospace'
    }).setOrigin(1, 1).setDepth(201);

    this.tweens.add({ targets: promptText, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    container.add([bg, nameTag, dialogueText, promptText]);
    return container;
  }

  update(_time: number, delta: number): void {
    const oi = this.inputSys.getOverworldInput();

    if (this.dialogueState === 'none') {
      let dx = 0, dy = 0;
      if (oi.left) dx = -1;
      else if (oi.right) dx = 1;
      if (oi.up) dy = -1;
      else if (oi.down) dy = 1;

      if (dx !== 0 || dy !== 0) this.player.move(dx, dy);
      else this.player.stopMove();

      const near = this.rival.isNear(this.player.x, this.player.y);
      this.rival.showIndicator(near);

      if (near && oi.interact) {
        this.player.stopMove();
        this.dialogueState = 'showing';
        this.dialogueBox.setVisible(true);
        this.cameras.main.shake(200, 0.003);
      }
    } else if (this.dialogueState === 'showing') {
      if (this.inputSys.isJustDown('enter') || this.inputSys.isJustDown('e')) {
        this.dialogueState = 'done';
        this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress === 1) this.scene.start('BattleScene');
        });
      }
    }

    this.player.update();
    this.rival.update();
    this.orbs.forEach(o => o.update(delta));
  }

  shutdown(): void {
    this.inputSys?.destroy();
  }
}
