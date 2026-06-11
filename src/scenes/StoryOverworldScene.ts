import Phaser from 'phaser';
import { applyHighDpiCanvas, getRenderDpr } from '../config/highDpi';
import { STORY_MAPS, type StoryInteraction, type StoryMapId } from '../data/storyMaps';
import { STORY_CHARACTERS } from '../data/storyCharacters';
import { STORY_MONARI, randomStoryGender, renzoCounterPick, type StoryGender, type StoryMonariDef } from '../data/storyMonari';
import { StoryOverlayController, starterPreviewImage, type StoryDialogueLine } from '../ui/storyOverlay';
import type { ClassicBattleContext } from '../types/overworld';

const PLAYER_NAME = 'Corn';
type StoryState = { mapId: StoryMapId; spawn: string; starter?: StoryMonariDef['id']; starterGender?: StoryGender; renzoStarter?: StoryMonariDef['id']; professorIntro?: boolean; renzoIntro?: boolean };

type Actor = { id: string; kind: 'npc' | 'starter' | 'orb'; targetId?: string; label: string; sprite?: Phaser.GameObjects.Image; marker: Phaser.GameObjects.Arc; x: number; y: number; radius: number };

export class StoryOverworldScene extends Phaser.Scene {
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
    this.cameras.main.setViewport(0, 0, this.game.renderer.width, this.game.renderer.height).setZoom(getRenderDpr()).setScroll(0, 0);
    this.state = (this.registry.get('story_state') as StoryState | undefined) ?? { mapId: 'starter_village', spawn: 'default' };
    this.mapId = this.state.mapId;
    this.map = STORY_MAPS[this.mapId];
    this.ui = new StoryOverlayController();
    this.ui.setCallbacks((x, y) => { this.touchMove = { x, y }; }, () => this.interact(), () => this.showMenuStub());
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKeys = [this.input.keyboard!.addKey('E'), this.input.keyboard!.addKey('SPACE'), this.input.keyboard!.addKey('ENTER')];
    this.input.keyboard!.addKey('ESC').on('down', () => this.showMenuStub());

    this.buildMap();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this); this.ui.destroy(); });

    if (this.mapId === 'bond_lab_interior' && !this.state.professorIntro) {
      this.state.professorIntro = true; this.saveState();
      this.time.delayedCall(250, () => this.showProfessorIntro());
    }
  }

  private saveState(): void { this.registry.set('story_state', this.state); }
  private textureKey(keys: string[]): string { return keys.find(k => this.textures.exists(k)) ?? '__MISSING'; }
  private charTexture(id: keyof typeof STORY_CHARACTERS, purpose: 'portrait' | 'overworld' = 'overworld'): string {
    const order = purpose === 'portrait' ? [`story_char_${id}_portrait`, `story_char_${id}_full`, `story_char_${id}_overworld`] : [`story_char_${id}_overworld`, `story_char_${id}_full`, `story_char_${id}_portrait`];
    return this.textureKey(order);
  }
  private monariTexture(id: StoryMonariDef['id'], purpose: 'portrait' | 'overworld' = 'overworld'): string {
    const order = purpose === 'portrait' ? [`story_monari_${id}_profile`, `story_monari_${id}_full`, `story_monari_${id}_overworld`, `story_monari_${id}_idle`] : [`story_monari_${id}_overworld`, `story_monari_${id}_full`, `story_monari_${id}_profile`, `story_monari_${id}_idle`];
    return this.textureKey(order);
  }

  private buildMap(): void {
    this.children.removeAll(true);
    const { width: w, height: h } = this.scale;
    this.map = STORY_MAPS[this.mapId];
    const bgKey = `story_bg_${this.map.id}`;
    const frame = this.textures.getFrame(bgKey);
    const cover = Math.max(w / frame.realWidth, h / frame.realHeight);
    this.bg = this.add.image(w / 2, h / 2, bgKey).setScale(cover).setDepth(0);

    const spawn = this.map.spawns[this.state.spawn] ?? this.map.spawns.default;
    this.player = this.add.image(spawn.x * w, spawn.y * h, this.charTexture('player')).setDepth(20).setOrigin(0.5, 1);
    this.fitImageHeight(this.player, STORY_CHARACTERS.player.displayHeight);

    this.actors = [];
    for (const it of this.map.interactions) this.addInteraction(it);
    if (this.mapId === 'bond_lab_interior' && this.state.starter && this.state.renzoStarter) this.addRenzoLab();
    if (this.mapId === 'training_field' && this.state.starter) this.addRenzoTraining();
    if (this.map.encounters) this.addEncounterOrbs();
    this.ui.setHud({ mapName: this.map.displayName, playerName: PLAYER_NAME, starter: this.state.starter ? STORY_MONARI[this.state.starter].name : undefined });
    this.debugSpriteAudit('buildMap');
  }

  private relayout = (): void => {
    applyHighDpiCanvas(this.game, 'story:resize');
    const nx = this.player.x / Math.max(1, this.scale.width);
    const ny = this.player.y / Math.max(1, this.scale.height);
    this.buildMap();
    this.player.setPosition(nx * this.scale.width, ny * this.scale.height);
  };

  private fitImageHeight(img: Phaser.GameObjects.Image, targetHeight: number): void {
    const frame = img.frame;
    const h = Phaser.Math.Clamp(targetHeight, 90, Math.min(170, this.scale.height * 0.24));
    img.setDisplaySize((frame.realWidth / frame.realHeight) * h, h);
  }

  private addInteraction(it: StoryInteraction): void {
    const x = it.x * this.scale.width, y = it.y * this.scale.height;
    let sprite: Phaser.GameObjects.Image | undefined;
    if (it.kind === 'professor') { sprite = this.add.image(x, y, this.charTexture('warren_ellis')).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, STORY_CHARACTERS.warren_ellis.displayHeight); }
    if (it.kind === 'starter' && it.targetId) { sprite = this.add.image(x, y, this.monariTexture(it.targetId as StoryMonariDef['id'])).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, 108); }
    const marker = this.add.circle(x, y, Math.max(22, it.radius * Math.min(this.scale.width, this.scale.height)), it.kind === 'lab' ? 0x8c5cff : 0xffbf72, 0.20).setStrokeStyle(2, 0xffffff, 0.34).setDepth(5);
    this.actors.push({ id: it.id, kind: it.kind === 'starter' ? 'starter' : 'npc', targetId: it.targetId, label: it.label, sprite, marker, x, y, radius: it.radius * Math.min(this.scale.width, this.scale.height) });
  }

  private addRenzoLab(): void { this.addActorSprite('renzo_lab', 'npc', 'Renzo', 'renzo', 0.76, 0.42); }
  private addRenzoTraining(): void { this.addActorSprite('renzo_training_live', 'npc', 'Renzo', 'renzo', 0.56, 0.42); }
  private addActorSprite(id: string, kind: Actor['kind'], label: string, charId: 'renzo', nx: number, ny: number): void {
    const x = nx * this.scale.width, y = ny * this.scale.height;
    const sprite = this.add.image(x, y, this.charTexture(charId)).setOrigin(0.5, 1).setDepth(12); this.fitImageHeight(sprite, STORY_CHARACTERS[charId].displayHeight);
    const marker = this.add.circle(x, y, 44, 0x8c5cff, 0.16).setStrokeStyle(2, 0xffbf72, 0.5).setDepth(5);
    this.actors.push({ id, kind, label, sprite, marker, x, y, radius: 56 });
  }
  private addEncounterOrbs(): void {
    const colors = [0xe8e8ff, 0x4a9cff, 0xffd45a, 0xb46cff];
    [[0.34, 0.42], [0.58, 0.60], [0.72, 0.34]].forEach((p, i) => {
      const x = p[0] * this.scale.width, y = p[1] * this.scale.height;
      const marker = this.add.circle(x, y, 22, colors[i % colors.length], 0.35).setStrokeStyle(2, colors[i % colors.length], 0.9).setDepth(8);
      this.tweens.add({ targets: marker, scale: 1.25, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
      this.actors.push({ id: `orb_${i}`, kind: 'orb', label: 'Soul Orb', marker, x, y, radius: 34 });
    });
  }

  update(_t: number, delta: number): void {
    if (this.busy || this.ui.isDialogueOpen()) return;
    this.edgeCooldown = Math.max(0, this.edgeCooldown - delta);
    const vec = this.getMoveVector();
    const speed = 185;
    this.player.x = Phaser.Math.Clamp(this.player.x + vec.x * speed * delta / 1000, 18, this.scale.width - 18);
    this.player.y = Phaser.Math.Clamp(this.player.y + vec.y * speed * delta / 1000, 70, this.scale.height - 18);
    this.updateNearest();
    this.checkEdges();
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
  private checkEdges(): void { if (this.edgeCooldown > 0) return; const x = this.player.x, y = this.player.y, w = this.scale.width, h = this.scale.height; const edge = y <= 24 ? 'north' : y >= h - 24 ? 'south' : x <= 24 ? 'west' : x >= w - 24 ? 'east' : null; const exit = edge && this.map.exits.find(e => e.edge === edge); if (exit) this.changeMap(exit.to, exit.spawn); }
  private changeMap(mapId: StoryMapId, spawn: string): void { this.busy = true; this.state.mapId = mapId; this.state.spawn = spawn; this.saveState(); this.edgeCooldown = 400; this.cameras.main.fade(180, 0, 0, 0, false, (_: unknown, p: number) => { if (p === 1) { this.mapId = mapId; this.buildMap(); this.busy = false; this.cameras.main.fadeIn(180); if (mapId === 'bond_lab_interior' && !this.state.professorIntro) { this.state.professorIntro = true; this.saveState(); this.time.delayedCall(220, () => this.showProfessorIntro()); } } }); }

  private portrait(character: keyof typeof STORY_CHARACTERS): string | undefined { return STORY_CHARACTERS[character].assets.portrait ?? STORY_CHARACTERS[character].assets.fullBody; }
  private showProfessorIntro(): void { this.ui.showDialogue([{ speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: `Welcome, ${PLAYER_NAME}. I’m Dr. Warren Ellis. This is the Bond Lab, where new Bonders meet their first partner.` }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Three Monari are waiting here. Each one carries a different element and a different path.' }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Walk up to a Monari and press A to learn about it. When you’re ready, choose your partner.' }]); }
  private previewStarter(id: StoryMonariDef['id']): void { const gender = randomStoryGender(); this.ui.showStarterPreview({ monari: STORY_MONARI[id], gender, image: starterPreviewImage(id), onCancel: () => this.ui.hideStarterPreview(), onChoose: () => this.chooseStarter(id, gender) }); }
  private chooseStarter(id: StoryMonariDef['id'], gender: StoryGender): void { this.ui.hideStarterPreview(); this.state.starter = id; this.state.starterGender = gender; this.state.renzoStarter = renzoCounterPick(id); this.saveState(); this.ui.setHud({ mapName: this.map.displayName, playerName: PLAYER_NAME, starter: STORY_MONARI[id].name }); const renzoPick = STORY_MONARI[this.state.renzoStarter].name; this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Yo, so that’s your pick?' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: `Not bad. But if you’re choosing that one, I’m taking ${renzoPick}.` }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Meet me at the Training Field. Let’s see if your bond is real.' }, { speaker: 'Dr. Warren Ellis', portrait: this.portrait('warren_ellis'), text: 'Renzo never waits long. Head north to the Training Field when you’re ready.' }], () => this.buildMap()); }
  private handleRenzo(): void { if (this.mapId !== 'training_field') return; this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'There you are. I was starting to think you got scared.' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Your first bond is new. Mine is already battle-ready.' }, { speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Let’s make this quick. Show me what your partner can do.' }], () => this.startRivalBattle()); }
  private startRivalBattle(): void { if (!this.state.starter || !this.state.renzoStarter) { this.ui.showDialogue([{ speaker: 'Renzo', portrait: this.portrait('renzo'), text: 'Get a partner from the Bond Lab first.' }]); return; } const ctx: ClassicBattleContext = { returnMap: 'training_field', returnSpawn: 'south', playerMinariId: this.state.starter, enemyMinariId: this.state.renzoStarter, bondable: false, battleType: 'rival', playerLevel: 7, enemyLevel: 8 }; this.registry.set('classic_battle_context', ctx); this.scene.start('ClassicSoulDuelScene'); }
  private showWildEncounter(): void { const ids = Object.keys(STORY_MONARI) as StoryMonariDef['id'][]; const id = ids[Math.floor(Math.random() * ids.length)]; const level = Phaser.Math.Between(7, 10); this.ui.showDialogue([{ speaker: 'Soul Orb', text: `A wild ${STORY_MONARI[id].name} appeared! Lv.${level}. Battle bonding will unlock in the next story pass.` }]); }
  private showMenuStub(): void { this.ui.showDialogue([{ speaker: 'Bonder Menu', text: this.state.starter ? `Partner: ${STORY_MONARI[this.state.starter].name}. Full menu coming soon.` : 'Choose a partner in the Bond Lab. Full menu coming soon.' }]); }
  private debugSpriteAudit(reason: string): void { const f = this.player?.frame; console.info('[story-overworld-sprites]', { reason, scene: this.scene.key, map: this.mapId, cameraZoom: this.cameras.main.zoom, playerTexture: this.player?.texture.key, playerTextureSize: f ? `${f.realWidth}x${f.realHeight}` : 'none', playerDisplay: this.player ? `${Math.round(this.player.displayWidth)}x${Math.round(this.player.displayHeight)}` : 'none', playerScale: this.player ? `${this.player.scaleX.toFixed(3)},${this.player.scaleY.toFixed(3)}` : 'none' }); }
}
