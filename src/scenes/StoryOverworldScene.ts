import Phaser from 'phaser';
import { applyHighDpiCanvas, getRenderDpr } from '../config/highDpi';
import { STORY_MAPS, type StoryInteraction, type StoryMapId } from '../data/storyMaps';
import { STORY_CHARACTERS } from '../data/storyCharacters';
import { STORY_MONARI, randomStoryGender, renzoCounterPick, type StoryGender, type StoryMonariDef } from '../data/storyMonari';
import { StoryOverlayController, starterPreviewImage, type StoryDialogueLine } from '../ui/storyOverlay';
import type { ClassicBattleContext } from '../types/overworld';
import { PlayerSaveManager } from '../systems/PlayerSaveManager';
import type { OverworldSave } from '../systems/PlayerSaveManager';
import { OverworldMenuOverlay } from '../ui/OverworldMenuOverlay';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';

const PLAYER_NAME = 'Corn';
type StoryEdge = 'north' | 'south' | 'west' | 'east';
type StoryState = { mapId: StoryMapId; spawn: string; starter?: StoryMonariDef['id']; starterGender?: StoryGender; renzoStarter?: StoryMonariDef['id']; professorIntro?: boolean; renzoIntro?: boolean };

type Actor = { id: string; kind: 'npc' | 'starter' | 'orb'; targetId?: string; label: string; sprite?: Phaser.GameObjects.Image; marker: Phaser.GameObjects.Arc; x: number; y: number; radius: number };

export class StoryOverworldScene extends Phaser.Scene {
  private audio!: AudioManager;
  private ui!: StoryOverlayController;
  private state!: StoryState;
  private mapId!: StoryMapId;
  private map = STORY_MAPS.starter_village;
  private bg!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Image;
  private actors: Actor[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKeys!: Phaser.Input.Keyboard.Key[];
  private touchMove = { x: 0, y: 0 };
  private nearest: Actor | null = null;
  private busy = false;
  private edgeCooldown = 0;
  private edgeArmed: Record<StoryEdge, boolean> = { north: true, south: true, west: true, east: true };
  private cutoutDebug: Record<string, string> = {};
  private menuOverlay: OverworldMenuOverlay | null = null;

  constructor() { super({ key: 'StoryOverworldScene' }); }

  preload(): void {
    Object.values(STORY_MAPS).forEach(m => this.load.image(`story_bg_${m.id}`, m.background));
    for (const c of Object.values(STORY_CHARACTERS)) {
      if (c.assets.portrait) this.load.image(`story_char_${c.id}_portrait`, c.assets.portrait);
      if (c.assets.overworld) this.load.image(`story_char_${c.id}_overworld`, c.assets.overworld);
      if (c.assets.fullBody) this.load.image(`story_char_${c.id}_full`, c.assets.fullBody);
    }
    for (const m of Object.values(STORY_MONARI)) {
      if (m.assets.profile) this.load.image(`story_monari_${m.id}_profile`, m.assets.profile);
      if (m.assets.overworld) this.load.image(`story_monari_${m.id}_overworld`, m.assets.overworld);
      if (m.assets.fullBody) this.load.image(`story_monari_${m.id}_full`, m.assets.fullBody);
      this.load.image(`story_monari_${m.id}_idle`, m.assets.battleIdle);
      this.load.image(`story_element_${m.element}`, m.elementIcon);
    }
    this.load.image('story_gender_male', 'assets/ui/icons/gender_male.png');
    this.load.image('story_gender_female', 'assets/ui/icons/gender_female.png');
  }

  create(): void {
    applyHighDpiCanvas(this.game, 'story:create');
    this.syncStoryCamera();
    this.state = (this.registry.get('story_state') as StoryState | undefined) ?? this.loadSavedState() ?? { mapId: 'starter_village', spawn: 'default' };
    this.mapId = this.state.mapId;
    this.map = STORY_MAPS[this.mapId];
    this.prepareCharacterCutouts();
    this.ui = new StoryOverlayController();
    this.ui.setCallbacks((x, y) => { this.touchMove = { x, y }; }, () => this.interact(), () => this.showMenuStub());
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKeys = [this.input.keyboard!.addKey('E'), this.input.keyboard!.addKey('SPACE'), this.input.keyboard!.addKey('ENTER')];
    this.input.keyboard!.addKey('ESC').on('down', () => this.showMenuStub());

    this.audio = new AudioManager(this);
    this.buildMap();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this);
      this.ui.destroy();
      this.menuOverlay?.destroy();
      this.menuOverlay = null;
    });

    if (this.mapId === 'bond_lab_interior' && !this.state.professorIntro) {
      this.state.professorIntro = true; this.saveState();
      this.time.delayedCall(250, () => this.showProfessorIntro());
    }

    // Award XP if returning from a wild battle win
    const battleResult = this.registry.get('arena_battle_result') as { won: boolean; enemyLevel: number } | null;
    if (battleResult) {
      this.registry.remove('arena_battle_result');
      if (battleResult.won && this.state.starter) {
        const save = this.getOrInitSave();
        const xpGain = PlayerSaveManager.calcXpGain(save.monariLevel, battleResult.enemyLevel);
        const { save: newSave, levelsGained } = PlayerSaveManager.addXp(save, xpGain);
        PlayerSaveManager.persist(newSave);
        this.time.delayedCall(600, () => this.showXpNotification(xpGain, levelsGained, newSave.monariLevel));
      }
    }
  }

  private saveState(): void { this.registry.set('story_state', this.state); }
  private loadSavedState(): StoryState | null { try { const raw = localStorage.getItem('monarium_story_save'); return raw ? JSON.parse(raw) as StoryState : null; } catch { return null; } }
  private saveGame(): void { localStorage.setItem('monarium_story_save', JSON.stringify(this.state)); }
  private worldSize(): { w: number; h: number; dpr: number } {
    const dpr = getRenderDpr();
    return {
      w: Math.max(1, Math.round(this.game.renderer.width || this.scale.width * dpr)),
      h: Math.max(1, Math.round(this.game.renderer.height || this.scale.height * dpr)),
      dpr,
    };
  }
  private syncStoryCamera(): void {
    const { w, h } = this.worldSize();
    this.cameras.main.setViewport(0, 0, w, h).setZoom(1).setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, w, h);
  }
  private textureKey(keys: string[]): string { return keys.find(k => this.textures.exists(k)) ?? '__MISSING'; }
  private charTexture(id: keyof typeof STORY_CHARACTERS, purpose: 'portrait' | 'overworld' = 'overworld'): string {
    const order = purpose === 'portrait' ? [`story_char_${id}_portrait`, `story_char_${id}_full`, `story_char_${id}_overworld`] : [`story_char_${id}_overworld_cutout`, `story_char_${id}_full_cutout`, `story_char_${id}_overworld`, `story_char_${id}_full`, `story_char_${id}_portrait`];
    return this.textureKey(order);
  }

  private prepareCharacterCutouts(): void {
    (Object.keys(STORY_CHARACTERS) as Array<keyof typeof STORY_CHARACTERS>).forEach(id => {
      [`story_char_${id}_overworld`, `story_char_${id}_full`].forEach(key => {
        if (this.textures.exists(key)) this.createChromaTrimmedTexture(key, `${key}_cutout`);
      });
    });
  }

  private createChromaTrimmedTexture(sourceKey: string, targetKey: string): void {
    if (this.textures.exists(targetKey)) return;
    const tex = this.textures.get(sourceKey);
    const source = tex.getSourceImage() as CanvasImageSource | undefined;
    const frame = tex.get();
    if (!source || !frame) return;
    const width = frame.width || frame.realWidth;
    const height = frame.height || frame.realHeight;
    const src = document.createElement('canvas');
    src.width = width; src.height = height;
    const ctx = src.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = -1, maxY = -1, green = 0, visible = 0;
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2], a = data.data[i + 3];
      const chromaGreen = g > 135 && g > r * 1.28 && g > b * 1.28 && r < 150 && b < 150;
      if (chromaGreen) { data.data[i + 3] = 0; green++; }
      if (data.data[i + 3] > 12) {
        const px = (i / 4) % width; const py = Math.floor((i / 4) / width);
        minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); visible++;
      }
    }
    ctx.putImageData(data, 0, 0);
    if (visible <= 0) return;
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
    const cropW = Math.max(1, maxX - minX + 1); const cropH = Math.max(1, maxY - minY + 1);
    const out = this.textures.createCanvas(targetKey, cropW, cropH);
    const outCtx = out?.getContext();
    if (!out || !outCtx) return;
    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(src, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    out.refresh();
    this.cutoutDebug[targetKey] = `${sourceKey} raw ${width}x${height} crop ${cropW}x${cropH} greenPx ${green}`;
  }
  private monariTexture(id: StoryMonariDef['id'], purpose: 'portrait' | 'overworld' = 'overworld'): string {
    const order = purpose === 'portrait' ? [`story_monari_${id}_profile`, `story_monari_${id}_full`, `story_monari_${id}_overworld`, `story_monari_${id}_idle`] : [`story_monari_${id}_overworld`, `story_monari_${id}_full`, `story_monari_${id}_profile`, `story_monari_${id}_idle`];
    return this.textureKey(order);
  }

  private mapBgmKey(mapId: StoryMapId): string {
    switch (mapId) {
      case 'forest_route':  return AUDIO_KEYS.bgm.forest;
      case 'crystal_cave':  return AUDIO_KEYS.bgm.cave;
      case 'coastal_beach': return AUDIO_KEYS.bgm.beach;
      default:              return AUDIO_KEYS.bgm.village;
    }
  }

  private buildMap(): void {
    this.children.removeAll(true);
    this.syncStoryCamera();
    this.audio.fadeToBgm(this.mapBgmKey(this.mapId));
    const { w, h } = this.worldSize();
    this.map = STORY_MAPS[this.mapId];
    const bgKey = `story_bg_${this.map.id}`;
    const frame = this.textures.getFrame(bgKey);
    const cover = Math.max(w / frame.realWidth, h / frame.realHeight);
    this.bg = this.add.image(w / 2, h / 2, bgKey).setScale(cover).setDepth(0);

    const spawn = this.map.spawns[this.state.spawn] ?? this.map.spawns.default;
    this.player = this.add.image(spawn.x * w, spawn.y * h, this.charTexture('player')).setDepth(20).setOrigin(0.5, 1);
    this.fitImageHeight(this.player, STORY_CHARACTERS.player.displayHeight, true);

    this.actors = [];
    for (const it of this.map.interactions) this.addInteraction(it);
    if (this.mapId === 'bond_lab_interior' && this.state.starter && this.state.renzoStarter) this.addRenzoLab();
    if (this.mapId === 'training_field' && this.state.starter) this.addRenzoTraining();
    if (this.map.encounters) this.addEncounterOrbs();
    this.ui.setHud({ mapName: this.map.displayName, playerName: PLAYER_NAME, starter: this.state.starter ? STORY_MONARI[this.state.starter].name : undefined });
    this.debugSpriteAudit('buildMap');
  }

  private relayout = (): void => {
    const { w: oldW, h: oldH } = this.worldSize();
    applyHighDpiCanvas(this.game, 'story:resize');
    const nx = this.player.x / Math.max(1, oldW);
    const ny = this.player.y / Math.max(1, oldH);
    this.buildMap();
    const { w, h } = this.worldSize();
    this.player.setPosition(nx * w, ny * h);
  };

  private fitImageHeight(img: Phaser.GameObjects.Image, targetHeight: number, human = false): void {
    const frame = img.frame;
    const { h: worldH, dpr } = this.worldSize();
    const landscape = this.worldSize().w > worldH;
    const labHumanBoost = human && this.mapId === 'bond_lab_interior' ? (landscape ? 1.18 : 1.36) : 1;
    const labStarterTrim = !human && this.mapId === 'bond_lab_interior' && landscape ? 0.74 : 1;
    const maxHeight = human && this.mapId === 'bond_lab_interior' ? worldH * (landscape ? 0.34 : 0.30) : worldH * (landscape ? 0.24 : 0.28);
    const h = Phaser.Math.Clamp(targetHeight * labHumanBoost * labStarterTrim * dpr, 58 * dpr, Math.min(230 * dpr, maxHeight));
    img.setDisplaySize((frame.realWidth / frame.realHeight) * h, h);
  }

  private addInteraction(it: StoryInteraction): void {
    const { w, h } = this.worldSize();
    const x = it.x * w, y = it.y * h;
    let sprite: Phaser.GameObjects.Image | undefined;
    if (it.kind === 'professor') { sprite = this.add.image(x, y, this.charTexture('warren_ellis')).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, STORY_CHARACTERS.warren_ellis.displayHeight, true); }
    if (it.kind === 'starter' && it.targetId) { sprite = this.add.image(x, y, this.monariTexture(it.targetId as StoryMonariDef['id'])).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, 108); }
    const markerRadius = Math.max(22 * this.worldSize().dpr, it.radius * Math.min(w, h));
    const marker = this.add.circle(x, y, markerRadius, it.kind === 'lab' ? 0x8c5cff : 0xffbf72, 0.20).setStrokeStyle(2 * this.worldSize().dpr, 0xffffff, 0.34).setDepth(5);
    this.actors.push({ id: it.id, kind: it.kind === 'starter' ? 'starter' : 'npc', targetId: it.targetId, label: it.label, sprite, marker, x, y, radius: it.radius * Math.min(w, h) });
  }

  private addRenzoLab(): void { this.addActorSprite('renzo_lab', 'npc', 'Renzo', 'renzo', 0.76, 0.42); }
  private addRenzoTraining(): void { this.addActorSprite('renzo_training_live', 'npc', 'Renzo', 'renzo', 0.56, 0.42); }
  private addActorSprite(id: string, kind: Actor['kind'], label: string, charId: 'renzo', nx: number, ny: number): void {
    const { w, h, dpr } = this.worldSize();
    const x = nx * w, y = ny * h;
    const sprite = this.add.image(x, y, this.charTexture(charId)).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, STORY_CHARACTERS[charId].displayHeight, true);
    const marker = this.add.circle(x, y, 44 * dpr, 0x8c5cff, 0.16).setStrokeStyle(2 * dpr, 0xffbf72, 0.5).setDepth(5);
    this.actors.push({ id, kind, label, sprite, marker, x, y, radius: 56 * dpr });
  }
  private addEncounterOrbs(): void {
    const colors = [0xe8e8ff, 0x4a9cff, 0xffd45a, 0xb46cff];
    [[0.34, 0.42], [0.58, 0.60], [0.72, 0.34]].forEach((p, i) => {
      const { w, h, dpr } = this.worldSize();
      const x = p[0] * w, y = p[1] * h;
      const marker = this.add.circle(x, y, 22 * dpr, colors[i % colors.length], 0.35).setStrokeStyle(2 * dpr, colors[i % colors.length], 0.9).setDepth(8);
      this.tweens.add({ targets: marker, scale: 1.25, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
      this.actors.push({ id: `orb_${i}`, kind: 'orb', label: 'Soul Orb', marker, x, y, radius: 34 * dpr });
    });
  }

  update(_t: number, delta: number): void {
    if (this.busy || this.ui.isDialogueOpen()) return;
    this.edgeCooldown = Math.max(0, this.edgeCooldown - delta);
    const vec = this.getMoveVector();
    const { w, h, dpr } = this.worldSize();
    const speed = 185 * dpr;
    this.player.x = Phaser.Math.Clamp(this.player.x + vec.x * speed * delta / 1000, 0, w);
    this.player.y = Phaser.Math.Clamp(this.player.y + vec.y * speed * delta / 1000, 0, h);
    this.updateNearest();
    this.checkEdges(vec);
    if (this.interactKeys.some(k => Phaser.Input.Keyboard.JustDown(k))) this.interact();
  }
  private getMoveVector(): { x: number; y: number } {
    let x = this.touchMove.x, y = this.touchMove.y;
    if (this.cursors.left?.isDown || this.wasd.A.isDown) x -= 1; if (this.cursors.right?.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up?.isDown || this.wasd.W.isDown) y -= 1; if (this.cursors.down?.isDown || this.wasd.S.isDown) y += 1;
    const len = Math.hypot(x, y); return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }
  private updateNearest(): void {
    this.nearest = null; let best = Infinity;
    for (const a of this.actors) { const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y); if (d < a.radius && d < best) { best = d; this.nearest = a; } }
    this.ui.setPrompt(this.nearest ? `A  ${this.nearest.label}` : null);
  }
  private interact(): void {
    if (this.ui.isDialogueOpen()) { this.ui.handleAdvance(); return; }
    const a = this.nearest; if (!a) return;
    if (a.id === 'bond_lab') this.changeMap('bond_lab_interior', 'default');
    else if (a.id === 'professor') this.showProfessorIntro();
    else if (a.kind === 'starter' && a.targetId) this.previewStarter(a.targetId as StoryMonariDef['id']);
    else if (a.label === 'Renzo') this.handleRenzo();
    else if (a.kind === 'orb') this.showWildEncounter();
  }
  private checkEdges(vec: { x: number; y: number }): void {
    if (this.edgeCooldown > 0) return;
    const { w, h, dpr } = this.worldSize();
    const margin = Math.max(8 * dpr, Math.min(w, h) * 0.012);
    const active: Record<StoryEdge, boolean> = {
      north: this.player.y <= margin && vec.y < -0.18,
      south: this.player.y >= h - margin && vec.y > 0.18,
      west: this.player.x <= margin && vec.x < -0.18,
      east: this.player.x >= w - margin && vec.x > 0.18,
    };
    (Object.keys(active) as StoryEdge[]).forEach(edge => { if (!active[edge]) this.edgeArmed[edge] = true; });
    const edge = (Object.keys(active) as StoryEdge[]).find(e => active[e] && this.edgeArmed[e]);
    const exit = edge && this.map.exits.find(e => e.edge === edge);
    if (edge && exit) { this.edgeArmed[edge] = false; this.changeMap(exit.to, exit.spawn); }
  }
  private changeMap(mapId: StoryMapId, spawn: string): void {
    this.busy = true;
    this.state.mapId = mapId;
    this.state.spawn = spawn;
    this.saveState();
    this.edgeCooldown = 950;
    this.edgeArmed = { north: false, south: false, west: false, east: false };
    this.cameras.main.fade(180, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) {
        this.mapId = mapId;
        this.buildMap();
        this.time.delayedCall(700, () => { this.edgeArmed = { north: true, south: true, west: true, east: true }; });
        this.busy = false;
        this.cameras.main.fadeIn(180);
        if (mapId === 'bond_lab_interior' && !this.state.professorIntro) {
          this.state.professorIntro = true;
          this.saveState();
          this.time.delayedCall(220, () => this.showProfessorIntro());
        }
      }
    });
  }

  private portrait(character: keyof typeof STORY_CHARACTERS): string | undefined { return STORY_CHARACTERS[character].assets.portrait ?? STORY_CHARACTERS[character].assets.fullBody; }
  private showProfessorIntro(): void { this.ui.showDialogue([{ speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: `Welcome, ${PLAYER_NAME}. I’m Dr. Warren Ellis. This is the Bond Lab, where new Bonders meet their first partner.` }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Three Monari are waiting here. Each one carries a different element and a different path.' }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Walk up to a Monari and tap to learn about it. When you’re ready, choose your partner.' }]); }
  private previewStarter(id: StoryMonariDef['id']): void { const gender = randomStoryGender(); this.ui.showStarterPreview({ monari: STORY_MONARI[id], gender, image: starterPreviewImage(id), onCancel: () => this.ui.hideStarterPreview(), onChoose: () => this.chooseStarter(id, gender) }); }
  private chooseStarter(id: StoryMonariDef['id'], gender: StoryGender): void { this.ui.hideStarterPreview(); this.state.starter = id; this.state.starterGender = gender; this.state.renzoStarter = renzoCounterPick(id); this.state.renzoIntro = true; this.saveState(); this.getOrInitSave(); this.ui.setHud({ mapName: this.map.displayName, playerName: PLAYER_NAME, starter: STORY_MONARI[id].name }); const renzoPick = STORY_MONARI[this.state.renzoStarter].name; this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Yo, so that’s your pick?' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: `Not bad. But if you’re choosing that one, I’m taking ${renzoPick}.` }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Meet me at the Training Field. Let’s see if your bond is real.' }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Renzo never waits long. Head north to the Training Field when you’re ready.' }], () => this.buildMap()); }
  private handleRenzo(): void { if (this.mapId !== 'training_field') return; this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'There you are. I was starting to think you got scared.' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Your first bond is new. Mine is already battle-ready.' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Let’s make this quick. Show me what your partner can do.' }], () => this.startRivalBattle()); }
  private startRivalBattle(): void { if (!this.state.starter || !this.state.renzoStarter) { this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Get a partner from the Bond Lab first.' }]); return; } const playerLevel = this.getOrInitSave().monariLevel; const ctx: ClassicBattleContext = { returnMap: 'training_field', returnSpawn: 'south', playerMinariId: this.state.starter, enemyMinariId: this.state.renzoStarter, bondable: false, battleType: 'rival', playerLevel, enemyLevel: 7 }; this.registry.set('classic_battle_context', ctx); applyHighDpiCanvas(this.game, 'story:rival-battle:sync-now'); requestAnimationFrame(() => { applyHighDpiCanvas(this.game, 'story:rival-battle:sync-raf'); window.setTimeout(() => { applyHighDpiCanvas(this.game, 'story:rival-battle:sync-settled'); this.scene.start('ClassicSoulDuelScene'); }, 80); }); }
  private showWildEncounter(): void {
    if (!this.state.starter) {
      this.ui.showDialogue([{ speaker: 'Soul Orb', text: 'You need a partner before you can battle wild Monari!' }]);
      return;
    }
    const ids = Object.keys(STORY_MONARI) as StoryMonariDef['id'][];
    const enemyId    = ids[Math.floor(Math.random() * ids.length)];
    const enemyLevel = Phaser.Math.Between(5, 10);
    const playerLevel = this.getOrInitSave().monariLevel;
    const ctx: ClassicBattleContext = {
      returnMap:      this.mapId,
      returnSpawn:    this.state.spawn ?? 'default',
      playerMinariId: this.state.starter,
      enemyMinariId:  enemyId,
      battleType:     'wild',
      playerLevel,
      enemyLevel,
      bondable:       true,
    };
    this.registry.set('classic_battle_context', ctx);
    applyHighDpiCanvas(this.game, 'story:wild-encounter:sync-now');
    requestAnimationFrame(() => {
      applyHighDpiCanvas(this.game, 'story:wild-encounter:sync-raf');
      window.setTimeout(() => {
        applyHighDpiCanvas(this.game, 'story:wild-encounter:sync-settled');
        this.scene.start('ClassicSoulDuelScene');
      }, 80);
    });
  }

  private showMenuStub(): void {
    this.openMonariMenu();
  }

  private getOrInitSave(): OverworldSave {
    if (!this.state.starter) return PlayerSaveManager.load();
    const existing = PlayerSaveManager.load();
    if (existing.starterMonariId === this.state.starter) return existing;
    // New or mismatched — start fresh for this starter at level 7
    const fresh = PlayerSaveManager.createFreshSave(this.state.starter, PLAYER_NAME, 7);
    PlayerSaveManager.persist(fresh);
    return fresh;
  }

  private openMonariMenu(): void {
    this.busy = true;
    if (!this.menuOverlay) {
      this.menuOverlay = new OverworldMenuOverlay({
        onClose: () => { this.busy = false; },
        onModeSelect: () => {
          this.busy = false;
          this.menuOverlay?.destroy();
          this.menuOverlay = null;
          this.scene.start('ModeSelectScene');
        },
        onSave: () => this.saveGame(),
      });
    }
    const save = this.state.starter ? this.getOrInitSave() : undefined;
    const teamIds = save ? PlayerSaveManager.getBondedTeam(save) : [];
    this.menuOverlay.showBonderMenu(teamIds, save);
  }

  private showXpNotification(xpGain: number, levelsGained: number, newLevel: number): void {
    const { w, h, dpr } = this.worldSize();
    const lines = [`+${xpGain} XP`];
    if (levelsGained > 0) lines.push(`Level Up!  Lv.${newLevel}`);
    const popup = this.add.text(w / 2, h / 3, lines.join('\n'), {
      fontSize: `${Math.round(22 * dpr)}px`,
      color: '#ffee44',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4 * dpr,
      align: 'center',
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
    this.tweens.add({
      targets: popup, alpha: 1, y: h / 3 - 20 * dpr, duration: 300, ease: 'Quad.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup, alpha: 0, y: h / 3 - 44 * dpr, duration: 700, delay: 1400,
          ease: 'Quad.In', onComplete: () => popup.destroy(),
        });
      },
    });
  }
  private debugSpriteAudit(reason: string): void { const f = this.player?.frame; const bg = this.bg?.frame; const bounds = this.cameras.main.getBounds(); const diagnostics = { reason, scene: this.scene.key, map: this.mapId, viewport: `${this.worldSize().w}x${this.worldSize().h}`, camera: `vp ${this.cameras.main.x},${this.cameras.main.y} ${this.cameras.main.width}x${this.cameras.main.height} scroll ${this.cameras.main.scrollX},${this.cameras.main.scrollY} z${this.cameras.main.zoom}`, worldBounds: `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`, bgTexture: bg ? `${bg.realWidth}x${bg.realHeight}` : 'none', bgDisplay: this.bg ? `${Math.round(this.bg.displayWidth)}x${Math.round(this.bg.displayHeight)} @ ${Math.round(this.bg.x)},${Math.round(this.bg.y)} origin ${this.bg.originX},${this.bg.originY}` : 'none', playerTexture: this.player?.texture.key, playerTextureSize: f ? `${f.realWidth}x${f.realHeight}` : 'none', playerDisplay: this.player ? `${Math.round(this.player.displayWidth)}x${Math.round(this.player.displayHeight)} @ ${Math.round(this.player.x)},${Math.round(this.player.y)}` : 'none', playerScale: this.player ? `${this.player.scaleX.toFixed(3)},${this.player.scaleY.toFixed(3)}` : 'none' }; this.registry.set('story_layout_debug', [`story bg tex ${diagnostics.bgTexture} display ${diagnostics.bgDisplay}`, `story player ${diagnostics.playerTexture} tex ${diagnostics.playerTextureSize} display ${diagnostics.playerDisplay} scale ${diagnostics.playerScale}`, `story world ${diagnostics.worldBounds}`, `story transition cooldown ${Math.round(this.edgeCooldown)} margin ${Math.round(Math.max(8 * this.worldSize().dpr, Math.min(this.worldSize().w, this.worldSize().h) * 0.012))}`, ...this.actors.filter(a => a.sprite).map(a => `${a.id} ${a.sprite!.texture.key} ${this.cutoutDebug[a.sprite!.texture.key] ?? 'no trim'} display ${Math.round(a.sprite!.displayWidth)}x${Math.round(a.sprite!.displayHeight)} @ ${Math.round(a.sprite!.x)},${Math.round(a.sprite!.y)} origin ${a.sprite!.originX},${a.sprite!.originY}`)]); console.info('[story-overworld-layout]', diagnostics); }
}
