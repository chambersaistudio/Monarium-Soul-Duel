import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { VirtualDpad } from '../systems/VirtualDpad';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';
import { IS_TOUCH_DEVICE, SAFE_AREA_BOTTOM } from '../config/mobileConfig';
import { OVERWORLD_MAPS } from '../data/overworldMaps';
import { CHALLENGERS } from '../data/challengerData';
import { PLAYER_PROFILE, renzoCounterPick } from '../data/playerProfile';
import { MINARI_ROSTER } from '../data/minariData';
import type { MapDef, NpcDef, EncounterOrb, ClassicBattleContext } from '../types/overworld';

// Player visual size at 960-wide reference viewport
const PLAYER_W_REF = 28;
const PLAYER_H_REF = 44;

export class ClassicOverworldScene extends Phaser.Scene {
  // Renamed to avoid collision with Phaser.Scene.input (InputPlugin)
  private inputSys!:  InputSystem;
  private dpad:       VirtualDpad | null = null;
  private audio!:     AudioManager;

  private mapDef!:    MapDef;
  private mapId!:     string;

  // Player state
  private playerX:    number = 0;
  private playerY:    number = 0;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private nameLabel!: Phaser.GameObjects.Text;

  // Scaled dimensions (set in create)
  private playerW:    number = PLAYER_W_REF;
  private playerH:    number = PLAYER_H_REF;
  private walkSpeed:  number = PLAYER_PROFILE.walkSpeed;

  // Interact prompt
  private interactPrompt!:  Phaser.GameObjects.Text;
  private promptTarget:     NpcDef | null = null;

  // Dialogue overlay
  private dialogActive   = false;
  private dialogLines:   string[] = [];
  private dialogIndex    = 0;
  private dialogPanel:   (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private dialogBodyText!: Phaser.GameObjects.Text;
  private dialogOnEnd:   (() => void) | null = null;

  // Starter confirm overlay
  private starterPanelActive = false;

  constructor() { super({ key: 'ClassicOverworldScene' }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    const { width: w, height: h } = this.scale;

    this.mapId  = (this.registry.get('classic_current_map') as string) ?? 'starter_village';
    this.mapDef = OVERWORLD_MAPS[this.mapId] ?? OVERWORLD_MAPS['starter_village'];

    // Scale player proportionally to viewport
    const scl    = w / 960;
    this.playerW = Math.round(PLAYER_W_REF * scl);
    this.playerH = Math.round(PLAYER_H_REF * scl);
    this.walkSpeed = PLAYER_PROFILE.walkSpeed * scl;

    this.drawBackground(w, h);
    this.buildNpcs(w, h);
    this.buildOrbs(w, h);

    const spawnName = (this.registry.get('classic_spawn_name') as string) ?? this.mapDef.defaultSpawn;
    const spawn     = this.mapDef.spawns[spawnName] ?? this.mapDef.spawns[this.mapDef.defaultSpawn];
    this.playerX    = spawn.x * w;
    this.playerY    = spawn.y * h;

    this.playerGfx = this.add.graphics().setDepth(20);
    this.drawPlayer();

    this.nameLabel = this.add.text(0, 0, this.getPlayerName(), {
      fontSize: IS_TOUCH_DEVICE ? '11px' : '10px',
      color: '#ffdd88', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(21);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontSize: IS_TOUCH_DEVICE ? '11px' : '10px',
      color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(22).setVisible(false);

    // Map name badge
    this.add.text(w / 2, IS_TOUCH_DEVICE ? 12 : 10, this.mapDef.displayName, {
      fontSize: IS_TOUCH_DEVICE ? '13px' : '11px',
      color: '#ffaa44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(50);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.inputSys = new InputSystem(this);
    if (IS_TOUCH_DEVICE) {
      this.dpad = new VirtualDpad(this, this.inputSys);
    }
    // ESC → mode select
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => this.returnToModeSelect());

    // ── Audio ─────────────────────────────────────────────────────────────────
    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    // Cleanup on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSys?.destroy();
      this.dpad?.destroy();
    });

    this.cameras.main.fadeIn(400);
  }

  update(_time: number, delta: number): void {
    if (this.dialogActive || this.starterPanelActive) {
      this.drawPlayer();
      this.updateNameLabel();
      return;
    }

    const dt  = delta / 1000;
    const mv  = this.inputSys.getOverworldMove();
    const { width: w, height: h } = this.scale;

    const dx = (mv.right ? 1 : 0) - (mv.left ? 1 : 0);
    const dy = (mv.down  ? 1 : 0) - (mv.up   ? 1 : 0);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dx !== 0 || dy !== 0) {
      this.playerX += (dx / len) * this.walkSpeed * dt;
      this.playerY += (dy / len) * this.walkSpeed * dt;
    }

    this.resolveCollisions(w, h);
    this.checkExits(w, h);
    this.checkOrbContact(w, h);
    this.drawPlayer();
    this.updateNameLabel();
    this.updateInteractPrompt(w, h);

    if (this.inputSys.isJustDown('enter') || this.inputSys.isJustDown('e')) {
      if (this.promptTarget) this.triggerInteract(this.promptTarget);
    }
  }

  // ── Background ───────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    if (this.textures.exists(this.mapDef.bgKey)) {
      const frame = this.textures.getFrame(this.mapDef.bgKey);
      const scale = Math.max(w / frame.realWidth, h / frame.realHeight);
      this.add.image(w / 2, h / 2, this.mapDef.bgKey).setDepth(0).setScale(scale);
    } else {
      const bg = this.add.graphics().setDepth(0);
      for (let i = 0; i < h; i += 4) {
        const t = i / h;
        bg.fillStyle(Phaser.Display.Color.GetColor(
          Math.floor(Phaser.Math.Linear(8, 22, t)),
          Math.floor(Phaser.Math.Linear(16, 32, t)),
          Math.floor(Phaser.Math.Linear(8, 14, t)),
        ), 1);
        bg.fillRect(0, i, w, 4);
      }
    }
    if (IS_TOUCH_DEVICE && SAFE_AREA_BOTTOM > 0) {
      this.add.graphics().setDepth(100)
        .fillStyle(0x000000, 1)
        .fillRect(0, h, w, SAFE_AREA_BOTTOM);
    }
  }

  // ── NPC / Orb visuals ────────────────────────────────────────────────────────

  private buildNpcs(w: number, h: number): void {
    for (const npc of this.mapDef.npcs) {
      const nx = npc.x * w, ny = npc.y * h;
      const g = this.add.graphics().setDepth(12);
      g.fillStyle(npc.color, 0.9);
      g.fillCircle(nx, ny, 16);
      g.lineStyle(2, 0xffffff, 0.4);
      g.strokeCircle(nx, ny, 16);

      this.add.text(nx, ny - 20, npc.displayName, {
        fontSize: '9px', color: '#ccccff', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(13);
    }
  }

  private buildOrbs(w: number, h: number): void {
    for (const orb of this.mapDef.encounterOrbs) {
      const ox = orb.x * w, oy = orb.y * h;
      const g  = this.add.graphics().setDepth(11);
      this.drawOrb(g, ox, oy, orb.color);
      this.tweens.add({
        targets: g, alpha: 0.55, duration: 900 + Math.random() * 400,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private drawOrb(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    g.clear();
    g.fillStyle(color, 0.18); g.fillCircle(x, y, 22);
    g.fillStyle(color, 0.35); g.fillCircle(x, y, 15);
    g.fillStyle(color, 0.85); g.fillCircle(x, y, 9);
    g.lineStyle(1.5, 0xffffff, 0.5); g.strokeCircle(x, y, 9);
  }

  // ── Player drawing ────────────────────────────────────────────────────────────

  private drawPlayer(): void {
    const g  = this.playerGfx;
    const px = this.playerX, py = this.playerY;
    const hw = this.playerW / 2, hh = this.playerH;
    g.clear();
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(px, py + 2, hw * 2.2, 8);
    g.fillStyle(0xff6600, 1);
    g.fillRoundedRect(px - hw, py - hh, this.playerW, this.playerH, 6);
    g.fillStyle(0xffaa44, 0.7);
    g.fillRoundedRect(px - hw + 4, py - hh + 4, this.playerW - 8, 14, 4);
    g.fillStyle(0x111111, 1);
    g.fillCircle(px - 5, py - hh + 12, 3);
    g.fillCircle(px + 5, py - hh + 12, 3);
  }

  private updateNameLabel(): void {
    this.nameLabel.setPosition(this.playerX, this.playerY - this.playerH - 2);
  }

  // ── Collision ─────────────────────────────────────────────────────────────────

  private resolveCollisions(w: number, h: number): void {
    const pw = this.playerW, ph = this.playerH;
    const pl = this.playerX - pw / 2;
    const pt = this.playerY - ph;

    for (const rect of this.mapDef.collisionRects) {
      const rx = rect.x * w, ry = rect.y * h;
      const rw = rect.w * w, rh = rect.h * h;

      if (pl < rx + rw && pl + pw > rx && pt < ry + rh && pt + ph > ry) {
        const oL = (pl + pw) - rx;
        const oR = (rx + rw) - pl;
        const oT = (pt + ph) - ry;
        const oB = (ry + rh) - pt;
        const min = Math.min(oL, oR, oT, oB);

        if      (min === oL) this.playerX -= oL;
        else if (min === oR) this.playerX += oR;
        else if (min === oT) this.playerY -= oT;
        else                 this.playerY += oB;
      }
    }
  }

  // ── Exits ─────────────────────────────────────────────────────────────────────

  private checkExits(w: number, h: number): void {
    for (const exit of this.mapDef.exits) {
      const ex = exit.rect.x * w, ey = exit.rect.y * h;
      const ew = exit.rect.w * w, eh = exit.rect.h * h;
      if (this.playerX >= ex && this.playerX <= ex + ew &&
          this.playerY >= ey && this.playerY <= ey + eh) {
        this.travelToMap(exit.targetMap, exit.targetSpawn);
        return;
      }
    }
  }

  // ── Encounter orb contact ─────────────────────────────────────────────────────

  private checkOrbContact(w: number, h: number): void {
    for (const orb of this.mapDef.encounterOrbs) {
      const dist = Phaser.Math.Distance.Between(
        this.playerX, this.playerY, orb.x * w, orb.y * h,
      );
      if (dist < 24) { this.triggerWildBattle(orb); return; }
    }
  }

  // ── Interact prompt ───────────────────────────────────────────────────────────

  private updateInteractPrompt(w: number, h: number): void {
    let nearest: NpcDef | null = null;
    let nearDist = Infinity;

    for (const npc of this.mapDef.npcs) {
      const dist = Phaser.Math.Distance.Between(
        this.playerX, this.playerY, npc.x * w, npc.y * h,
      );
      const threshold = npc.interactRadius * Math.min(w, h);
      if (dist < threshold && dist < nearDist) { nearest = npc; nearDist = dist; }
    }

    if (nearest) {
      this.promptTarget = nearest;
      const label = IS_TOUCH_DEVICE ? `[A] ${nearest.displayName}` : `[ENTER] ${nearest.displayName}`;
      this.interactPrompt.setText(label)
        .setPosition(this.playerX, this.playerY - this.playerH - 18)
        .setVisible(true);
    } else {
      this.promptTarget = null;
      this.interactPrompt.setVisible(false);
    }
  }

  // ── NPC interaction ───────────────────────────────────────────────────────────

  private triggerInteract(npc: NpcDef): void {
    this.audio.playUi(AUDIO_KEYS.ui.confirm);

    if (npc.id === 'lab_door') {
      this.travelToMap('bond_lab_interior', 'default');
      return;
    }

    if (npc.role === 'starter_pedestal_1' || npc.role === 'starter_pedestal_2' || npc.role === 'starter_pedestal_3') {
      this.handleStarterPedestal(npc);
      return;
    }

    if (npc.role === 'rival' && npc.challengerId) {
      this.handleRivalInteract(npc);
      return;
    }

    if (npc.dialog && npc.dialog.length > 0) {
      this.showDialog(npc.dialog);
    }
  }

  // ── Rival flow ────────────────────────────────────────────────────────────────

  private handleRivalInteract(npc: NpcDef): void {
    const starter = this.registry.get('classic_player_starter') as string | null;
    if (!starter) {
      this.showDialog([
        'Renzo: You don\'t have a Minari yet!',
        'Renzo: Visit the Bond Lab and choose your starter first.',
      ]);
      return;
    }
    const challenger = CHALLENGERS[npc.challengerId!];
    if (!challenger) return;
    this.showDialog(challenger.preBattleDialog, () => this.startRivalBattle(npc.challengerId!));
  }

  private startRivalBattle(challengerId: string): void {
    const playerStarter = (this.registry.get('classic_player_starter') as string) ?? 'flarepaw';
    const renzoStarter  = (this.registry.get('classic_renzo_starter')  as string) ?? renzoCounterPick(playerStarter);

    const ctx: ClassicBattleContext = {
      returnMap:      this.mapId,
      returnSpawn:    'from_battle',
      playerMinariId: playerStarter,
      enemyMinariId:  renzoStarter,
      bondable:       false,
      battleType:     'rival',
    };
    this.registry.set('classic_battle_context', ctx);
    this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('ClassicSoulDuelScene');
    });
  }

  // ── Wild battle ───────────────────────────────────────────────────────────────

  private triggerWildBattle(orb: EncounterOrb): void {
    const playerStarter = (this.registry.get('classic_player_starter') as string) ?? 'flarepaw';
    const ctx: ClassicBattleContext = {
      returnMap:      this.mapId,
      returnSpawn:    'from_battle',
      playerMinariId: playerStarter,
      enemyMinariId:  orb.minariId,
      bondable:       orb.bondable,
      battleType:     'wild',
    };
    this.registry.set('classic_battle_context', ctx);
    this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('ClassicSoulDuelScene');
    });
  }

  // ── Starter selection ─────────────────────────────────────────────────────────

  private handleStarterPedestal(npc: NpcDef): void {
    if (this.registry.get('classic_starter_chosen')) {
      const s    = this.registry.get('classic_player_starter') as string;
      const name = MINARI_ROSTER[s]?.name ?? s;
      this.showDialog([`You already bonded with ${name}.`]);
      return;
    }
    const id = npc.role === 'starter_pedestal_1' ? 'flarepaw'
             : npc.role === 'starter_pedestal_2' ? 'droplet'
             : 'umbravine';
    this.showStarterConfirm(id);
  }

  private showStarterConfirm(starterId: string): void {
    const minari = MINARI_ROSTER[starterId];
    if (!minari) return;

    this.starterPanelActive = true;
    const { width: w, height: h } = this.scale;
    const bx = w / 2 - 200, by = h / 2 - 80;

    const panel = this.add.graphics().setDepth(90);
    panel.fillStyle(0x070714, 0.97);
    panel.fillRoundedRect(bx, by, 400, 160, 12);
    panel.lineStyle(2, 0xff6600, 0.6);
    panel.strokeRoundedRect(bx, by, 400, 160, 12);

    const t1 = this.add.text(w / 2, by + 28, `Bond with ${minari.name}?`, {
      fontSize: '20px', color: '#ffcc44', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(91);

    const el = minari.element.charAt(0).toUpperCase() + minari.element.slice(1);
    const t2 = this.add.text(w / 2, by + 60, `${el} type  ·  HP ${minari.stats.maxHp}`, {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(91);

    const yesBtn = this.add.text(w / 2 - 70, by + 115, '[ YES ]', {
      fontSize: '16px', color: '#44dd88', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(91).setInteractive();

    const noBtn = this.add.text(w / 2 + 70, by + 115, '[ NO ]', {
      fontSize: '16px', color: '#dd4444', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(91).setInteractive();

    const all = [panel, t1, t2, yesBtn, noBtn];

    const confirm = (): void => {
      all.forEach(o => o.destroy());
      this.starterPanelActive = false;
      this.input.keyboard!.off('keydown-ENTER', confirm);
      this.input.keyboard!.off('keydown-ESC', cancel);
      this.confirmStarterChoice(starterId);
    };
    const cancel = (): void => {
      all.forEach(o => o.destroy());
      this.starterPanelActive = false;
      this.input.keyboard!.off('keydown-ENTER', confirm);
      this.input.keyboard!.off('keydown-ESC', cancel);
    };

    yesBtn.on('pointerdown', confirm);
    noBtn.on('pointerdown', cancel);
    this.input.keyboard!.once('keydown-ENTER', confirm);
    this.input.keyboard!.once('keydown-ESC',   cancel);
  }

  private confirmStarterChoice(starterId: string): void {
    this.registry.set('classic_player_starter', starterId);
    this.registry.set('classic_starter_chosen', true);
    const renzoId = renzoCounterPick(starterId);
    this.registry.set('classic_renzo_starter', renzoId);

    const myName    = MINARI_ROSTER[starterId]?.name ?? starterId;
    const renzoName = MINARI_ROSTER[renzoId]?.name   ?? renzoId;
    this.showDialog([
      `You bonded with ${myName}!`,
      `Renzo: Ha! Then I'll take ${renzoName}. Type advantage — fair is fair.`,
      'Renzo: Meet me at the Training Field when you\'re ready to spar.',
    ]);
  }

  // ── Dialog overlay ────────────────────────────────────────────────────────────

  private showDialog(lines: string[], onEnd?: () => void): void {
    if (this.dialogActive) return;
    this.dialogActive = true;
    this.dialogLines  = lines;
    this.dialogIndex  = 0;
    this.dialogOnEnd  = onEnd ?? null;
    this.dialogPanel  = [];
    this.buildDialogPanel();
    this.renderDialogLine();
  }

  private buildDialogPanel(): void {
    const { width: w, height: h } = this.scale;
    const mob  = IS_TOUCH_DEVICE;
    const panH = mob ? 80 : 72;
    const panY = h - panH - (mob ? SAFE_AREA_BOTTOM : 0);

    const bg = this.add.graphics().setDepth(80);
    bg.fillStyle(0x07070f, 0.96);
    bg.fillRect(0, panY, w, panH + (mob ? SAFE_AREA_BOTTOM : 0));
    bg.lineStyle(2, 0xff6600, 0.5);
    bg.lineBetween(0, panY, w, panY);

    this.dialogBodyText = this.add.text(w / 2, panY + panH / 2, '', {
      fontSize: mob ? '13px' : '12px',
      color: '#ddddee', fontFamily: 'monospace',
      wordWrap: { width: w - 40 }, align: 'center',
    }).setOrigin(0.5).setDepth(81);

    const hint = this.add.text(w - 12, panY + panH - 8, mob ? 'tap • ENTER' : 'ENTER / tap', {
      fontSize: '9px', color: '#444466', fontFamily: 'monospace',
    }).setOrigin(1, 1).setDepth(81);

    this.dialogPanel.push(bg, this.dialogBodyText, hint);

    this.input.on('pointerdown', this.onDialogAdvance, this);
    this.input.keyboard!.on('keydown-ENTER', this.onDialogAdvance, this);
    this.input.keyboard!.on('keydown-SPACE', this.onDialogAdvance, this);
  }

  private readonly onDialogAdvance = (): void => { this.advanceDialog(); };

  private renderDialogLine(): void {
    if (this.dialogIndex < this.dialogLines.length) {
      this.dialogBodyText.setText(this.dialogLines[this.dialogIndex]);
      this.dialogIndex++;
    } else {
      this.closeDialog();
    }
  }

  private advanceDialog(): void {
    if (!this.dialogActive) return;
    this.renderDialogLine();
  }

  private closeDialog(): void {
    this.input.off('pointerdown', this.onDialogAdvance, this);
    this.input.keyboard!.off('keydown-ENTER', this.onDialogAdvance, this);
    this.input.keyboard!.off('keydown-SPACE', this.onDialogAdvance, this);

    this.dialogPanel.forEach(o => o.destroy());
    this.dialogPanel  = [];
    this.dialogActive = false;

    const cb = this.dialogOnEnd;
    this.dialogOnEnd = null;
    cb?.();
  }

  // ── Map travel ────────────────────────────────────────────────────────────────

  private travelToMap(targetMapId: string, spawnName: string): void {
    this.registry.set('classic_current_map', targetMapId);
    this.registry.set('classic_spawn_name',  spawnName);
    this.cameras.main.fade(350, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.restart();
    });
  }

  private returnToModeSelect(): void {
    if (this.dialogActive || this.starterPanelActive) return;
    this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('ModeSelectScene');
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private getPlayerName(): string {
    return (this.registry.get('classic_player_name') as string) ?? PLAYER_PROFILE.displayName;
  }
}
