import Phaser from 'phaser';

export interface BattleInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
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
  private touchVector = { x: 0, y: 0 };

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
      s:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
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

  getBattleInput(): BattleInput {
    const k = this.keys;
    return {
      left:       k.left.isDown,
      right:      k.right.isDown,
      up:         Phaser.Input.Keyboard.JustDown(k.up),
      down:       k.down.isDown || k.s.isDown,
      coreAttack: Phaser.Input.Keyboard.JustDown(k.j),
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

  setTouchMovement(x: number, y: number): void {
    this.touchVector.x = Phaser.Math.Clamp(x, -1, 1);
    this.touchVector.y = Phaser.Math.Clamp(y, -1, 1);
  }

  getOverworldVector(): { x: number; y: number } {
    const k = this.keys;
    let x = this.touchVector.x;
    let y = this.touchVector.y;
    if (k.left.isDown) x = -1;
    else if (k.right.isDown) x = 1;
    if (k.up.isDown) y = -1;
    else if (k.down.isDown) y = 1;
    const len = Math.sqrt(x * x + y * y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  // Overworld movement — does NOT consume JustDown for interact keys
  getOverworldMove(): { left: boolean; right: boolean; up: boolean; down: boolean } {
    const k = this.keys;
    return {
      left:  k.left.isDown || this.touchVector.x < -0.25,
      right: k.right.isDown || this.touchVector.x > 0.25,
      up:    k.up.isDown || this.touchVector.y < -0.25,
      down:  k.down.isDown || this.touchVector.y > 0.25,
    };
  }

  isJustDown(key: string): boolean {
    return this.keys[key] ? Phaser.Input.Keyboard.JustDown(this.keys[key]) : false;
  }

  isDown(key: string): boolean {
    return this.keys[key]?.isDown ?? false;
  }

  destroy(): void {
    Object.values(this.keys).forEach(k => k.destroy());
  }
}
