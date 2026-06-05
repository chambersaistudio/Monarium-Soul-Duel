import Phaser from 'phaser';
import { MinariFighter } from '../entities/MinariFighter';
import { Projectile } from '../entities/Projectile';
import { InputSystem } from '../systems/InputSystem';
import { UISystem } from '../systems/UISystem';
import { MINARI_ROSTER } from '../data/minariData';
import { ULTIMATES } from '../data/moveData';

type BattlePhase = 'fighting' | 'ultimate_pause' | 'result';

// Arcade physics expects specific types; cast containers through unknown
type ArcadeTarget = Phaser.Types.Physics.Arcade.ArcadeColliderType;

export class BattleScene extends Phaser.Scene {
  private player!: MinariFighter;
  private enemy!: MinariFighter;
  private inputSys!: InputSystem;
  private uiSys!: UISystem;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private phase: BattlePhase = 'fighting';
  private resultShown = false;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private ultimateTimer = 0;
  private flashGfx!: Phaser.GameObjects.Graphics;
  private enterLockTimer = 1200;

  private aiTimer = 0;

  // Debug overlay (toggle with D key)
  private debugMode = false;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private debugText!: Phaser.GameObjects.Text;
  private debugBg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.bgGfx = this.add.graphics().setDepth(0);
    this.flashGfx = this.add.graphics().setDepth(300);
    this.drawArena(w, h);
    this.drawBonders(w, h);

    this.projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: 20,
      runChildUpdate: false
    });

    // Deep-copy stat objects so re-entering battle resets them
    const flareData = { ...MINARI_ROSTER.flarepaw, stats: { ...MINARI_ROSTER.flarepaw.stats } };
    const dropData  = { ...MINARI_ROSTER.droplet,  stats: { ...MINARI_ROSTER.droplet.stats  } };

    const floorY = h - 120;
    this.player = new MinariFighter(this, 180,      floorY, flareData, true,  this.projectiles);
    this.enemy  = new MinariFighter(this, w - 180,  floorY, dropData,  false, this.projectiles);
    this.player.facing = 1;
    this.enemy.facing  = -1;

    this.inputSys = new InputSystem(this);
    this.uiSys    = new UISystem(this);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Static floor platform
    const platform = this.physics.add.staticGroup();
    const floor = this.add.rectangle(w / 2, h - 80, w - 60, 20, 0x334433, 0);
    platform.add(floor as unknown as Phaser.GameObjects.GameObject);

    this.physics.add.collider(this.player as unknown as ArcadeTarget, platform);
    this.physics.add.collider(this.enemy  as unknown as ArcadeTarget, platform);

    // Projectile overlaps
    this.physics.add.overlap(
      this.projectiles,
      this.enemy as unknown as ArcadeTarget,
      (obj1) => {
        const proj = obj1 as Projectile;
        if (proj.active && proj.ownerId === 'flarepaw') {
          this.enemy.takeDamage(proj.damage);
          proj.deactivate();
          this.spawnHitFX(this.enemy.x, this.enemy.y, 0xff4400);
        }
      }
    );

    this.physics.add.overlap(
      this.projectiles,
      this.player as unknown as ArcadeTarget,
      (obj1) => {
        const proj = obj1 as Projectile;
        if (proj.active && proj.ownerId === 'droplet') {
          this.player.takeDamage(proj.damage);
          proj.deactivate();
          this.spawnHitFX(this.player.x, this.player.y, 0x00aaff);
        }
      }
    );

    this.cameras.main.fadeIn(500);
    this.time.delayedCall(600, () => this.uiSys.showAnnounce('SOUL DUEL!', 1500));

    // ── Debug overlay ──
    this.debugKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.debugBg   = this.add.rectangle(0, 0, 600, 130, 0x000000, 0.75)
                              .setOrigin(0, 0).setDepth(500).setVisible(false);
    this.debugText = this.add.text(8, 6, '', {
      fontSize: '11px', color: '#00ff88', fontFamily: 'monospace', lineSpacing: 4
    }).setDepth(501).setVisible(false);

    console.log('[BattleScene] Press D to toggle debug overlay.');
  }

  private drawArena(w: number, h: number): void {
    const g = this.bgGfx;
    g.clear();

    // Sky gradient — dusk atmosphere
    for (let i = 0; i < h * 0.65; i += 3) {
      const t = i / (h * 0.65);
      const r = Math.floor(Phaser.Math.Linear(10, 60, t));
      const gv = Math.floor(Phaser.Math.Linear(6, 20, t));
      const b = Math.floor(Phaser.Math.Linear(30, 50, t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, i, w, 3);
    }

    // Back wall
    g.fillStyle(0x1a1a2a, 1);
    g.fillRect(0, h * 0.55, w, h * 0.45);

    // Arena floor
    g.fillStyle(0x2a3a2a, 1);
    g.fillRect(30, h - 100, w - 60, 30);
    g.fillStyle(0x3a5a3a, 1);
    g.fillRect(30, h - 102, w - 60, 6);

    // Center circle + line
    g.lineStyle(1, 0x44aa44, 0.3);
    g.lineBetween(w / 2, h - 102, w / 2, h - 80);
    g.strokeCircle(w / 2, h - 102, 60);

    // Corner pillars
    g.fillStyle(0x222233, 1);
    g.fillRect(30, h * 0.4, 30, h * 0.6 - 80);
    g.fillRect(w - 60, h * 0.4, 30, h * 0.6 - 80);

    // Crowd silhouette
    g.fillStyle(0x0f0f1a, 0.9);
    for (let x = 0; x < w; x += 22) {
      const crowdH = 30 + Math.sin(x * 0.2) * 10;
      g.fillEllipse(x + 11, h * 0.55, 18, crowdH);
    }

    // Corner energy orbs
    g.fillStyle(0x44ff88, 0.25);
    g.fillCircle(60, h - 105, 20);
    g.fillStyle(0xff4422, 0.25);
    g.fillCircle(w - 60, h - 105, 20);

    // Floor shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(30, h - 75, w - 60, 15);
  }

  private drawBonders(w: number, h: number): void {
    const ag = this.add.graphics().setDepth(2);
    const ax = 65, ay = h - 180;
    ag.fillStyle(0x6633aa, 0.7);
    ag.fillRoundedRect(ax - 10, ay, 20, 28, 5);
    ag.fillStyle(0x9955dd, 0.7);
    ag.fillCircle(ax, ay - 10, 10);
    ag.fillStyle(0x221133, 0.7);
    ag.fillTriangle(ax - 7, ay - 18, ax + 7, ay - 18, ax + 3, ay - 8);

    const rg = this.add.graphics().setDepth(2);
    const rx = w - 65, ry = h - 180;
    rg.fillStyle(0x2255cc, 0.7);
    rg.fillRoundedRect(rx - 10, ry, 20, 28, 5);
    rg.fillStyle(0x4488ff, 0.7);
    rg.fillCircle(rx, ry - 10, 10);
    rg.fillStyle(0x001144, 0.7);
    rg.fillTriangle(rx - 7, ry - 18, rx + 7, ry - 18, rx - 3, ry - 8);

    this.add.text(ax, ay - 30, 'Amari', {
      fontSize: '10px', color: '#cc88ff', fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(3).setAlpha(0.7);
    this.add.text(rx, ry - 30, 'Rival', {
      fontSize: '10px', color: '#88aaff', fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(3).setAlpha(0.7);
  }

  private spawnHitFX(x: number, y: number, color: number): void {
    const g = this.add.graphics().setDepth(50);
    g.fillStyle(color, 0.8);
    g.fillCircle(x, y, 20);
    this.tweens.add({
      targets: g,
      scaleX: 2.5, scaleY: 2.5, alpha: 0,
      duration: 250,
      onComplete: () => g.destroy()
    });
    const t = this.add.text(x, y - 20, '!', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(51);
    this.tweens.add({
      targets: t,
      y: y - 60, alpha: 0,
      duration: 600,
      onComplete: () => t.destroy()
    });
  }

  // ── Player input ───────────────────────────────────────────────────────────

  private handlePlayerInput(): void {
    if (this.phase !== 'fighting') return;
    const inp = this.inputSys.getBattleInput();

    if (inp.slot1) this.player.selectSlot(0);
    if (inp.slot2) this.player.selectSlot(1);
    if (inp.slot3) this.player.selectSlot(2);
    if (inp.slot4) this.player.selectSlot(3);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const spd = this.player.minariData.stats.speed * 2.2 * this.player.formSystem.speedMult;

    if (this.player.state === 'guard') {
      // Guard locks horizontal position; facing is preserved from last movement
      body.setVelocityX(0);
    } else if (inp.left) {
      this.player.facing = -1;
      body.setVelocityX(-spd);
    } else if (inp.right) {
      this.player.facing = 1;
      body.setVelocityX(spd);
    } else {
      body.setVelocityX(0);
      // No auto-face: facing persists from last pressed direction
    }

    if (inp.up && this.player.isGrounded && this.player.state !== 'guard') {
      body.setVelocityY(-this.player.minariData.stats.jumpPower);
    }

    if (inp.down && this.player.state !== 'attacking' && this.player.isGrounded) {
      this.player.state = 'guard';
    } else if (this.player.state === 'guard' && !inp.down && !this.player.hasFlameGuard) {
      // Only release guard when neither the guard key nor Flame Guard is holding it
      this.player.state = 'idle';
    }

    if (inp.coreAttack) this.player.startCoreAttack();

    if (inp.special) {
      const sel = this.player.selectedSpecial;
      if (sel) {
        const ok = this.player.startSpecial(sel.id);
        if (ok && sel.id === 'flame_guard') {
          this.uiSys.showAnnounce('Flame Guard!', 1200);
        } else if (!ok) {
          if (this.player.stats.aura < sel.auraCost) {
            this.uiSys.showAnnounce('Not enough Aura!', 800);
          } else if (this.player.isInCooldown(sel.id)) {
            this.uiSys.showAnnounce('On cooldown!', 600);
          }
        }
      }
    }

    if (inp.dodge) this.player.startDodge();

    if (inp.ability) {
      if (this.player.activateForm()) {
        this.uiSys.showAnnounce(this.player.formSystem.displayText, 2000);
        this.cameras.main.shake(300, 0.005);
      } else {
        this.uiSys.showAnnounce('Ability not ready!', 800);
      }
    }

    if (inp.ultimate) this.triggerUltimate();
  }

  private triggerUltimate(): void {
    if (!this.player.isUltimateReady()) {
      this.uiSys.showAnnounce('Soulbond not full!', 800);
      return;
    }
    const ult = ULTIMATES[this.player.minariData.ultimateId];
    if (!ult) return;
    if (!this.player.useUltimate()) return;

    this.phase = 'ultimate_pause';
    this.ultimateTimer = ult.pauseDuration;

    this.flashGfx.fillStyle(0xffffff, 0.9);
    this.flashGfx.fillRect(0, 0, this.scale.width, this.scale.height);
    this.tweens.add({
      targets: this.flashGfx,
      alpha: 0,
      duration: 600,
      onComplete: () => { this.flashGfx.clear(); this.flashGfx.setAlpha(1); }
    });

    this.uiSys.showAnnounceImmediate(ult.displayText);

    if (Math.abs(this.player.x - this.enemy.x) <= ult.range) {
      this.enemy.takeDamage(ult.damage);
    }

    this.cameras.main.shake(500, 0.01);
  }

  // ── Enemy AI ───────────────────────────────────────────────────────────────

  private updateAI(delta: number): void {
    if (this.phase !== 'fighting') return;
    this.aiTimer -= delta;
    if (this.aiTimer > 0) return;

    const dist = Math.abs(this.enemy.x - this.player.x);
    const body = this.enemy.body as Phaser.Physics.Arcade.Body;
    const { stats } = this.enemy;

    this.enemy.facing = this.enemy.x > this.player.x ? -1 : 1;

    const roll = Math.random();

    if (this.player.state === 'attacking' && roll < 0.35) {
      if (roll < 0.18) {
        this.enemy.state = 'guard';
        this.aiTimer = 400;
      } else {
        this.enemy.startDodge();
        this.aiTimer = 600;
      }
      return;
    }

    if (dist > 280) {
      if (!this.enemy.isInCooldown('aqua_splash') && stats.aura >= 20 && roll < 0.5) {
        this.enemy.startSpecial('aqua_splash');
        this.aiTimer = 900;
        return;
      }
      if (!this.enemy.isInCooldown('bubble_dance') && stats.aura >= 35 && roll < 0.25) {
        this.enemy.startSpecial('bubble_dance');
        this.aiTimer = 1200;
        return;
      }
      body.setVelocityX(this.enemy.facing * this.enemy.minariData.stats.speed * 1.8);
      this.aiTimer = 300;
    } else if (dist > 100) {
      if (!this.enemy.isInCooldown('frost_pounce') && stats.aura >= 30 && roll < 0.3) {
        this.enemy.startSpecial('frost_pounce');
        body.setVelocityX(this.enemy.facing * 400);
        this.aiTimer = 700;
        return;
      }
      body.setVelocityX(this.enemy.facing * this.enemy.minariData.stats.speed * 1.6);
      this.aiTimer = 200;
    } else {
      body.setVelocityX(0);
      if (roll < 0.6) {
        this.enemy.startCoreAttack();
        this.aiTimer = 500;
      } else if (!this.enemy.isInCooldown('frost_pounce') && stats.aura >= 30 && roll < 0.75) {
        this.enemy.startSpecial('frost_pounce');
        this.aiTimer = 800;
      } else {
        if (this.enemy.isGrounded) body.setVelocityY(-this.enemy.minariData.stats.jumpPower);
        this.aiTimer = 400;
      }
    }
  }

  // ── Melee hit detection ────────────────────────────────────────────────────

  private checkMeleeHits(): void {
    // Player attacks enemy
    const playerHit = this.player.getCurrentAttackHit();
    if (playerHit) {
      const hx = this.player.x + this.player.facing * playerHit.hitbox.offsetX;
      const hy = this.player.y + playerHit.hitbox.offsetY;
      if (this.rectsOverlap(hx, hy, playerHit.hitbox.width, playerHit.hitbox.height,
          this.enemy.x, this.enemy.y, this.enemy.minariData.bodyWidth, this.enemy.minariData.bodyHeight)) {
        const dmg = playerHit.damage * this.player.formSystem.damageMult;
        this.enemy.takeDamage(dmg);
        this.player.markHitDealt();
        this.spawnHitFX(this.enemy.x, this.enemy.y - 20, 0xff6600);
        this.player.stats.soulbond = Math.min(100, this.player.stats.soulbond + 4);
      }
    }

    // Enemy attacks player — Flame Guard returns burn damage
    const enemyHit = this.enemy.getCurrentAttackHit();
    if (enemyHit) {
      const hx = this.enemy.x + this.enemy.facing * enemyHit.hitbox.offsetX;
      const hy = this.enemy.y + enemyHit.hitbox.offsetY;
      if (this.rectsOverlap(hx, hy, enemyHit.hitbox.width, enemyHit.hitbox.height,
          this.player.x, this.player.y, this.player.minariData.bodyWidth, this.player.minariData.bodyHeight)) {
        const burnBack = this.player.takeDamage(enemyHit.damage);
        this.enemy.markHitDealt();
        this.spawnHitFX(this.player.x, this.player.y - 20, 0x00aaff);

        // Flame Guard: enemy takes burn damage back
        if (burnBack > 0) {
          this.enemy.takeDamage(burnBack, true);
          this.spawnHitFX(this.enemy.x, this.enemy.y - 30, 0xff8800);
        }
      }
    }
  }

  private rectsOverlap(ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number): boolean {
    return (
      ax - aw / 2 < bx + bw / 2 && ax + aw / 2 > bx - bw / 2 &&
      ay - ah / 2 < by + bh / 2 && ay + ah / 2 > by - bh / 2
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────

  private checkResult(): void {
    if (this.resultShown) return;
    if (!this.player.isDead() && !this.enemy.isDead()) return;

    this.phase = 'result';
    this.resultShown = true;
    const won = this.enemy.isDead();

    this.time.delayedCall(800, () => {
      const w = this.scale.width;
      const h = this.scale.height;

      const bg = this.add.graphics().setDepth(400);
      bg.fillStyle(0x000000, 0.7);
      bg.fillRect(0, 0, w, h);

      this.add.text(w / 2, h / 2 - 40, won ? 'VICTORY!' : 'DEFEAT...', {
        fontSize: '64px',
        color: won ? '#44ff88' : '#ff4444',
        fontStyle: 'bold', fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(401);

      this.add.text(w / 2, h / 2 + 40, 'Press ENTER to return', {
        fontSize: '18px', color: '#aaaaaa', fontFamily: 'monospace'
      }).setOrigin(0.5).setDepth(401);

      if (won) this.cameras.main.shake(600, 0.008);
    });
  }

  update(_time: number, delta: number): void {
    // Tick down the enter-key lock so a held Enter from overworld can't skip result
    if (this.enterLockTimer > 0) this.enterLockTimer -= delta;

    this.projectiles.getChildren().forEach(obj => {
      const p = obj as Projectile;
      if (p.active) p.update(delta);
    });

    if (this.phase === 'ultimate_pause') {
      this.ultimateTimer -= delta;
      if (this.ultimateTimer <= 0) {
        this.phase = 'fighting';
        this.uiSys.hideAnnounce();
      }
      this.uiSys.update(
        this.player.stats, this.enemy.stats,
        this.player.selectedSlotIndex, this.player.specials,
        this.player.isFormReady(), this.player.isUltimateReady(),
        this.player.formSystem.isActive, this.player.formSystem.timeRemaining
      );
      return;
    }

    if (this.phase === 'result') {
      if (this.enterLockTimer <= 0 && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
        this.cameras.main.fade(400, 0, 0, 0, false, (_cam: unknown, progress: number) => {
          if (progress === 1) this.scene.start('OverworldScene');
        });
      }
      return;
    }

    this.handlePlayerInput();
    this.updateAI(delta);
    this.checkMeleeHits();
    this.player.update(delta);
    this.enemy.update(delta);
    this.checkResult();

    // Keep fighters within arena bounds
    const w = this.scale.width;
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const eb = this.enemy.body as Phaser.Physics.Arcade.Body;
    if (this.player.x < 50) pb.setVelocityX(80);
    if (this.player.x > w - 50) pb.setVelocityX(-80);
    if (this.enemy.x < 50) eb.setVelocityX(80);
    if (this.enemy.x > w - 50) eb.setVelocityX(-80);

    this.uiSys.update(
      this.player.stats, this.enemy.stats,
      this.player.selectedSlotIndex, this.player.specials,
      this.player.isFormReady(), this.player.isUltimateReady(),
      this.player.formSystem.isActive, this.player.formSystem.timeRemaining
    );

    // ── Debug overlay ──
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.debugMode = !this.debugMode;
      this.debugBg.setVisible(this.debugMode);
      this.debugText.setVisible(this.debugMode);
    }
    if (this.debugMode) {
      const animMode = this.registry.get('flarepaw_anim_mode') ?? 'unknown';
      const lines = [
        `[MONARIUM DEBUG]  press D to hide`,
        `sprite mode: ${animMode}`,
        `── Flarepaw (player) ──────────────────────────`,
        this.player.debugInfo(),
        `── Droplet (AI) ───────────────────────────────`,
        this.enemy.debugInfo(),
        `── Scene ──────────────────────────────────────`,
        `phase:${this.phase}  fps:${Math.round(this.game.loop.actualFps)}  t:${Math.round(this.time.now / 1000)}s`,
      ];
      this.debugText.setText(lines.join('\n'));
      this.debugBg.setSize(this.debugText.width + 16, this.debugText.height + 12);
    }
  }

  shutdown(): void {
    this.inputSys?.destroy();
    this.uiSys?.destroy();
  }
}
