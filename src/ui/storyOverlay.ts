import { STORY_MONARI, type StoryGender, type StoryMonariDef } from '../data/storyMonari';
import { viewportCssSize } from '../config/highDpi';

export interface StoryHudState { mapName: string; playerName: string; starter?: string }
export interface StoryDialogueLine { speaker: string; text: string; portrait?: string }
export interface StarterPreviewState { monari: StoryMonariDef; gender: StoryGender; image?: string; onChoose: () => void; onCancel: () => void }

function ensureRoot(): HTMLElement {
  let root = document.getElementById('story-ui-overlay');
  if (!root) {
    root = document.createElement('div');
    root.id = 'story-ui-overlay';
    root.innerHTML = `
      <div class="story-hud"><div><b id="story-player">Corn</b><span id="story-partner">No partner</span></div><div id="story-map">Starter Village</div></div>
      <div id="story-prompt" class="story-prompt" hidden></div>
      <div id="story-dialogue" class="story-dialogue" hidden><img id="story-dialogue-portrait" alt=""><div class="story-dialogue-copy"><b id="story-dialogue-speaker"></b><p id="story-dialogue-text"></p><small>Tap</small></div></div>
      <div id="story-starter-card" class="story-starter-card" hidden></div>
      <button id="story-menu" class="story-menu-button" type="button">MENU</button><div class="story-controls"><div id="story-joy" class="story-joy"><div id="story-joy-thumb"></div></div><div class="story-actions"><button id="story-a" type="button">A</button></div></div>
    `;
    document.body.appendChild(root);
  }
  return root;
}

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }

export class StoryOverlayController {
  private root = ensureRoot();
  private dialogueQueue: StoryDialogueLine[] = [];
  private dialogueDone: (() => void) | null = null;
  private stickPointer: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private moveCb: (x: number, y: number) => void = () => {};
  private interactCb: () => void = () => {};
  private menuCb: () => void = () => {};
  private dialogueAdvance = (): void => this.advanceDialogue();

  constructor() {
    this.layout();
    window.addEventListener('resize', this.layout, { passive: true });
    window.visualViewport?.addEventListener('resize', this.layout, { passive: true });
    el<HTMLButtonElement>('story-a').onclick = () => this.interactCb();
    el<HTMLButtonElement>('story-menu').onclick = () => this.menuCb();
    const joy = el<HTMLDivElement>('story-joy');
    joy.onpointerdown = (e) => { this.stickPointer = e.pointerId; joy.setPointerCapture(e.pointerId); this.updateStick(e.clientX, e.clientY); };
    joy.onpointermove = (e) => { if (this.stickPointer === e.pointerId) this.updateStick(e.clientX, e.clientY); };
    joy.onpointerup = joy.onpointercancel = (e) => { if (this.stickPointer === e.pointerId) this.releaseStick(); };
  }

  setCallbacks(move: (x: number, y: number) => void, interact: () => void, menu: () => void): void {
    this.moveCb = move; this.interactCb = interact; this.menuCb = menu;
  }

  layout = (): void => {
    const vp = viewportCssSize();
    this.root.style.width = `${vp.width}px`;
    this.root.style.height = `${vp.height}px`;
  };

  setHud(state: StoryHudState): void {
    this.root.hidden = false;
    el('story-player').textContent = state.playerName;
    el('story-partner').textContent = state.starter ? `Partner: ${state.starter}` : 'Choose your first partner';
    el('story-map').textContent = state.mapName;
  }

  setPrompt(text: string | null): void {
    const prompt = el('story-prompt');
    prompt.hidden = !text;
    prompt.textContent = text ?? '';
  }

  showDialogue(lines: StoryDialogueLine[], done?: () => void): void {
    this.dialogueQueue = [...lines];
    this.dialogueDone = done ?? null;
    const box = el('story-dialogue');
    box.hidden = false;
    this.root.classList.add('story-dialogue-active');
    this.releaseStick();
    box.onclick = this.dialogueAdvance;
    this.advanceDialogue();
  }

  private advanceDialogue(): void {
    const line = this.dialogueQueue.shift();
    if (!line) {
      el('story-dialogue').hidden = true;
      this.root.classList.remove('story-dialogue-active');
      const done = this.dialogueDone;
      this.dialogueDone = null;
      done?.();
      return;
    }
    el('story-dialogue-speaker').textContent = line.speaker;
    el('story-dialogue-text').textContent = line.text;
    const img = el<HTMLImageElement>('story-dialogue-portrait');
    img.hidden = !line.portrait;
    if (line.portrait) img.src = line.portrait;
  }

  showStarterPreview(state: StarterPreviewState): void {
    const card = el('story-starter-card');
    card.hidden = false;
    this.root.classList.add('story-modal-active');
    this.releaseStick();
    const genderIcon = state.gender === 'male' ? 'assets/ui/icons/gender_male.png' : 'assets/ui/icons/gender_female.png';
    card.innerHTML = `
      <div class="story-starter-art">${state.image ? `<img src="${state.image}" alt="${state.monari.name}">` : ''}</div>
      <div class="story-starter-info">
        <h2>${state.monari.name}</h2>
        <div class="story-starter-meta"><img src="${state.monari.elementIcon}" alt=""> ${state.monari.elementLabel} <span>•</span> Lv.${state.monari.stats.level} <img src="${genderIcon}" alt="${state.gender}"></div>
        <p><strong>Role:</strong> ${state.monari.role}</p>
        <p>${state.monari.description}</p>
        <div class="story-stats">
          <span><b>HP</b> ${state.monari.stats.hp}</span>
          <span><b>Attack</b> ${state.monari.stats.attack}</span>
          <span><b>Defense</b> ${state.monari.stats.defense}</span>
          <span><b>Special Attack</b> ${state.monari.stats.specialAttack}</span>
          <span><b>Special Defense</b> ${state.monari.stats.specialDefense}</span>
          <span><b>Speed</b> ${state.monari.stats.speed}</span>
        </div>
        <div class="story-starter-buttons"><button id="story-choose">Choose as partner?</button><button id="story-cancel">Back</button></div>
      </div>`;
    el<HTMLButtonElement>('story-choose').onclick = state.onChoose;
    el<HTMLButtonElement>('story-cancel').onclick = state.onCancel;
  }

  hideStarterPreview(): void { el('story-starter-card').hidden = true; this.root.classList.remove('story-modal-active'); }
  isDialogueOpen(): boolean { return !el('story-dialogue').hidden || !el('story-starter-card').hidden; }
  handleAdvance(): void { if (!el('story-dialogue').hidden) this.advanceDialogue(); else this.interactCb(); }

  private updateStick(x: number, y: number): void {
    const joy = el<HTMLDivElement>('story-joy');
    const thumb = el<HTMLDivElement>('story-joy-thumb');
    const rect = joy.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const dx = x - this.joyCenter.x, dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy) || 1;
    const max = rect.width * 0.34;
    const clamped = Math.min(max, len);
    const nx = dx / len, ny = dy / len;
    thumb.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
    this.moveCb(nx * Math.min(1, len / max), ny * Math.min(1, len / max));
  }

  private releaseStick(): void {
    this.stickPointer = null;
    el<HTMLDivElement>('story-joy-thumb').style.transform = 'translate(-50%, -50%)';
    this.moveCb(0, 0);
  }

  destroy(): void {
    this.root.hidden = true;
    this.moveCb(0, 0);
    window.removeEventListener('resize', this.layout);
    window.visualViewport?.removeEventListener('resize', this.layout);
  }
}

export function starterPreviewImage(id: keyof typeof STORY_MONARI): string | undefined {
  const a = STORY_MONARI[id].assets;
  return a.profile ?? a.fullBody ?? a.overworld ?? a.battleIdle;
}
