import Phaser from 'phaser';
import { OverworldPlayer } from '../entities/OverworldPlayer';
import { RivalNPC } from '../entities/RivalNPC';
import { SoulSpriteOrb } from '../entities/SoulSpriteOrb';
import { InputSystem } from '../systems/InputSystem';
import { DialogueBox } from '../systems/DialogueBox';
import { VirtualJoystick } from '../systems/VirtualJoystick';
import { StarterSelectionOverlay } from '../systems/StarterSelectionOverlay';
import { UI_THEME } from '../config/uiTheme';
import { getStarter, getRenzoStarter } from '../data/monariDex';
import { CHARACTERS } from '../data/characterData';

type DialogueState = 'none' | 'showing' | 'transitioning';

export class OverworldScene extends Phaser.Scene {
  private player!: OverworldPlayer;
  private rival!: RivalNPC;
  private orbs: SoulSpriteOrb[] = [];
  private inputSys!: InputSystem;
  private dialogueState: DialogueState = 'none';
  private dialogueBox!: DialogueBox;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private joystick!: VirtualJoystick;
  private starterOverlay!: StarterSelectionOverlay;
  private hudTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.dialogueState = 'none';

    this.bgGfx = this.add.graphics();
    this.drawTrainingField(w, h);

    this.player = new OverworldPlayer(this, 200, h - 160);
    this.rival = new RivalNPC(this, w - 180, h - 160);

    const orbPositions = [
      { x: w * 0.35, y: h - 200 },
      { x: w * 0.5,  y: h - 250 },
      { x: w * 0.65, y: h - 190 }
    ];
    orbPositions.forEach((pos, i) => {
      this.orbs.push(new SoulSpriteOrb(this, pos.x, pos.y, i));
    });

    this.inputSys = new InputSystem(this);
    this.dialogueBox = new DialogueBox(this);
    const forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    this.joystick = new VirtualJoystick(this, forceTouch);
    this.starterOverlay = new StarterSelectionOverlay(this);
    this.createOverworldHud(w);

    this.cameras.main.fadeIn(400);

    if (!this.registry.get('starter_selected')) {
      this.dialogueState = 'transitioning';
      this.starterOverlay.show((playerStarter, renzoStarter) => {
        this.registry.set('starter_selected', true);
        this.registry.set('player_starter', playerStarter.id);
        this.registry.set('renzo_starter', renzoStarter.id);
        this.dialogueState = 'none';
        this.refreshOverworldHud();
      }, () => {
        this.registry.set('starter_selected', true);
        this.registry.set('player_starter', 'flarepaw');
        this.registry.set('renzo_starter', 'droplet');
        this.dialogueState = 'none';
        this.refreshOverworldHud();
      });
    }
  }

  private drawTrainingField(w: number, h: number): void {
    const g = this.bgGfx;
    g.clear();

    for (let i = 0; i < h * 0.55; i += 3) {
      const t = i / (h * 0.55);
      const r  = Math.floor(Phaser.Math.Linear(30, 80, t));
      const gv = Math.floor(Phaser.Math.Linear(60, 130, t));
      const b  = Math.floor(Phaser.Math.Linear(120, 180, t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, i, w, 3);
    }

    g.fillStyle(0x3a7040, 0.5);
    g.fillEllipse(w * 0.15, h * 0.52, 320, 120);
    g.fillEllipse(w * 0.55, h * 0.50, 400, 130);
    g.fillEllipse(w * 0.85, h * 0.53, 280, 110);

    const groundY = h - 220;
    g.fillStyle(0x4a9e50, 1);
    g.fillRect(0, groundY, w, h - groundY);
    g.lineStyle(1, 0x3a8040, 0.4);
    for (let x = 0; x < w; x += 80) g.lineBetween(x, groundY, x, h);
    for (let y = groundY; y < h; y += 60) g.lineBetween(0, y, w, y);
    g.fillStyle(0x2a6030, 1);
    g.fillRect(0, h - 60, w, 60);

    g.fillStyle(0x1a2a3a, 0.7);
    g.fillRect(w * 0.72, h * 0.2, 180, h * 0.32);
    g.fillRect(w * 0.72 - 10, h * 0.18, 200, 18);
    g.fillStyle(0xddcc88, 0.6);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        g.fillRect(w * 0.72 + 10 + col * 40, h * 0.24 + row * 50, 24, 30);
      }
    }

    this.drawTree(g, w * 0.08, groundY - 20);
    this.drawTree(g, w * 0.92, groundY - 20);
    this.drawTree(g, w * 0.15, groundY - 10);

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

  private createOverworldHud(w: number): void {
    const g = this.add.graphics().setDepth(60);
    g.fillStyle(UI_THEME.colors.aether, 0.1);
    g.fillRoundedRect(16, 14, 244, 78, 18);
    g.fillGradientStyle(0x241633, 0x171224, 0x080712, 0x1c1230, 0.82, 0.72, 0.62, 0.7);
    g.fillRoundedRect(20, 18, 236, 70, 16);
    g.lineStyle(1, UI_THEME.colors.gold, 0.42);
    g.strokeRoundedRect(20, 18, 236, 70, 16);

    g.fillStyle(UI_THEME.colors.aether, 0.12);
    g.fillRoundedRect(w / 2 - 110, 18, 220, 38, 19);
    g.lineStyle(1, UI_THEME.colors.aetherBright, 0.4);
    g.strokeRoundedRect(w / 2 - 110, 18, 220, 38, 19);

    this.hudTexts.push(
      this.add.text(36, 26, '', { fontSize: '13px', color: '#fff8ea', fontFamily: UI_THEME.fonts.bold }).setDepth(61),
      this.add.text(36, 46, '', { fontSize: '11px', color: '#d8d0eb', fontFamily: UI_THEME.fonts.body }).setDepth(61),
      this.add.text(36, 64, '', { fontSize: '10px', color: '#ffd37a', fontFamily: UI_THEME.fonts.bold }).setDepth(61),
      this.add.text(w / 2, 28, 'Aureon Training Field', { fontSize: '13px', color: '#f7f0ff', fontFamily: UI_THEME.fonts.bold }).setOrigin(0.5, 0).setDepth(61),
      this.add.text(w / 2, 43, 'Starter Grove • Bonder Trial', { fontSize: '9px', color: '#bfb4dc', fontFamily: UI_THEME.fonts.body }).setOrigin(0.5, 0).setDepth(61),
      this.add.text(20, 98, this.joystick?.isEnabled ? 'Virtual joystick • E / Enter to interact' : 'Arrow Keys to move • E / Enter to interact', { fontSize: '10px', color: '#b8adc8', fontFamily: UI_THEME.fonts.body }).setDepth(61)
    );
    this.refreshOverworldHud();
  }

  private refreshOverworldHud(): void {
    const starter = getStarter((this.registry.get('player_starter') as string | undefined) ?? 'flarepaw');
    this.hudTexts[0]?.setText('Amari');
    this.hudTexts[1]?.setText(`${starter.name} • ${starter.element} Monari`);
    this.hudTexts[2]?.setText(`Lv. ${starter.level}  Bond/Aura ▰▰▱▱▱`);
  }

  private openRivalDialogue(): void {
    const starter = getStarter((this.registry.get('player_starter') as string | undefined) ?? 'flarepaw');
    const renzoStarter = getRenzoStarter(starter.id);
    this.dialogueState = 'showing';
    this.dialogueBox.show([
      {
        speaker: CHARACTERS.renzo.displayName,
        characterId: 'renzo',
        expression: 'serious',
        text: `You and ${starter.name} look ready. I bonded with ${renzoStarter.name}, so this should be a real Soul Duel.`
      },
      {
        speaker: CHARACTERS.renzo.displayName,
        characterId: 'renzo',
        expression: 'happy',
        text: 'Step into the arena. Let our Monari show what their bond can do!'
      }
    ], () => {
      this.dialogueState = 'transitioning';
      this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
        if (progress === 1) this.scene.start('BattleScene');
      });
    });
  }

  update(_time: number, delta: number): void {
    // ── Dialogue showing: only check for dismiss key, do NOT move player ──
    if (this.dialogueState === 'showing') {
      if (this.inputSys.isJustDown('enter') || this.inputSys.isJustDown('e')) this.dialogueBox.advance();
      this.rival.update();
      this.orbs.forEach(o => o.update(delta));
      return;
    }

    if (this.dialogueState === 'transitioning') return;

    // ── Normal overworld movement ──
    if (this.joystick?.isEnabled) {
      const touch = this.joystick.movement;
      this.inputSys.setTouchMovement(touch.x, touch.y);
    }
    const mv = this.inputSys.getOverworldVector();
    if (mv.x !== 0 || mv.y !== 0) this.player.move(mv.x, mv.y);
    else this.player.stopMove();

    const near = this.rival.isNear(this.player.x, this.player.y);
    this.rival.showIndicator(near);

    // Open dialogue — checked AFTER movement so the same press can't
    // open AND immediately dismiss (Enter is now handled in 'showing' branch only)
    if (near && (this.inputSys.isJustDown('e') || this.inputSys.isJustDown('enter'))) {
      this.player.stopMove();
      this.openRivalDialogue();
      this.cameras.main.shake(200, 0.003);
    }

    this.player.update();
    this.rival.update();
    this.orbs.forEach(o => o.update(delta));
  }

  shutdown(): void {
    this.inputSys?.destroy();
    this.dialogueBox?.destroy();
    this.joystick?.destroy();
    this.starterOverlay?.destroy();
  }
}
