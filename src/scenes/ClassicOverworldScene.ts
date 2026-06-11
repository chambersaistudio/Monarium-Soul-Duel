import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';
import { VirtualDpad } from '../systems/VirtualDpad';
import { AudioManager } from '../systems/AudioManager';
import { OverworldMaskSystem } from '../systems/OverworldMaskSystem';
import { AUDIO_KEYS } from '../config/audioConfig';
import { UI_THEME, elementColor, elementLabel, rarityLabel } from '../config/uiTheme';
import { getMonariVisualPaths, getCharacterVisualPaths, visualCandidates } from '../config/assetManifest';
import { preloadVisualCandidates, bestLoadedVisualKey, drawGlassPanel } from '../ui/phaserUi';
import { IS_TOUCH_DEVICE, SAFE_AREA_BOTTOM } from '../config/mobileConfig';
import { getRenderDiagnostics } from '../config/highDpi';
import { OVERWORLD_MAPS } from '../data/overworldMaps';
import { CHALLENGERS } from '../data/challengerData';
import { PLAYER_PROFILE, renzoCounterPick } from '../data/playerProfile';
import { MINARI_ROSTER } from '../data/minariData';
import type { MapDef, NpcDef, MapExit, EncounterOrb, ClassicBattleContext } from '../types/overworld';

// Player visual dimensions at reference viewport width (960 px)
const PLAYER_W_REF = 28;
const PLAYER_H_REF = 44;

export class ClassicOverworldScene extends Phaser.Scene {
  private inputSys!:  InputSystem;
  private dpad:       VirtualDpad | null = null;
  private audio!:     AudioManager;
  private maskSys:    OverworldMaskSystem | null = null;

  private mapDef!:    MapDef;
  private mapId!:     string;

  // Player state
  private playerX    = 0;
  private playerY    = 0;
  private prevX      = 0;
  private prevY      = 0;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private nameLabel!: Phaser.GameObjects.Text;

  // Scaled dimensions (set in create)
  private playerW    = PLAYER_W_REF;
  private playerH    = PLAYER_H_REF;
  private walkSpeed: number = PLAYER_PROFILE.walkSpeed;
  private scl        = 1;
  private playerImg: Phaser.GameObjects.Image | null = null;
  private bgImg: Phaser.GameObjects.Image | null = null;

  // Interact prompt — can target an NPC or a requiresInteract exit
  private interactPrompt!: Phaser.GameObjects.Text;
  private promptTarget:    NpcDef | null = null;
  private promptExit:      MapExit | null = null;

  // Dialogue overlay
  private dialogActive    = false;
  private dialogLines:    string[] = [];
  private dialogIndex     = 0;
  private dialogPanel:    Phaser.GameObjects.GameObject[] = [];
  private dialogBodyText!: Phaser.GameObjects.Text;
  private dialogNameText!: Phaser.GameObjects.Text;
  private dialogOnEnd:    (() => void) | null = null;

  // Starter confirm overlay
  private starterPanelActive = false;
  private startMenuActive = false;
  private startMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private menuBtnText: Phaser.GameObjects.Text | null = null;

  // Cooldown: prevents the same input that closes dialogue from instantly re-opening it
  private interactLockUntil = 0;

  // Debug overlay
  private debugMode    = false;
  private debugOverlay: Phaser.GameObjects.Graphics | null = null;
  private debugLabels: Phaser.GameObjects.Text[] = [];
  private viewportW = 0;
  private viewportH = 0;
  private resizeRestartEvent: Phaser.Time.TimerEvent | null = null;

  constructor() { super({ key: 'ClassicOverworldScene' }); }

  preload(): void {
    ['flarepaw', 'droplet', 'sproutodon', 'umbravine', 'umbrelette', 'uvee'].forEach(id => {
      preloadVisualCandidates(this, 'monari', id, visualCandidates(getMonariVisualPaths(id)));
    });
    ['player', 'renzo', 'warren_ellis', 'amari', 'erix'].forEach(id => {
      preloadVisualCandidates(this, 'character', id, visualCandidates(getCharacterVisualPaths(id)));
    });
    // Overworld fullbody sprites (separate from portrait assets)
    ['player', 'renzo', 'amari', 'erix'].forEach(id => {
      this.load.image(`ow_char_${id}`, `assets/characters/${id}/overworld/fullbody.png`);
    });
    ['flarepaw', 'sproutodon'].forEach(id => {
      this.load.image(`ow_monari_${id}`, `assets/monari/${id}/overworld/fullbody.png`);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    const { width: w, height: h } = this.scale;
    this.viewportW = w;
    this.viewportH = h;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);

    // Reset flags that persist across scene restarts (Phaser reuses scene instances)
    this.dialogActive       = false;
    this.starterPanelActive = false;
    this.startMenuActive    = false;
    this.dialogPanel        = [];
    this.dialogOnEnd        = null;
    this.promptTarget       = null;
    this.promptExit         = null;
    this.startMenuObjects   = [];
    this.menuBtnText        = null;

    this.mapId  = (this.registry.get('classic_current_map') as string) ?? 'starter_village';
    this.mapDef = OVERWORLD_MAPS[this.mapId] ?? OVERWORLD_MAPS['starter_village'];

    this.scl     = IS_TOUCH_DEVICE
      ? Phaser.Math.Clamp(Math.min(w / 520, h / 360), 0.72, 1.05)
      : w / 960;
    this.playerW = Math.round(PLAYER_W_REF * this.scl);
    this.playerH = Math.round(PLAYER_H_REF * this.scl);
    this.walkSpeed = PLAYER_PROFILE.walkSpeed * this.scl;

    this.drawBackground(w, h);
    this.buildNpcs(w, h);
    this.buildOrbs(w, h);

    // Load logic mask if available
    if (this.mapDef.maskKey && this.textures.exists(this.mapDef.maskKey)) {
      this.maskSys = new OverworldMaskSystem();
      if (!this.maskSys.load(this, this.mapDef.maskKey)) this.maskSys = null;
    }

    const resizePos = this.registry.get('classic_resize_norm_pos') as { mapId?: string; x?: number; y?: number } | null;
    if (resizePos?.mapId === this.mapId && typeof resizePos.x === 'number' && typeof resizePos.y === 'number') {
      this.playerX = Phaser.Math.Clamp(resizePos.x, 0, 1) * w;
      this.playerY = Phaser.Math.Clamp(resizePos.y, 0, 1) * h;
      this.registry.remove('classic_resize_norm_pos');
    } else {
      const spawnName = (this.registry.get('classic_spawn_name') as string) ?? this.mapDef.defaultSpawn;
      const spawn     = this.mapDef.spawns[spawnName] ?? this.mapDef.spawns[this.mapDef.defaultSpawn];
      this.playerX    = spawn.x * w;
      this.playerY    = spawn.y * h;
    }
    this.prevX      = this.playerX;
    this.prevY      = this.playerY;

    // Brief interact lock after returning from battle so Renzo dialogue
    // doesn't immediately retrigger (the Enter press that closed the
    // victory screen should not be treated as an interact in the overworld).
    if (((this.registry.get('classic_spawn_name') as string) ?? this.mapDef.defaultSpawn) === 'from_battle') {
      this.interactLockUntil = this.time.now + 600;
    }

    this.playerImg = null;
    const playerTexKey = this.textures.exists('ow_char_player') ? 'ow_char_player'
      : bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold);
    if (!playerTexKey.startsWith('generated_')) {
      this.playerImg = this.add.image(this.playerX, this.playerY - this.playerH / 2, playerTexKey)
        .setDisplaySize(this.playerW * 2, this.playerH * 2)
        .setDepth(20);
    }
    this.playerGfx = this.add.graphics().setDepth(20);
    if (this.playerImg) this.playerGfx.setVisible(false);
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

    this.buildOverworldHud(w);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.inputSys = new InputSystem(this);
    if (IS_TOUCH_DEVICE) {
      this.dpad = new VirtualDpad(this, this.inputSys);
    }

    const kb = this.input.keyboard!;

    // ESC / TAB / M → modern Start Menu overlay
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.openStartMenu());
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB).on('down', () => this.openStartMenu());
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => this.openStartMenu());

    // R → safety reset to Starter Village
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.R)
      .on('down', () => this.safetyReset());

    // D or ?debug=1 → debug overlay
    const debugParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('debug')
      : null;
    if (debugParam === '1') this.debugMode = true;

    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      .on('down', () => { this.debugMode = !this.debugMode; this.updateDebugOverlay(w, h); });

    if (this.debugMode) this.updateDebugOverlay(w, h);
    this.logRenderDiagnostics('create');

    // ── Audio ─────────────────────────────────────────────────────────────────
    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);
      this.resizeRestartEvent?.remove(false);
      this.resizeRestartEvent = null;
      this.inputSys?.destroy();
      this.dpad?.destroy();
    });

    this.cameras.main.fadeIn(400);
  }

  private readonly onScaleResize = (): void => {
    const w = Math.max(1, this.scale.width);
    const h = Math.max(1, this.scale.height);
    if (Math.abs(w - this.viewportW) < 2 && Math.abs(h - this.viewportH) < 2) return;

    const oldW = Math.max(1, this.viewportW || w);
    const oldH = Math.max(1, this.viewportH || h);
    this.registry.set('classic_resize_norm_pos', {
      mapId: this.mapId,
      x: Phaser.Math.Clamp(this.playerX / oldW, 0, 1),
      y: Phaser.Math.Clamp(this.playerY / oldH, 0, 1),
    });
    this.viewportW = w;
    this.viewportH = h;

    this.resizeRestartEvent?.remove(false);
    this.resizeRestartEvent = this.time.delayedCall(90, () => {
      if (this.scene.isActive()) this.scene.restart();
    });
  };

  update(_time: number, delta: number): void {
    if (this.dialogActive || this.starterPanelActive || this.startMenuActive) {
      this.drawPlayer();
      this.updateNameLabel();
      return;
    }

    const dt = delta / 1000;
    const mv = this.inputSys.getOverworldVector();
    const { width: w, height: h } = this.scale;

    const dx  = mv.x;
    const dy  = mv.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    this.prevX = this.playerX;
    this.prevY = this.playerY;

    if (dx !== 0 || dy !== 0) {
      this.playerX += (dx / len) * this.walkSpeed * dt;
      this.playerY += (dy / len) * this.walkSpeed * dt;
    }

    // Check exits BEFORE collision so the player isn't pushed away from them
    if (this.checkExits(w, h)) return;

    this.resolveCollisions(w, h);
    this.checkOrbContact(w, h);
    this.drawPlayer();
    this.updateNameLabel();
    this.updateInteractPrompt(w, h);

    if (this.time.now >= this.interactLockUntil &&
        (this.inputSys.isJustDown('enter') || this.inputSys.isJustDown('e'))) {
      if (this.promptTarget) {
        this.triggerInteract(this.promptTarget);
      } else if (this.promptExit) {
        this.travelToMap(this.promptExit.targetMap, this.promptExit.targetSpawn);
      }
    }
  }

  // ── Background ───────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    if (this.textures.exists(this.mapDef.bgKey)) {
      const frame = this.textures.getFrame(this.mapDef.bgKey);
      const scale = Math.max(w / frame.realWidth, h / frame.realHeight);
      this.bgImg = this.add.image(w / 2, h / 2, this.mapDef.bgKey)
        .setDepth(0)
        .setScale(scale);
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
      let imgKey: string | null = null;

      if (npc.role?.startsWith('starter_pedestal_')) {
        const monariId = npc.id.replace('pedestal_', '');
        const owKey = `ow_monari_${monariId}`;
        if (this.textures.exists(owKey)) {
          imgKey = owKey;
        } else {
          const fallback = bestLoadedVisualKey(this, 'monari', monariId, npc.color);
          if (!fallback.startsWith('generated_')) imgKey = fallback;
        }
      } else {
        const owKey = `ow_char_${npc.id}`;
        if (this.textures.exists(owKey)) {
          imgKey = owKey;
        } else {
          const fallback = bestLoadedVisualKey(this, 'character', npc.id, npc.color);
          if (!fallback.startsWith('generated_')) imgKey = fallback;
        }
      }

      if (imgKey) {
        const npcH = Math.round(44 * this.scl);
        const npcW = Math.round(28 * this.scl);
        this.add.image(nx, ny - npcH / 2, imgKey)
          .setDisplaySize(npcW * 2, npcH * 2)
          .setDepth(12);
      } else {
        const g = this.add.graphics().setDepth(12);
        g.fillStyle(npc.color, 0.9);
        g.fillCircle(nx, ny, 16);
        g.lineStyle(2, 0xffffff, 0.4);
        g.strokeCircle(nx, ny, 16);
      }

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
    if (this.playerImg) {
      this.playerImg.setPosition(this.playerX, this.playerY - this.playerH / 2);
      return;
    }
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
    if (this.maskSys?.isLoaded) {
      // Mask-based collision with wall sliding
      const nw = (this.playerW * 0.4) / w;
      const nh = (this.playerH * 0.5) / h;
      const nx = this.playerX / w;
      const ny = this.playerY / h;

      if (this.maskSys.isBodyBlocked(nx, ny, nw, nh)) {
        const prevNx = this.prevX / w;
        const prevNy = this.prevY / h;

        if (!this.maskSys.isBodyBlocked(prevNx, ny, nw, nh)) {
          this.playerX = this.prevX;      // slide along Y axis
        } else if (!this.maskSys.isBodyBlocked(nx, prevNy, nw, nh)) {
          this.playerY = this.prevY;      // slide along X axis
        } else {
          this.playerX = this.prevX;
          this.playerY = this.prevY;
        }
      }
    } else {
      // Fallback: AABB vs collisionRects
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

    // Screen clamp — player center stays within viewport
    const { width: sw, height: sh } = this.scale;
    this.playerX = Phaser.Math.Clamp(this.playerX, this.playerW / 2, sw - this.playerW / 2);
    this.playerY = Phaser.Math.Clamp(this.playerY, this.playerH / 2, sh - this.playerH / 2);
  }

  // ── Exits ─────────────────────────────────────────────────────────────────────

  /** Returns true if a travel was triggered (caller should bail out of update). */
  private checkExits(w: number, h: number): boolean {
    for (const exit of this.mapDef.exits) {
      if (exit.requiresInteract) continue;
      const ex = exit.rect.x * w, ey = exit.rect.y * h;
      const ew = exit.rect.w * w, eh = exit.rect.h * h;
      if (this.playerX >= ex && this.playerX <= ex + ew &&
          this.playerY >= ey && this.playerY <= ey + eh) {
        this.travelToMap(exit.targetMap, exit.targetSpawn);
        return true;
      }
    }
    return false;
  }

  // ── Encounter orb contact ─────────────────────────────────────────────────────

  private checkOrbContact(w: number, h: number): void {
    const starter = this.registry.get('classic_player_starter') as string | null;
    if (!starter) return;  // no starter yet — can't battle

    for (const orb of this.mapDef.encounterOrbs) {
      const dist = Phaser.Math.Distance.Between(
        this.playerX, this.playerY, orb.x * w, orb.y * h,
      );
      if (dist < 24) { this.triggerWildBattle(orb); return; }
    }
  }

  // ── Interact prompt ───────────────────────────────────────────────────────────

  private updateInteractPrompt(w: number, h: number): void {
    let nearestNpc:  NpcDef | null  = null;
    let nearestExit: MapExit | null = null;
    let nearDist = Infinity;

    // Check NPCs
    for (const npc of this.mapDef.npcs) {
      const dist = Phaser.Math.Distance.Between(
        this.playerX, this.playerY, npc.x * w, npc.y * h,
      );
      const threshold = npc.interactRadius * Math.min(w, h);
      if (dist < threshold && dist < nearDist) {
        nearestNpc  = npc;
        nearestExit = null;
        nearDist = dist;
      }
    }

    // Check requiresInteract exits
    for (const exit of this.mapDef.exits) {
      if (!exit.requiresInteract) continue;
      const ex = exit.rect.x * w, ey = exit.rect.y * h;
      const ew = exit.rect.w * w, eh = exit.rect.h * h;
      const cx = ex + ew / 2, cy = ey + eh / 2;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, cx, cy);
      const threshold = Math.max(ew, eh) * 0.7;
      if (dist < threshold && dist < nearDist) {
        nearestExit = exit;
        nearestNpc  = null;
        nearDist = dist;
      }
    }

    if (nearestNpc || nearestExit) {
      this.promptTarget = nearestNpc;
      this.promptExit   = nearestExit;
      const label = IS_TOUCH_DEVICE ? '[A] ' : '[ENTER] ';
      const name  = nearestNpc ? nearestNpc.displayName : `→ ${nearestExit!.targetMap.replace(/_/g, ' ')}`;
      this.interactPrompt.setText(label + name)
        .setPosition(this.playerX, this.playerY - this.playerH - 18)
        .setVisible(true);
    } else {
      this.promptTarget = null;
      this.promptExit   = null;
      this.interactPrompt.setVisible(false);
    }
  }

  // ── NPC interaction ───────────────────────────────────────────────────────────


  // ── Modern HUD / Start Menu ────────────────────────────────────────────────

  private buildOverworldHud(w: number): void {
    const { height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;
    const starterId = (this.registry.get('classic_player_starter') as string | null) ?? 'No starter';
    const starterName = starterId === 'No starter' ? 'Choose a starter' : (MINARI_ROSTER[starterId]?.name ?? starterId);
    const playerKey = bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold);

    if (mob) {
      const top = 8;
      const avatarSize = 32;
      const menuW = 68;
      const profileW = Math.min(210, Math.max(154, w - menuW - 34));
      const g = this.add.graphics().setDepth(50);
      drawGlassPanel(g, 10, top, profileW, 46, { radius: 15, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.72 });
      this.add.image(30, top + 23, playerKey).setDisplaySize(avatarSize, avatarSize).setDepth(51);
      this.add.text(52, top + 14, this.getPlayerName(), { fontSize: '12px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(51);
      this.add.text(52, top + 31, starterName, { fontSize: '9px', color: '#ffdf91', fontFamily: UI_THEME.fonts.family }).setDepth(51);

      const menuX = w - menuW - 10;
      const menu = this.add.graphics().setDepth(50);
      drawGlassPanel(menu, menuX, top, menuW, 34, { radius: 14, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.72 });
      menu.setInteractive(new Phaser.Geom.Rectangle(menuX, top, menuW, 34), Phaser.Geom.Rectangle.Contains);
      menu.on('pointerdown', () => this.startMenuActive ? this.closeStartMenu() : this.openStartMenu());
      this.menuBtnText = this.add.text(menuX + menuW / 2, top + 17, 'MENU', { fontSize: '11px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(51);

      const locW = Math.min(220, w - 28);
      const loc = this.add.graphics().setDepth(50);
      drawGlassPanel(loc, (w - locW) / 2, h - SAFE_AREA_BOTTOM - 42, locW, 30, { radius: 14, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.purple, glow: UI_THEME.colors.purple, alpha: 0.58 });
      this.add.text(w / 2, h - SAFE_AREA_BOTTOM - 27, this.mapDef.displayName, { fontSize: '12px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(51);
      return;
    }

    const g = this.add.graphics().setDepth(50);
    drawGlassPanel(g, 12, 10, 236, 56, { radius: 16, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.72 });
    this.add.image(39, 38, playerKey).setDisplaySize(38, 38).setDepth(51);
    this.add.text(66, 19, this.getPlayerName(), { fontSize: '13px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(51);
    this.add.text(66, 38, `Soul Rank 1  •  ${starterName}`, { fontSize: '10px', color: '#ffdf91', fontFamily: UI_THEME.fonts.family }).setDepth(51);

    const loc = this.add.graphics().setDepth(50);
    drawGlassPanel(loc, w / 2 - 112, 12, 224, 34, { radius: 14, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.purple, glow: UI_THEME.colors.purple, alpha: 0.66 });
    this.add.text(w / 2, 29, this.mapDef.displayName, { fontSize: '12px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(51);

    const menu = this.add.graphics().setDepth(50);
    drawGlassPanel(menu, w - 82, 12, 70, 34, { radius: 14, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.68 });
    menu.setInteractive(new Phaser.Geom.Rectangle(w - 82, 12, 70, 34), Phaser.Geom.Rectangle.Contains);
    menu.on('pointerdown', () => this.openStartMenu());
    this.menuBtnText = this.add.text(w - 47, 29, 'MENU', { fontSize: '11px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(51);
  }

  public openStartMenu(): void {
    if (this.dialogActive || this.starterPanelActive || this.startMenuActive) return;
    this.startMenuActive = true;
    this.dpad?.setVisible(false);
    this.menuBtnText?.setText('CLOSE');
    this.showStartRoot();
  }

  private clearStartMenu(): void {
    this.startMenuObjects.forEach(o => o.destroy());
    this.startMenuObjects = [];
  }

  private closeStartMenu(): void {
    this.clearStartMenu();
    this.startMenuActive = false;
    this.dpad?.setVisible(IS_TOUCH_DEVICE);
    this.menuBtnText?.setText('MENU');
    this.interactLockUntil = this.time.now + 250;
  }

  private startObj<T extends Phaser.GameObjects.GameObject>(o: T): T { this.startMenuObjects.push(o); return o; }

  private showStartRoot(): void {
    this.clearStartMenu();
    const { width: w, height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;

    this.startObj(this.add.rectangle(w / 2, h / 2, w, h, 0x02020a, 0.58).setDepth(110));

    // Mobile: centred panel fitted to viewport; Desktop: right-aligned panel
    const panW = mob ? Math.min(300, w - 28) : 260;
    const panY = mob ? 16 : 56;
    const panH = mob ? Math.max(244, h - panY - SAFE_AREA_BOTTOM - 14) : h - 112;
    const panX = mob ? (w - panW) / 2 : w - panW - 32;

    const panel = this.startObj(this.add.graphics().setDepth(111));
    drawGlassPanel(panel, panX, panY, panW, panH, { radius: 22, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.purple, alpha: 0.9 });

    const titleFontSize = mob ? '17px' : '20px';
    const titleH = mob ? 40 : 66;
    this.startObj(this.add.text(panX + panW / 2, panY + (mob ? 20 : 24), 'Bonder Menu', {
      fontSize: titleFontSize, color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(112));

    const opts = ['Monari', 'Bag', 'Codex', 'Player', 'Settings', 'Save', 'Mode Select', 'Back / Close'];
    const n = opts.length;
    const bottomPad = mob ? 8 : 10;
    const availH = panH - titleH - bottomPad;
    const itemGap = mob ? 3 : 4;
    const itemH = Math.max(mob ? 23 : 30, Math.min(mob ? 34 : 40, Math.floor((availH - (n - 1) * itemGap) / n)));
    const itemW = panW - (mob ? 24 : 32);
    const itemX = panX + (mob ? 12 : 16);
    const firstY = panY + titleH;

    opts.forEach((label, i) => {
      const y = firstY + i * (itemH + itemGap);
      const bg = this.startObj(this.add.graphics().setDepth(112));
      drawGlassPanel(bg, itemX, y, itemW, itemH, {
        radius: 11,
        fill:   i === 0 ? 0x241936 : UI_THEME.colors.glass,
        stroke: i === 0 ? UI_THEME.colors.gold : UI_THEME.colors.strokeDim,
        glow:   i === 0 ? UI_THEME.colors.gold : UI_THEME.colors.purple,
        alpha:  0.74,
      });
      bg.setInteractive(new Phaser.Geom.Rectangle(itemX, y, itemW, itemH), Phaser.Geom.Rectangle.Contains);
      bg.on('pointerdown', () => {
        if (label === 'Back / Close') this.closeStartMenu();
        else if (label === 'Mode Select') { this.closeStartMenu(); this.returnToModeSelect(); }
        else if (label === 'Monari') this.showTeamScreen();
        else this.showMenuPlaceholder(label);
      });
      this.startObj(this.add.text(panX + panW / 2, y + itemH / 2, label, {
        fontSize: mob ? '12px' : '14px',
        color: label === 'Monari' ? '#fff4c8' : '#d8d3ff',
        fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(113));
    });
  }

  private showMenuPlaceholder(label: string): void {
    this.showStartRoot();
    const { width: w, height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;
    const panW = mob ? Math.min(w - 32, 310) : 390;
    const panX = mob ? (w - panW) / 2 : 54;
    const panY = mob ? Math.max(72, h / 2 - 50) : h / 2 - 54;
    const g = this.startObj(this.add.graphics().setDepth(114));
    drawGlassPanel(g, panX, panY, panW, 100, { radius: 20, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.purple, glow: UI_THEME.colors.purple, alpha: 0.88 });
    this.startObj(this.add.text(panX + panW / 2, panY + 34, `${label} coming soon`, { fontSize: mob ? '15px' : '18px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(115));
    this.startObj(this.add.text(panX + panW / 2, panY + 64, 'Prototype panel reserved for a future UI pass.', { fontSize: mob ? '10px' : '12px', color: '#b8b2dc', fontFamily: UI_THEME.fonts.family }).setOrigin(0.5).setDepth(115));
  }

  private getTeamIds(): string[] {
    const starter = this.registry.get('classic_player_starter') as string | null;
    const party = (this.registry.get('classic_party') as string[] | null) ?? [];
    return [...new Set([starter, ...party].filter(Boolean) as string[])].slice(0, 4);
  }

  private showTeamScreen(): void {
    this.clearStartMenu();
    const { width: w, height: h } = this.scale;
    const mob = IS_TOUCH_DEVICE;
    this.startObj(this.add.rectangle(w / 2, h / 2, w, h, 0x02020a, 0.62).setDepth(110));
    const bg = this.startObj(this.add.graphics().setDepth(111));
    const pad = mob ? 14 : 36;
    drawGlassPanel(bg, pad, pad, w - pad * 2, h - pad * 2 - (mob ? SAFE_AREA_BOTTOM : 0), { radius: mob ? 20 : 24, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.purple, alpha: 0.9 });
    this.startObj(this.add.text(pad + 18, pad + 22, 'Monari Team', { fontSize: mob ? '18px' : '23px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
    this.makeStartButton(w - pad - 86, pad + 16, 72, 30, 'Back', () => this.showStartRoot());
    if (!mob) this.makeStartButton(w - 252, 54, 92, 32, 'Close', () => this.closeStartMenu());
    const team = this.getTeamIds();
    const ids = team.length ? team : ['flarepaw'];
    if (mob) {
      const cardW = w - pad * 2 - 24;
      const cardH = Math.min(102, Math.max(86, (h - pad * 2 - SAFE_AREA_BOTTOM - 72) / Math.max(1, ids.length)));
      ids.forEach((id, i) => this.drawTeamCard(id, pad + 12, pad + 60 + i * (cardH + 8), cardW, cardH));
    } else {
      ids.forEach((id, i) => this.drawTeamCard(id, 64 + (i % 2) * ((w - 160) / 2), 108 + Math.floor(i / 2) * 126, (w - 190) / 2));
    }
  }

  private drawTeamCard(id: string, x: number, y: number, cw: number, ch = 104): void {
    const data = MINARI_ROSTER[id] ?? MINARI_ROSTER.flarepaw;
    const color = elementColor(data.element);
    const mob = IS_TOUCH_DEVICE;
    const g = this.startObj(this.add.graphics().setDepth(112));
    drawGlassPanel(g, x, y, cw, ch, { radius: 18, fill: UI_THEME.colors.glass, stroke: color, glow: color, alpha: 0.76 });
    g.setInteractive(new Phaser.Geom.Rectangle(x, y, cw, ch), Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', () => this.showMonariDetail(id));
    const key = bestLoadedVisualKey(this, 'monari', id, color);
    const imgSize = mob ? Math.min(62, ch - 20) : 70;
    this.startObj(this.add.image(x + imgSize / 2 + 12, y + ch / 2, key).setDisplaySize(imgSize, imgSize).setDepth(113));
    const textX = x + imgSize + 28;
    this.startObj(this.add.text(textX, y + 14, `${data.name}  Lv. 7`, { fontSize: mob ? '14px' : '15px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(113));
    this.startObj(this.add.text(textX, y + 34, `${elementLabel(data.element)} • ${rarityLabel(data.rarity)} • Bond Lv. 1`, { fontSize: mob ? '9px' : '10px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family }).setDepth(113));
    const meters = [['HP', data.stats.maxHp, data.stats.maxHp, UI_THEME.bars.hp], ['Aura', data.stats.maxAura, data.stats.maxAura, UI_THEME.bars.aura], ['Soul Sync', 70, 100, UI_THEME.bars.soulSync]] as const;
    const barX = textX + (mob ? 56 : 56);
    const barW = Math.max(48, cw - (barX - x) - 14);
    meters.forEach((m, idx) => {
      const yy = y + 54 + idx * (mob ? 12 : 14);
      this.startObj(this.add.text(textX, yy - 2, m[0], { fontSize: '8px', color: '#aaa6c8', fontFamily: UI_THEME.fonts.family }).setDepth(113));
      this.startObj(this.add.rectangle(barX, yy, barW, 7, UI_THEME.bars.track, 0.85).setOrigin(0, 0).setDepth(113));
      this.startObj(this.add.rectangle(barX, yy, barW * (m[1] / m[2]), 7, m[3], 0.95).setOrigin(0, 0).setDepth(114));
    });
  }

  private showMonariDetail(id: string): void {
    this.clearStartMenu();
    const { width: w, height: h } = this.scale;
    const data = MINARI_ROSTER[id] ?? MINARI_ROSTER.flarepaw;
    const color = elementColor(data.element);
    const mob = IS_TOUCH_DEVICE;
    this.startObj(this.add.rectangle(w / 2, h / 2, w, h, 0x02020a, 0.66).setDepth(110));
    const g = this.startObj(this.add.graphics().setDepth(111));
    const pad = mob ? 14 : 46;
    drawGlassPanel(g, pad, pad, w - pad * 2, h - pad * 2 - (mob ? SAFE_AREA_BOTTOM : 0), { radius: mob ? 20 : 26, fill: UI_THEME.colors.panelDeep, stroke: color, glow: color, alpha: 0.92 });
    const key = bestLoadedVisualKey(this, 'monari', id, color);

    if (mob) {
      const imageSize = Math.min(108, Math.max(82, w * 0.28));
      this.startObj(this.add.image(pad + 58, pad + 82, key).setDisplaySize(imageSize, imageSize).setDepth(112));
      const textX = pad + 116;
      this.startObj(this.add.text(textX, pad + 26, `${data.name}  Lv. 7`, { fontSize: '18px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
      this.startObj(this.add.text(textX, pad + 51, `${elementLabel(data.element)} • ${rarityLabel(data.rarity)}`, { fontSize: '11px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
      this.startObj(this.add.text(textX, pad + 70, this.starterRole(id), { fontSize: '10px', color: '#b8b2dc', fontFamily: UI_THEME.fonts.family }).setDepth(112));
      const metricY = pad + 124;
      const metricW = (w - pad * 2 - 28) / 4;
      [['HP', data.stats.maxHp], ['Aura', data.stats.maxAura], ['Sync', '70%'], ['Bond', 1]].forEach((m, i) => {
        const cx = pad + 14 + i * metricW;
        this.startObj(this.add.text(cx, metricY, `${m[0]}`, { fontSize: '9px', color: '#aaa6c8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
        this.startObj(this.add.text(cx, metricY + 14, `${m[1]}`, { fontSize: '13px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
      });
      this.drawDetailStats(id, pad + 16, metricY + 42, w - pad * 2 - 32, color, true);
      this.startObj(this.add.text(pad + 16, h - SAFE_AREA_BOTTOM - 72, 'Moves: basic technique, signature art, guard stance', { fontSize: '10px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
      this.startObj(this.add.text(pad + 16, h - SAFE_AREA_BOTTOM - 54, 'Ability / Evolution / Ascension: coming soon', { fontSize: '10px', color: '#b8b2dc', fontFamily: UI_THEME.fonts.family }).setDepth(112));
      this.makeStartButton(w - pad - 82, h - SAFE_AREA_BOTTOM - 42, 68, 28, 'Back', () => this.showTeamScreen());
      return;
    }

    this.startObj(this.add.image(168, h / 2, key).setDisplaySize(190, 190).setDepth(112));
    this.startObj(this.add.text(292, 62, `${data.name}  Lv. 7`, { fontSize: '25px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
    this.startObj(this.add.text(292, 96, `${elementLabel(data.element)} • ${rarityLabel(data.rarity)} • ${this.starterRole(id)}`, { fontSize: '13px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
    this.startObj(this.add.text(292, 126, 'HP     Aura     Soul Sync     Bond Level', { fontSize: '11px', color: '#aaa6c8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
    this.startObj(this.add.text(292, 144, `${data.stats.maxHp}     ${data.stats.maxAura}       70%           1`, { fontSize: '16px', color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
    const statsEndY = this.drawDetailStats(id, 292, 188, Math.min(430, w - 330), color, false);
    const movesY = Math.max(statsEndY + 8, h - 124);
    const abilityY = movesY + 22;
    this.startObj(this.add.text(292, movesY,  'Moves: basic technique, signature art, guard stance', { fontSize: '12px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
    this.startObj(this.add.text(292, abilityY, 'Ability: Prototype slot  •  Evolution/Ascension: coming soon', { fontSize: '12px', color: '#b8b2dc', fontFamily: UI_THEME.fonts.family }).setDepth(112));
    this.makeStartButton(w - 158, h - 76, 96, 34, 'Back', () => this.showTeamScreen());
  }

  private drawDetailStats(id: string, x: number, y: number, width: number, color: number, mobile: boolean): number {
    const data = MINARI_ROSTER[id] ?? MINARI_ROSTER.flarepaw;
    const stats = [
      ['HP', data.stats.maxHp],
      ['Attack', data.stats.power],
      ['Sp. Atk', Math.round(data.stats.power * 0.92)],
      ['Defense', data.stats.defense],
      ['Sp. Def', Math.round(data.stats.defense * 0.95)],
      ['Speed', data.stats.speed],
      ['Aura', data.stats.maxAura],
    ] as const;
    const cols = mobile ? 1 : 2;
    const colW = width / cols;
    const rowH = mobile ? 24 : 34;
    const labelW = mobile ? 62 : 58;
    const valueW = mobile ? 34 : 36;
    const barW = Math.max(48, colW - labelW - valueW - 18);
    stats.forEach((st, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = x + col * colW;
      const sy = y + row * rowH;
      this.startObj(this.add.text(sx, sy, st[0], { fontSize: mobile ? '10px' : '9px', color: '#aaa6c8', fontFamily: UI_THEME.fonts.family }).setDepth(112));
      this.startObj(this.add.rectangle(sx + labelW, sy + (mobile ? 4 : 14), barW, mobile ? 7 : 6, UI_THEME.bars.track, 0.8).setOrigin(0, 0).setDepth(112));
      this.startObj(this.add.rectangle(sx + labelW, sy + (mobile ? 4 : 14), Math.min(barW, (Number(st[1]) / 180) * barW), mobile ? 7 : 6, color, 0.95).setOrigin(0, 0).setDepth(113));
      this.startObj(this.add.text(sx + labelW + barW + 8, sy - (mobile ? 1 : 0), `${st[1]}`, { fontSize: mobile ? '10px' : '11px', color: '#d8d3ff', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setDepth(112));
    });
    return y + Math.ceil(stats.length / cols) * rowH;
  }

  private makeStartButton(x: number, y: number, bw: number, bh: number, label: string, cb: () => void): void {
    const g = this.startObj(this.add.graphics().setDepth(116));
    drawGlassPanel(g, x, y, bw, bh, { radius: 12, fill: UI_THEME.colors.glass, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.gold, alpha: 0.8 });
    g.setInteractive(new Phaser.Geom.Rectangle(x, y, bw, bh), Phaser.Geom.Rectangle.Contains);
    g.on('pointerdown', cb);
    this.startObj(this.add.text(x + bw / 2, y + bh / 2, label, { fontSize: '12px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold' }).setOrigin(0.5).setDepth(117));
  }

  private starterRole(id: string): string {
    if (id === 'flarepaw') return 'Hybrid striker';
    if (id === 'droplet') return 'Physical bruiser';
    if (id === 'sproutodon') return 'Bulky guardian';
    return 'Bonded companion';
  }

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
        "Renzo: You need a Monari first. Head to the Bond Lab and choose your starter.",
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
             : 'sproutodon';
    this.showStarterConfirm(id);
  }

  private showStarterConfirm(starterId: string): void {
    const minari = MINARI_ROSTER[starterId];
    if (!minari) return;

    this.starterPanelActive = true;
    const { width: w, height: h } = this.scale;
    const panelW = Math.min(620, w - 70);
    const panelH = Math.min(300, h - 70);
    const bx = w / 2 - panelW / 2, by = h / 2 - panelH / 2;
    const color = elementColor(minari.element);

    const panel = this.add.graphics().setDepth(90);
    drawGlassPanel(panel, bx, by, panelW, panelH, { radius: 24, fill: UI_THEME.colors.panelDeep, stroke: color, glow: color, alpha: 0.92 });

    const key = bestLoadedVisualKey(this, 'monari', starterId, color);
    const image = this.add.image(bx + 118, by + panelH / 2, key).setDisplaySize(160, 160).setDepth(91);
    const title = this.add.text(bx + 225, by + 30, `Bond with ${minari.name}?`, {
      fontSize: '24px', color: UI_THEME.colors.text, fontStyle: 'bold', fontFamily: UI_THEME.fonts.family,
    }).setDepth(91);
    const meta = this.add.text(bx + 225, by + 68, `Lv. 7 • ${elementLabel(minari.element)} • ${rarityLabel('rare')} • ${this.starterRole(starterId)}`, {
      fontSize: '13px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family,
    }).setDepth(91);
    const flavor = this.add.text(bx + 225, by + 94, this.starterFlavor(starterId), {
      fontSize: '12px', color: '#c9c3e8', fontFamily: UI_THEME.fonts.family, wordWrap: { width: panelW - 255 },
    }).setDepth(91);
    const triangle = this.add.text(bx + 225, by + panelH - 96, 'Starter triangle: Aqua beats Ember • Ember beats Terra • Terra beats Aqua', {
      fontSize: '11px', color: '#b8b2dc', fontFamily: UI_THEME.fonts.family,
    }).setDepth(91);
    const statLabels = [['HP', minari.stats.maxHp], ['ATK', minari.stats.power], ['DEF', minari.stats.defense], ['SPD', minari.stats.speed]];
    const bars: Phaser.GameObjects.GameObject[] = [];
    statLabels.forEach((st, i) => {
      const x = bx + 225 + (i % 2) * 145;
      const y = by + 138 + Math.floor(i / 2) * 30;
      bars.push(this.add.text(x, y, `${st[0]} ${st[1]}`, { fontSize: '10px', color: '#d8d3ff', fontFamily: UI_THEME.fonts.family }).setDepth(91));
      bars.push(this.add.rectangle(x + 54, y + 4, 76, 7, UI_THEME.bars.track, 0.8).setOrigin(0, 0).setDepth(91));
      bars.push(this.add.rectangle(x + 54, y + 4, Math.min(76, Number(st[1]) / 4), 7, color, 0.95).setOrigin(0, 0).setDepth(92));
    });

    const yesG = this.add.graphics().setDepth(91);
    drawGlassPanel(yesG, bx + panelW - 242, by + panelH - 54, 98, 34, { radius: 13, fill: 0x14281f, stroke: 0x42e69b, glow: 0x42e69b, alpha: 0.82 });
    yesG.setInteractive(new Phaser.Geom.Rectangle(bx + panelW - 242, by + panelH - 54, 98, 34), Phaser.Geom.Rectangle.Contains);
    const yesBtn = this.add.text(bx + panelW - 193, by + panelH - 37, 'Confirm', { fontSize: '13px', color: '#bfffd9', fontStyle: 'bold', fontFamily: UI_THEME.fonts.family }).setOrigin(0.5).setDepth(92);
    const noG = this.add.graphics().setDepth(91);
    drawGlassPanel(noG, bx + panelW - 132, by + panelH - 54, 78, 34, { radius: 13, fill: 0x241724, stroke: 0xff6d8d, glow: 0xff6d8d, alpha: 0.75 });
    noG.setInteractive(new Phaser.Geom.Rectangle(bx + panelW - 132, by + panelH - 54, 78, 34), Phaser.Geom.Rectangle.Contains);
    const noBtn = this.add.text(bx + panelW - 93, by + panelH - 37, 'Cancel', { fontSize: '13px', color: '#ffd5de', fontStyle: 'bold', fontFamily: UI_THEME.fonts.family }).setOrigin(0.5).setDepth(92);

    const all: Phaser.GameObjects.GameObject[] = [panel, image, title, meta, flavor, triangle, yesG, yesBtn, noG, noBtn, ...bars];

    const confirm = (): void => {
      all.forEach(o => o.destroy());
      this.starterPanelActive = false;
      this.interactLockUntil = this.time.now + 400;
      this.input.keyboard!.off('keydown-ENTER', confirm);
      this.input.keyboard!.off('keydown-ESC', cancel);
      this.confirmStarterChoice(starterId);
    };
    const cancel = (): void => {
      all.forEach(o => o.destroy());
      this.starterPanelActive = false;
      this.interactLockUntil = this.time.now + 400;
      this.input.keyboard!.off('keydown-ENTER', confirm);
      this.input.keyboard!.off('keydown-ESC', cancel);
    };

    yesG.on('pointerdown', confirm);
    noG.on('pointerdown', cancel);
    this.input.keyboard!.once('keydown-ENTER', confirm);
    this.input.keyboard!.once('keydown-ESC', cancel);
  }

  private starterFlavor(id: string): string {
    if (id === 'flarepaw') return 'A brave Ember partner with fast pressure, bright instincts, and flexible strike timing.';
    if (id === 'droplet') return 'A steady Aqua partner that wins trades with bruiser pressure and crisp Aura control.';
    return 'A Terra guardian with sturdy defenses, loyal rhythm, and patient Bond Level growth.';
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
      "Renzo: Meet me at the Training Field when you're ready to spar.",
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
    this.dpad?.setVisible(false);
    this.buildDialogPanel();
    this.renderDialogLine();
  }

  private buildDialogPanel(): void {
    const { width: w, height: h } = this.scale;
    const mob  = IS_TOUCH_DEVICE;
    const panH = mob ? 108 : 104;
    const panY = h - panH - (mob ? SAFE_AREA_BOTTOM : 0) - 8;
    const panX = 18;
    const panW = w - 36;

    const bg = this.add.graphics().setDepth(105);
    drawGlassPanel(bg, panX, panY, panW, panH, { radius: 22, fill: UI_THEME.colors.panelDeep, stroke: UI_THEME.colors.gold, glow: UI_THEME.colors.purple, alpha: 0.9 });

    const portraitBg = this.add.graphics().setDepth(106);
    portraitBg.fillStyle(UI_THEME.colors.gold, 0.14).fillRoundedRect(panX + 14, panY - 18, 84, panH + 4, 18);
    portraitBg.lineStyle(1.5, UI_THEME.colors.gold, 0.5).strokeRoundedRect(panX + 14, panY - 18, 84, panH + 4, 18);

    const portrait = this.add.image(panX + 56, panY + 36, bestLoadedVisualKey(this, 'character', 'player', UI_THEME.colors.gold)).setDisplaySize(72, 72).setDepth(107);
    portrait.setName('dialogPortrait');

    const nameplate = this.add.graphics().setDepth(107);
    nameplate.fillStyle(UI_THEME.colors.gold, 0.2).fillRoundedRect(panX + 112, panY + 12, 160, 24, 12);
    nameplate.lineStyle(1, UI_THEME.colors.gold, 0.42).strokeRoundedRect(panX + 112, panY + 12, 160, 24, 12);
    this.dialogNameText = this.add.text(panX + 126, panY + 24, 'Amari', {
      fontSize: '12px', color: '#fff0b8', fontFamily: UI_THEME.fonts.family, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(108);

    this.dialogBodyText = this.add.text(panX + 118, panY + 48, '', {
      fontSize: mob ? '14px' : '13px',
      color: UI_THEME.colors.text, fontFamily: UI_THEME.fonts.family,
      wordWrap: { width: panW - 148 }, align: 'left',
    }).setOrigin(0, 0).setDepth(108);

    const hint = this.add.text(panX + panW - 16, panY + panH - 12, mob ? 'tap • A / ENTER' : 'ENTER / SPACE / tap', {
      fontSize: '10px', color: '#9f98c6', fontFamily: UI_THEME.fonts.family,
    }).setOrigin(1, 1).setDepth(108);

    this.dialogPanel.push(bg, portraitBg, portrait, nameplate, this.dialogNameText, this.dialogBodyText, hint);

    this.time.delayedCall(180, () => {
      if (!this.dialogActive) return;
      this.input.on('pointerdown', this.onDialogAdvance, this);
      this.input.keyboard!.on('keydown-ENTER', this.onDialogAdvance, this);
      this.input.keyboard!.on('keydown-SPACE', this.onDialogAdvance, this);
    });
  }

  private readonly onDialogAdvance = (): void => { this.advanceDialog(); };

  private renderDialogLine(): void {
    if (this.dialogIndex < this.dialogLines.length) {
      const parsed = this.parseDialogLine(this.dialogLines[this.dialogIndex]);
      this.dialogNameText.setText(parsed.speaker);
      this.dialogBodyText.setText(parsed.text);
      const portrait = this.dialogPanel.find(o => o.name === 'dialogPortrait') as Phaser.GameObjects.Image | undefined;
      portrait?.setTexture(bestLoadedVisualKey(this, 'character', parsed.characterId, parsed.characterId === 'renzo' ? UI_THEME.colors.purple : UI_THEME.colors.gold));
      this.dialogIndex++;
    } else {
      this.closeDialog();
    }
  }

  private parseDialogLine(line: string): { speaker: string; text: string; characterId: string } {
    const split = line.match(/^([^:]{1,28}):\s*(.*)$/);
    const speaker = split?.[1] ?? this.getPlayerName();
    const text = split?.[2] ?? line;
    const low = speaker.toLowerCase();
    const characterId = low.includes('renzo') ? 'renzo'
      : low.includes('warren') || low.includes('ellis') || low.includes('dr.') || low.includes('professor') ? 'warren_ellis'
      : 'player';
    const display = characterId === 'warren_ellis' ? 'Dr. Warren Ellis' : speaker;
    return { speaker: display, text, characterId };
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
    this.dpad?.setVisible(IS_TOUCH_DEVICE);

    // Lock interact input briefly so the key that closed dialogue
    // doesn't instantly reopen it in the same frame.
    this.interactLockUntil = this.time.now + 400;

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

  /** R key: reset to Starter Village default spawn, clearing battle state. */
  private safetyReset(): void {
    if (this.dialogActive || this.starterPanelActive) return;
    this.registry.set('classic_current_map', 'starter_village');
    this.registry.set('classic_spawn_name',  'default');
    this.registry.remove('classic_battle_context');
    this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.restart();
    });
  }

  // ── Debug overlay ─────────────────────────────────────────────────────────────

  private updateDebugOverlay(w: number, h: number): void {
    this.debugOverlay?.destroy();
    this.debugLabels.forEach(l => l.destroy());
    this.debugLabels = [];

    if (!this.debugMode) { this.debugOverlay = null; return; }

    const g = this.add.graphics().setDepth(95).setAlpha(0.75);
    this.debugOverlay = g;

    const label = (txt: string, x: number, y: number, color: string): void => {
      this.debugLabels.push(
        this.add.text(x, y, txt, {
          fontSize: '8px', color, fontFamily: 'monospace',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(96),
      );
    };

    // Exit zones — cyan
    for (const exit of this.mapDef.exits) {
      const ex = exit.rect.x * w, ey = exit.rect.y * h;
      const ew = exit.rect.w * w, eh = exit.rect.h * h;
      g.lineStyle(2, 0x00ffff, 1);
      g.strokeRect(ex, ey, ew, eh);
      g.fillStyle(0x00ffff, 0.12);
      g.fillRect(ex, ey, ew, eh);
      label(exit.id + (exit.requiresInteract ? ' [E]' : ''), ex + ew / 2, ey + eh / 2, '#00ffff');
    }

    // NPC interact zones — green
    for (const npc of this.mapDef.npcs) {
      const nx = npc.x * w, ny = npc.y * h;
      const r  = npc.interactRadius * Math.min(w, h);
      g.lineStyle(2, 0x00ff00, 1);
      g.strokeCircle(nx, ny, r);
      g.fillStyle(0x00ff00, 0.12);
      g.fillCircle(nx, ny, r);
      label(npc.id, nx, ny, '#00ff00');
    }

    // Encounter orb zones — magenta
    for (const orb of this.mapDef.encounterOrbs) {
      const ox = orb.x * w, oy = orb.y * h;
      g.lineStyle(2, 0xff00ff, 1);
      g.strokeCircle(ox, oy, 28);
      g.fillStyle(0xff00ff, 0.12);
      g.fillCircle(ox, oy, 28);
      label(orb.minariId, ox, oy, '#ff00ff');
    }

    // Fallback collision rects — red (only visible when no mask is loaded)
    if (!this.maskSys?.isLoaded) {
      g.lineStyle(2, 0xff0000, 1);
      for (const rect of this.mapDef.collisionRects) {
        const rx = rect.x * w, ry = rect.y * h;
        const rw = rect.w * w, rh = rect.h * h;
        g.strokeRect(rx, ry, rw, rh);
        g.fillStyle(0xff0000, 0.12);
        g.fillRect(rx, ry, rw, rh);
      }
    }

    // Player body AABB outline — white
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeRect(
      this.playerX - this.playerW / 2,
      this.playerY - this.playerH,
      this.playerW,
      this.playerH,
    );

    const diag = getRenderDiagnostics(this);
    const lines = [
      `DPR ${diag.dpr} viewport ${diag.viewportSize} CSS ${diag.canvasCss} style ${diag.canvasStyle} internal ${diag.canvasInternal}`,
      `parent ${diag.parentSize} game ${diag.phaserGameSize} renderer ${diag.rendererSize} camera z${diag.cameraZoom} vp ${diag.cameraViewport}`,
      `base ${diag.phaserBaseSize} display ${diag.phaserDisplaySize}`,
      ...this.assetDiagnosticLines(),
      `[DEBUG] ${this.mapId}  |  D=toggle  R=reset`,
    ];
    lines.forEach((line, i) => label(line, w / 2, h - 70 + i * 12, i < 4 ? '#ffffff' : '#ffff00'));
  }

  private assetDiagnosticLines(): string[] {
    const frameLine = (label: string, key: string | null, display?: { width: number; height: number; scaleX: number; scaleY: number }): string => {
      if (!key || !this.textures.exists(key)) return `${label}: missing`;
      const frame = this.textures.getFrame(key);
      const disp = display ? ` display ${Math.round(display.width)}x${Math.round(display.height)} scale ${display.scaleX.toFixed(3)},${display.scaleY.toFixed(3)}` : '';
      return `${label}: ${key} tex ${frame.realWidth}x${frame.realHeight}${disp}`;
    };
    const starter = (this.registry.get('classic_player_starter') as string | null) ?? 'flarepaw';
    const selectedKey = bestLoadedVisualKey(this, 'monari', starter, UI_THEME.colors.gold);
    return [
      frameLine('bg', this.mapDef?.bgKey ?? null, this.bgImg ?? undefined),
      frameLine('player', this.playerImg?.texture.key ?? null, this.playerImg ?? undefined),
      frameLine('monari', selectedKey),
    ];
  }

  private logRenderDiagnostics(phase: string): void {
    const diag = getRenderDiagnostics(this);
    console.info('[overworld-render-diagnostics]', phase, {
      ...diag,
      assets: this.assetDiagnosticLines(),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private getPlayerName(): string {
    return (this.registry.get('classic_player_name') as string) ?? PLAYER_PROFILE.displayName;
  }
}
