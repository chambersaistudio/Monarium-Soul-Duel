import Phaser from 'phaser';

export interface BattleInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  leftJustDown: boolean;
  rightJustDown: boolean;
  coreAttack: boolean;
  special: boolean;
  dodge: boolean;
  ability: boolean;
  ultimate: boolean;
  slot1: boolean;
  slot2: boolean;
  slot3: boolean;
  slot4: boolean;
}

export interface OverworldInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  interact: boolean;
  pause: boolean;
}

export class InputSystem {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private scene: Phaser.Scene;

  // Touch state — set by VirtualDpad
  private touchMove = { left: false, right: false, up: false, down: false };
  private touchVector = { x: 0, y: 0 };
  private touchInteractPending = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupKeys();
  }

  private setupKeys(): void {
    const kb = this.scene.input.keyboard!;
    this.keys = {
      left:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up:      kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      j:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      k:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      l:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      i:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      u:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.U),
      w:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      e:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      enter:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      esc:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      one:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      three:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      four:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      numpad0: kb.addKey(96),
      numpad1: kb.addKey(97),
      numpad2: kb.addKey(98),
      numpad3: kb.addKey(99),
    };
  }

  // ── Touch state setters (called by VirtualDpad) ──────────────────────────

  setTouchMove(dx: number, dy: number): void {
    const dead = 0.01;
    this.touchVector.x = Math.abs(dx) > dead ? Phaser.Math.Clamp(dx, -1, 1) : 0;
    this.touchVector.y = Math.abs(dy) > dead ? Phaser.Math.Clamp(dy, -1, 1) : 0;
    this.touchMove.left  = this.touchVector.x < -dead;
    this.touchMove.right = this.touchVector.x > dead;
    this.touchMove.up    = this.touchVector.y < -dead;
    this.touchMove.down  = this.touchVector.y > dead;
  }

  triggerTouchInteract(): void {
    this.touchInteractPending = true;
  }

  // ── Input queries ────────────────────────────────────────────────────────

  getBattleInput(): BattleInput {
    const k = this.keys;
    return {
      left:          k.left.isDown,
      right:         k.right.isDown,
      up:            Phaser.Input.Keyboard.JustDown(k.up),
      down:          k.down.isDown || k.s.isDown,
      leftJustDown:  Phaser.Input.Keyboard.JustDown(k.left),
      rightJustDown: Phaser.Input.Keyboard.JustDown(k.right),
      coreAttack:    Phaser.Input.Keyboard.JustDown(k.j),
      special:    Phaser.Input.Keyboard.JustDown(k.k),
      dodge:      Phaser.Input.Keyboard.JustDown(k.l),
      ability:    Phaser.Input.Keyboard.JustDown(k.i),
      ultimate:   Phaser.Input.Keyboard.JustDown(k.u),
      slot1:      Phaser.Input.Keyboard.JustDown(k.one) || Phaser.Input.Keyboard.JustDown(k.numpad1),
      slot2:      Phaser.Input.Keyboard.JustDown(k.two) || Phaser.Input.Keyboard.JustDown(k.numpad2),
      slot3:      Phaser.Input.Keyboard.JustDown(k.three) || Phaser.Input.Keyboard.JustDown(k.numpad3),
      slot4:      Phaser.Input.Keyboard.JustDown(k.four) || Phaser.Input.Keyboard.JustDown(k.numpad0),
    };
  }

  // Overworld movement — merges arrow keys, WASD, and touch D-pad
  getOverworldMove(): { left: boolean; right: boolean; up: boolean; down: boolean } {
    const k = this.keys;
    return {
      left:  k.left.isDown  || k.a.isDown || this.touchMove.left,
      right: k.right.isDown || k.d.isDown || this.touchMove.right,
      up:    k.up.isDown    || k.w.isDown || this.touchMove.up,
      down:  k.down.isDown  || k.s.isDown || this.touchMove.down,
    };
  }


  getOverworldVector(): { x: number; y: number } {
    const k = this.keys;
    const keyX = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const keyY = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (keyX !== 0 || keyY !== 0) return { x: keyX, y: keyY };
    return { x: this.touchVector.x, y: this.touchVector.y };
  }

  // isJustDown merges keyboard and touch interact for 'enter'/'e'
  isJustDown(key: string): boolean {
    const kbDown = this.keys[key] ? Phaser.Input.Keyboard.JustDown(this.keys[key]) : false;
    if ((key === 'enter' || key === 'e') && this.touchInteractPending) {
      this.touchInteractPending = false;
      return true;
    }
    return kbDown;
  }

  isDown(key: string): boolean {
    return this.keys[key]?.isDown ?? false;
  }

  destroy(): void {
    Object.values(this.keys).forEach(k => k.destroy());
  }
}
