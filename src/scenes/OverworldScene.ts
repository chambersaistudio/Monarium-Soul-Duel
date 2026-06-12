import Phaser from 'phaser';
import { OverworldPlayer } from '../entities/OverworldPlayer';
import { RivalNPC } from '../entities/RivalNPC';
import { SoulSpriteOrb } from '../entities/SoulSpriteOrb';
import { InputSystem } from '../systems/InputSystem';
import { VirtualDpad } from '../systems/VirtualDpad';
import { IS_TOUCH_DEVICE } from '../config/mobileConfig';
import { PlayerSaveManager } from '../systems/PlayerSaveManager';
import type { OverworldSave } from '../systems/PlayerSaveManager';
import { OverworldMenuOverlay } from '../ui/OverworldMenuOverlay';
import type { ClassicBattleContext } from '../types/overworld';

const WILD_STARTERS = ['flarepaw', 'droplet', 'sproutodon'];
const ORB_ENCOUNTER_RADIUS = 60;

type DialogueState = 'none' | 'showing' | 'transitioning';

export class OverworldScene extends Phaser.Scene {
  private player!: OverworldPlayer;
  private rival!: RivalNPC;
  private orbs: SoulSpriteOrb[] = [];
  private inputSys!: InputSystem;
  private dpad: VirtualDpad | null = null;
  private dialogueState: DialogueState = 'none';
  private dialogueBox!: Phaser.GameObjects.Container;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private saveData!: OverworldSave;
  private encounteredOrbs = new Set<number>();
  private inEncounter = false;
  private menuOverlay: OverworldMenuOverlay | null = null;

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.dialogueState = 'none';
    this.inEncounter   = false;
    this.encounteredOrbs = new Set();

    // Load save data
    this.saveData = PlayerSaveManager.load();

    // Pin physics world bounds to CSS viewport dimensions so setCollideWorldBounds
    // cannot be constrained by stale initial-config values.
    this.physics.world.setBounds(0, 0, w, h);

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

    // Virtual D-pad — shown on touch devices (or when ?touch=1)
    if (IS_TOUCH_DEVICE) {
      this.dpad = new VirtualDpad(this, this.inputSys);
    }

    this.dialogueBox = this.createDialogueBox(w, h);
    this.dialogueBox.setVisible(false);

    this.add.text(w / 2, 20, 'TRAINING FIELD', {
      fontSize: '14px', color: '#88ff88', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2, letterSpacing: 6
    }).setOrigin(0.5).setDepth(50);

    this.add.text(20, 20,
      IS_TOUCH_DEVICE ? 'D-pad = move  |  Tap A to interact' : '← Arrow Keys to move  |  E / Enter = Interact',
      { fontSize: '11px', color: '#666666', fontFamily: 'monospace' }
    ).setDepth(50);

    // MENU button
    const menuBtn = this.add.text(w - 14, 14, 'MENU', {
      fontSize: '12px', color: '#aaaaff', fontFamily: 'monospace',
      backgroundColor: 'rgba(0,0,20,0.65)',
      padding: { x: 6, y: 4 },
    }).setOrigin(1, 0).setDepth(50).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => this.openStartMenu());

    // M key also opens the menu
    this.input.keyboard?.on('keydown-M', () => this.openStartMenu());

    this.cameras.main.fadeIn(400);

    // Check if returning from a wild battle
    const battleResult = this.registry.get('arena_battle_result') as { won: boolean; enemyLevel: number } | null;
    if (battleResult) {
      this.registry.remove('arena_battle_result');
      if (battleResult.won) {
        const xpGain = PlayerSaveManager.calcXpGain(this.saveData.monariLevel, battleResult.enemyLevel);
        const { save: newSave, levelsGained } = PlayerSaveManager.addXp(this.saveData, xpGain);
        this.saveData = newSave;
        PlayerSaveManager.persist(this.saveData);
        this.time.delayedCall(600, () => this.showXpNotification(xpGain, levelsGained));
      }
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
      '"You ready for a Soul Duel?"\n\nStep into the arena — prove your Monari is the strongest!',
      {
        fontSize: '15px', color: '#e0e8ff', fontFamily: 'monospace',
        wordWrap: { width: boxW - 40 }, lineSpacing: 4
      }
    ).setDepth(201);

    const promptText = this.add.text(boxX + boxW - 20, boxY + boxH - 18,
      IS_TOUCH_DEVICE ? 'Tap A to Battle!' : '[E / ENTER] Battle!', {
        fontSize: '12px', color: '#ffff88', fontFamily: 'monospace'
      }).setOrigin(1, 1).setDepth(201);

    this.tweens.add({ targets: promptText, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

    container.add([bg, nameTag, dialogueText, promptText]);
    return container;
  }

  update(_time: number, delta: number): void {
    // ── Dialogue showing: only check for dismiss key, do NOT move player ──
    if (this.dialogueState === 'showing') {
      // Use isJustDown directly — getOverworldMove() never consumes these
      if (this.inputSys.isJustDown('enter') || this.inputSys.isJustDown('e')) {
        this.dialogueState = 'transitioning';
        this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress === 1) this.scene.start('BattleScene');
        });
      }
      // Still update cosmetics even while dialogue is up
      this.rival.update();
      this.orbs.forEach(o => o.update(delta));
      return;
    }

    if (this.dialogueState === 'transitioning' || this.inEncounter) return;

    // ── Normal overworld movement ──
    const mv = this.inputSys.getOverworldMove();
    let dx = 0, dy = 0;
    if (mv.left)  dx = -1;
    else if (mv.right) dx = 1;
    if (mv.up)   dy = -1;
    else if (mv.down) dy = 1;

    if (dx !== 0 || dy !== 0) this.player.move(dx, dy);
    else this.player.stopMove();

    const near = this.rival.isNear(this.player.x, this.player.y);
    this.rival.showIndicator(near);

    // Open dialogue — checked AFTER movement so the same press can't
    // open AND immediately dismiss (Enter is now handled in 'showing' branch only)
    if (near && (this.inputSys.isJustDown('e') || this.inputSys.isJustDown('enter'))) {
      this.player.stopMove();
      this.dialogueState = 'showing';
      this.dialogueBox.setVisible(true);
      this.cameras.main.shake(200, 0.003);
    }

    // ── Orb proximity — wild encounter trigger ─────────────────────────────
    if (this.dialogueState === 'none') {
      for (let i = 0; i < this.orbs.length; i++) {
        if (this.encounteredOrbs.has(i)) continue;
        const orb = this.orbs[i];
        const dx2 = this.player.x - orb.x;
        const dy2 = this.player.y - orb.y;
        if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < ORB_ENCOUNTER_RADIUS) {
          this.encounteredOrbs.add(i);
          orb.setVisible(false);
          this.startWildEncounter();
          break;
        }
      }
    }

    this.player.update();
    this.rival.update();
    this.orbs.forEach(o => o.update(delta));
  }

  private startWildEncounter(): void {
    this.inEncounter = true;

    const enemyId    = WILD_STARTERS[Math.floor(Math.random() * WILD_STARTERS.length)];
    const enemyLevel = Math.floor(Math.random() * 6) + 5; // 5–10

    const ctx: ClassicBattleContext = {
      returnMap:      'OverworldScene',
      returnSpawn:    'default',
      playerMinariId: this.saveData.starterMonariId,
      enemyMinariId:  enemyId,
      battleType:     'wild',
      playerLevel:    this.saveData.monariLevel,
      enemyLevel,
      bondable:       false,
    };

    this.registry.set('classic_battle_context', ctx);

    this.cameras.main.fade(500, 0, 0, 0, false, (_cam: unknown, progress: number) => {
      if (progress === 1) this.scene.start('ClassicSoulDuelScene');
    });
  }

  private showXpNotification(xpGain: number, levelsGained: number): void {
    const w = this.scale.width;
    const h = this.scale.height;

    const lines: string[] = [`+${xpGain} XP`];
    if (levelsGained > 0) {
      lines.push(`Level Up!  Lv.${this.saveData.monariLevel}`);
    }

    const popup = this.add.text(w / 2, h / 2 - 60, lines.join('\n'), {
      fontSize: '22px',
      color: '#ffee44',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(100).setAlpha(0);

    this.tweens.add({
      targets: popup,
      alpha: 1,
      y: h / 2 - 80,
      duration: 300,
      ease: 'Quad.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup,
          alpha: 0,
          y: h / 2 - 105,
          duration: 700,
          delay: 1400,
          ease: 'Quad.In',
          onComplete: () => popup.destroy(),
        });
      },
    });
  }

  private openStartMenu(): void {
    // Toggle: if already visible, close it
    if (this.menuOverlay?.isVisible()) {
      this.menuOverlay.close();
      return;
    }

    if (!this.menuOverlay) {
      this.menuOverlay = new OverworldMenuOverlay({
        onClose: () => { /* panel hides itself */ },
        onModeSelect: () => {
          this.menuOverlay?.destroy();
          this.menuOverlay = null;
          this.scene.start('ModeSelectScene');
        },
      });
    }

    this.menuOverlay.showBonderMenu([this.saveData.starterMonariId], this.saveData);
  }

  shutdown(): void {
    this.dpad?.destroy();
    this.inputSys?.destroy();
    this.menuOverlay?.destroy();
    this.menuOverlay = null;
  }
}
