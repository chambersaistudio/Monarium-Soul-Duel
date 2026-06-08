import Phaser from 'phaser';
import { ClassicActor } from '../entities/ClassicActor';
import { ClassicBattleEngine } from '../systems/ClassicBattleEngine';
import { AudioManager } from '../systems/AudioManager';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS, BACK_COMMAND } from '../data/classicMoveData';
import { MINARI_ROSTER } from '../data/minariData';
import { CLASSIC_BATTLE_CONFIG } from '../config/classicBattleConfig';
import { AUDIO_KEYS } from '../config/audioConfig';
import type { ClassicBattlePhase, ClassicActorRole } from '../types/classic';

const GROUND_Y        = 420;
const PLAYER_ANCHOR_X = 200;
const ENEMY_ANCHOR_X  = 760;
const HP_BAR_W        = 200;
const HP_BAR_H        = 14;

export class ClassicSoulDuelScene extends Phaser.Scene {
  // Combatants
  private playerActor!: ClassicActor;
  private enemyActor!:  ClassicActor;
  private engine!:      ClassicBattleEngine;
  private audio!:       AudioManager;

  // UI — HP
  private playerHpFill!: Phaser.GameObjects.Rectangle;
  private enemyHpFill!:  Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!:  Phaser.GameObjects.Text;

  // UI — Command menu
  private menuGroup!:      Phaser.GameObjects.Container;
  private menuOptionTexts: Phaser.GameObjects.Text[] = [];
  private menuCommandIds:  string[] = [];
  private menuCursor       = 0;
  private menuVisible      = false;

  // UI — Misc
  private phaseLabel!:  Phaser.GameObjects.Text;
  private guardLabel!:  Phaser.GameObjects.Text;  // shows "GUARDING" over guarding actor

  // Input
  private upKey!:   Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private prevCursor = -1;

  constructor() { super({ key: 'ClassicSoulDuelScene' }); }

  // ── Preload (background image, scene-specific) ─────────────────────────────

  preload(): void {
    const { background } = CLASSIC_BATTLE_CONFIG;
    this.load.image(`bg_${background}`, `assets/backgrounds/classic/${background}.png`);
  }

  // ── Scene lifecycle ────────────────────────────────────────────────────────

  create(): void {
    const { width: w, height: h } = this.scale;

    this.drawBackground(w, h);

    // ── Combatants ─────────────────────────────────────────────────────────
    const playerData = MINARI_ROSTER['flarepaw'];
    const enemyData  = MINARI_ROSTER['droplet'];

    this.playerActor = new ClassicActor(
      this, PLAYER_ANCHOR_X, GROUND_Y - playerData.bodyHeight / 2,
      playerData, true,
    );
    this.enemyActor = new ClassicActor(
      this, ENEMY_ANCHOR_X, GROUND_Y - enemyData.bodyHeight / 2,
      enemyData, false,
    );

    // ── Engine ─────────────────────────────────────────────────────────────
    this.engine = new ClassicBattleEngine(
      this,
      this.playerActor,
      this.enemyActor,
      {
        onPhaseChange:     (p)          => this.onPhaseChange(p),
        onShowCommandMenu: ()           => this.showMenu(),
        onHideCommandMenu: ()           => this.hideMenu(),
        onDamageDealt:     (t, d, b, x, y) => this.onDamageDealt(t, d, b, x, y),
        onBattleEnd:       (w)          => this.onBattleEnd(w),
      },
    );

    // ── Audio ──────────────────────────────────────────────────────────────
    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.battle);

    // ── UI ─────────────────────────────────────────────────────────────────
    this.buildHpBars(w, playerData.name, enemyData.name);
    this.buildCommandMenu(w, h, playerData.id);
    this.buildPhaseLabel(w, h);

    // ── Input ──────────────────────────────────────────────────────────────
    this.upKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // ── Start ──────────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(500);
    this.time.delayedCall(800, () => this.engine.startBattle());
  }

  update(): void {
    this.playerActor.updateShadow();
    this.enemyActor.updateShadow();
    this.refreshHpBars();

    // Guard stance label — hovers above any actor currently in guard
    this.updateGuardLabels();

    if (!this.menuVisible) return;

    const upJust   = Phaser.Input.Keyboard.JustDown(this.upKey);
    const downJust = Phaser.Input.Keyboard.JustDown(this.downKey);
    const okJust   = Phaser.Input.Keyboard.JustDown(this.enterKey);

    if (upJust)   { this.menuCursor = (this.menuCursor - 1 + this.menuOptionTexts.length) % this.menuOptionTexts.length; this.refreshMenuCursor(); }
    if (downJust) { this.menuCursor = (this.menuCursor + 1) % this.menuOptionTexts.length; this.refreshMenuCursor(); }
    if (okJust)   { this.confirmMenuSelection(); }

    // Play UI move sound when cursor changes
    if (this.menuCursor !== this.prevCursor) {
      if (this.prevCursor !== -1) this.audio.playUi(AUDIO_KEYS.ui.move);
      this.prevCursor = this.menuCursor;
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const bgKey = `bg_${CLASSIC_BATTLE_CONFIG.background}`;

    if (this.textures.exists(bgKey)) {
      // Use the provided background image, scaled to fill
      this.add.image(w / 2, h / 2, bgKey).setDepth(0).setDisplaySize(w, h);
      // Semi-transparent overlay over the bottom section for readability
      const overlay = this.add.graphics().setDepth(1);
      overlay.fillStyle(0x000000, 0.35);
      overlay.fillRect(0, GROUND_Y, w, h - GROUND_Y);
    } else {
      // Procedural gradient fallback
      const bg = this.add.graphics().setDepth(0);
      for (let i = 0; i < h; i += 3) {
        const t = i / h;
        const r = Math.floor(Phaser.Math.Linear(10, 30, t));
        const g = Math.floor(Phaser.Math.Linear(5,  15, t));
        const b = Math.floor(Phaser.Math.Linear(20, 10, t));
        bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
        bg.fillRect(0, i, w, 3);
      }
      bg.fillStyle(0x1a1a2e, 1);
      bg.fillRect(0, GROUND_Y, w, h - GROUND_Y);
      bg.lineStyle(2, 0xff6600, 0.35);
      bg.lineBetween(0, GROUND_Y, w, GROUND_Y);
      for (let i = 1; i <= 4; i++) {
        bg.lineStyle(1, 0x333366, 0.4);
        bg.lineBetween(0, GROUND_Y + i * 15, w, GROUND_Y + i * 15);
      }
    }
  }

  // ── HP bars ─────────────────────────────────────────────────────────────────

  private buildHpBars(w: number, playerName: string, enemyName: string): void {
    const depth = 20;
    const py = 22, ey = 22;

    // Player (left side)
    this.add.text(20, py - 14, playerName.toUpperCase(), {
      fontSize: '11px', color: '#ff9944', fontFamily: 'monospace',
    }).setDepth(depth);
    this.add.rectangle(20, py, HP_BAR_W, HP_BAR_H, 0x222222).setOrigin(0, 0).setDepth(depth);
    this.playerHpFill = this.add.rectangle(20, py, HP_BAR_W, HP_BAR_H, 0x44cc44)
      .setOrigin(0, 0).setDepth(depth + 1);
    this.playerHpText = this.add.text(20 + HP_BAR_W + 6, py + 1, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setDepth(depth + 1);

    // Enemy (right side)
    const ex = w - 20 - HP_BAR_W;
    this.add.text(ex, ey - 14, enemyName.toUpperCase(), {
      fontSize: '11px', color: '#44aaff', fontFamily: 'monospace',
    }).setDepth(depth);
    this.add.rectangle(ex, ey, HP_BAR_W, HP_BAR_H, 0x222222).setOrigin(0, 0).setDepth(depth);
    this.enemyHpFill = this.add.rectangle(ex, ey, HP_BAR_W, HP_BAR_H, 0x44cc44)
      .setOrigin(0, 0).setDepth(depth + 1);
    this.enemyHpText = this.add.text(ex - 50, ey + 1, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setDepth(depth + 1);
  }

  private refreshHpBars(): void {
    const pRatio = Math.max(0, this.playerActor.hp / this.playerActor.maxHp);
    const eRatio = Math.max(0, this.enemyActor.hp  / this.enemyActor.maxHp);
    this.playerHpFill.width = HP_BAR_W * pRatio;
    this.enemyHpFill.width  = HP_BAR_W * eRatio;
    this.playerHpFill.setFillStyle(this.hpColor(pRatio));
    this.enemyHpFill.setFillStyle(this.hpColor(eRatio));
    this.playerHpText.setText(`${Math.ceil(this.playerActor.hp)}/${this.playerActor.maxHp}`);
    this.enemyHpText.setText(`${Math.ceil(this.enemyActor.hp)}/${this.enemyActor.maxHp}`);
  }

  private hpColor(ratio: number): number {
    if (ratio > 0.5) return 0x44cc44;
    if (ratio > 0.25) return 0xddcc00;
    return 0xdd3322;
  }

  // ── Guard stance label ────────────────────────────────────────────────────

  private buildPhaseLabel(w: number, _h: number): void {
    this.phaseLabel = this.add.text(w / 2, GROUND_Y + 12, '', {
      fontSize: '11px', color: '#555577', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(15);

    // Persistent guard label (repositioned in update)
    this.guardLabel = this.add.text(0, 0, '🛡 GUARDING', {
      fontSize: '11px', color: '#88ddff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25).setVisible(false);
  }

  private updateGuardLabels(): void {
    const guardingActor = this.playerActor.isGuarding
      ? this.playerActor
      : this.enemyActor.isGuarding
        ? this.enemyActor
        : null;

    if (guardingActor) {
      this.guardLabel.setVisible(true);
      this.guardLabel.setPosition(guardingActor.x, guardingActor.y - 70);
    } else {
      this.guardLabel.setVisible(false);
    }
  }

  private onPhaseChange(phase: ClassicBattlePhase): void {
    const labels: Partial<Record<ClassicBattlePhase, string>> = {
      player_command:   'Choose a command...',
      approach_target:  'Approaching...',
      return_to_anchor: 'Returning...',
    };
    this.phaseLabel.setText(labels[phase] ?? '');
  }

  // ── Command menu ──────────────────────────────────────────────────────────

  private buildCommandMenu(w: number, h: number, playerId: string): void {
    const menuW = 320, menuH = 160, menuX = 20, menuY = h - menuH - 12;

    this.menuGroup = this.add.container(menuX, menuY).setDepth(30).setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.92);
    bg.fillRoundedRect(0, 0, menuW, menuH, 8);
    bg.lineStyle(2, 0xff6600, 0.6);
    bg.strokeRoundedRect(0, 0, menuW, menuH, 8);
    this.menuGroup.add(bg);

    this.add.text(menuX + 10, menuY - 18, '── COMMAND ──', {
      fontSize: '10px', color: '#ff6600', fontFamily: 'monospace',
    }).setDepth(30);

    const moveset = CLASSIC_COMMAND_SETS[playerId] ?? ['basic_attack'];
    this.menuCommandIds  = [...moveset, BACK_COMMAND];
    this.menuOptionTexts = [];
    this.menuCursor      = 0;

    this.menuCommandIds.forEach((id, i) => {
      const label = id === BACK_COMMAND
        ? 'Back'
        : (CLASSIC_MOVES[id]?.displayName ?? id);
      const cost  = id !== BACK_COMMAND && CLASSIC_MOVES[id]?.auraCost
        ? ` (${CLASSIC_MOVES[id].auraCost} aura)`
        : '';
      const txt = this.add.text(20, 16 + i * 32, `  ${label}${cost}`, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
      });
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerover',  () => { this.menuCursor = i; this.refreshMenuCursor(); });
      txt.on('pointerdown',  () => { this.menuCursor = i; this.confirmMenuSelection(); });
      this.menuGroup.add(txt);
      this.menuOptionTexts.push(txt);
    });

    this.refreshMenuCursor();
  }

  private refreshMenuCursor(): void {
    this.menuOptionTexts.forEach((t, i) => {
      t.setColor(i === this.menuCursor ? '#ffcc44' : '#cccccc');
      const base = t.text.replace(/^[▶ ]\s*/, '');
      t.setText((i === this.menuCursor ? '▶ ' : '  ') + base);
    });
  }

  private showMenu(): void {
    this.menuVisible  = true;
    this.menuCursor   = 0;
    this.prevCursor   = -1;
    this.menuGroup.setVisible(true);
    this.refreshMenuCursor();
  }

  private hideMenu(): void {
    this.menuVisible = false;
    this.menuGroup.setVisible(false);
  }

  private confirmMenuSelection(): void {
    if (!this.menuVisible) return;
    const selected = this.menuCommandIds[this.menuCursor];
    if (selected === BACK_COMMAND) return;
    this.audio.playUi(AUDIO_KEYS.ui.confirm);
    this.engine.submitPlayerMove(selected);
  }

  // ── Damage + block display ────────────────────────────────────────────────

  private onDamageDealt(
    target:  ClassicActorRole,
    amount:  number,
    blocked: boolean,
    worldX:  number,
    worldY:  number,
  ): void {
    const actor = target === 'player' ? this.playerActor : this.enemyActor;

    if (blocked) {
      // Show blocked indicator — reduced damage in a different style
      this.spawnBlockedDisplay(worldX, worldY, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.guardBlock);
    } else {
      this.spawnDamageNumber(worldX, worldY, amount);
      this.audio.playSfx(AUDIO_KEYS.sfx.attackHit);
      this.audio.playSfx(AUDIO_KEYS.sfx.hurtImpact, 0.6);
      this.audio.playCreatureHurt(actor.actorId);
    }
  }

  private spawnDamageNumber(worldX: number, worldY: number, amount: number): void {
    const txt = this.add.text(worldX, worldY, `-${amount}`, {
      fontSize: '22px', color: '#ffdd44', fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets:  txt,
      y:        worldY - 60,
      alpha:    0,
      duration: 900,
      ease:     'Cubic.Out',
      onComplete: () => txt.destroy(),
    });
  }

  private spawnBlockedDisplay(worldX: number, worldY: number, amount: number): void {
    // "BLOCKED" header
    const hdr = this.add.text(worldX, worldY - 10, 'BLOCKED!', {
      fontSize: '16px', color: '#88ddff', fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // Reduced damage number below in smaller text
    const sub = this.add.text(worldX, worldY + 12, `-${amount}`, {
      fontSize: '13px', color: '#aaccee', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);

    for (const obj of [hdr, sub]) {
      this.tweens.add({
        targets:  obj,
        y:        obj.y - 50,
        alpha:    0,
        duration: 1100,
        ease:     'Cubic.Out',
        onComplete: () => obj.destroy(),
      });
    }
  }

  // ── Battle end ────────────────────────────────────────────────────────────

  private onBattleEnd(winner: ClassicActorRole): void {
    const { width: w, height: h } = this.scale;
    const isWin  = winner === 'player';
    const title  = isWin ? 'VICTORY!'  : 'DEFEAT';
    const colour = isWin ? '#ffcc44'   : '#ff4444';
    const sub    = isWin ? 'Your Monari triumphed!' : 'Your Monari was defeated.';

    // Audio
    this.audio.stopBgm();
    this.audio.playSfx(isWin ? AUDIO_KEYS.sfx.victory : AUDIO_KEYS.sfx.defeat, 1.0);

    // Overlay
    const panel = this.add.graphics().setDepth(60);
    panel.fillStyle(0x000000, 0.65);
    panel.fillRect(0, 0, w, h);

    this.add.text(w / 2, h / 2 - 50, title, {
      fontSize: '56px', color: colour, fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(61);

    this.add.text(w / 2, h / 2 + 20, sub, {
      fontSize: '18px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(61);

    const returnTxt = this.add.text(w / 2, h / 2 + 70, 'Press ENTER to return', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(61);
    this.tweens.add({ targets: returnTxt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    this.time.delayedCall(600, () => {
      this.input.keyboard!.once('keydown-ENTER', () => {
        this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('ModeSelectScene');
        });
      });
    });
  }
}
