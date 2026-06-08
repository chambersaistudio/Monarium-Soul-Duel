import Phaser from 'phaser';

const MODES = [
  {
    key:  'ClassicSoulDuelScene',
    name: 'Classic Soul Duel',
    desc: 'Turn-based command battle — choose moves, watch them play out.',
  },
  {
    key:  'OverworldScene',
    name: 'Arena Duel',
    desc: 'Real-time action prototype (original battle mode).',
  },
];

export class ModeSelectScene extends Phaser.Scene {
  private cursor     = 0;
  private labels:    Phaser.GameObjects.Text[] = [];
  private upKey!:    Phaser.Input.Keyboard.Key;
  private downKey!:  Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private justMoved  = false;

  constructor() { super({ key: 'ModeSelectScene' }); }

  create(): void {
    const { width: w, height: h } = this.scale;

    // Background gradient
    const bg = this.add.graphics();
    for (let i = 0; i < h; i += 4) {
      const t = i / h;
      const r = Math.floor(Phaser.Math.Linear(8, 18, t));
      const g = Math.floor(Phaser.Math.Linear(4, 6,  t));
      const b = Math.floor(Phaser.Math.Linear(18, 8, t));
      bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      bg.fillRect(0, i, w, 4);
    }

    this.add.text(w / 2, 80, 'SELECT MODE', {
      fontSize: '36px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(w / 2, 124, 'Arrow Keys + Enter  /  Click', {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Mode cards
    const cardY = [240, 380];
    MODES.forEach((mode, i) => {
      const cy = cardY[i];

      // Card background
      const card = this.add.graphics();
      card.fillStyle(0x111122, 0.85);
      card.fillRoundedRect(w / 2 - 240, cy - 50, 480, 90, 10);
      card.lineStyle(2, 0x333355, 1);
      card.strokeRoundedRect(w / 2 - 240, cy - 50, 480, 90, 10);

      const label = this.add.text(w / 2, cy - 16, mode.name, {
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(w / 2, cy + 18, mode.desc, {
        fontSize: '12px', color: '#888899', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.labels.push(label);

      // Click / tap to select
      card.setInteractive(
        new Phaser.Geom.Rectangle(w / 2 - 240, cy - 50, 480, 90),
        Phaser.Geom.Rectangle.Contains,
      );
      card.on('pointerdown', () => { this.cursor = i; this.confirmSelection(); });
      card.on('pointerover', () => { this.cursor = i; this.updateCursor(); });
    });

    // Cursor arrow
    this.add.text(w / 2 - 260, cardY[0], '▶', {
      fontSize: '18px', color: '#ff6600', fontFamily: 'monospace',
    }).setOrigin(0.5).setName('cursor_arrow_0');
    this.add.text(w / 2 - 260, cardY[1], '▶', {
      fontSize: '18px', color: '#ff6600', fontFamily: 'monospace',
    }).setOrigin(0.5).setName('cursor_arrow_1');

    this.add.text(w / 2, h - 30, '← Back to Title: ESC', {
      fontSize: '10px', color: '#444444', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.upKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('TitleScene');
      });
    });

    this.updateCursor();
  }

  private updateCursor(): void {
    const cardY = [240, 380];
    this.labels.forEach((lbl, i) => {
      lbl.setColor(i === this.cursor ? '#ff9944' : '#ffffff');
    });
    const arrows = this.children.list.filter(
      c => c.name === 'cursor_arrow_0' || c.name === 'cursor_arrow_1',
    ) as Phaser.GameObjects.Text[];
    arrows.forEach(a => {
      const idx = a.name === 'cursor_arrow_0' ? 0 : 1;
      a.setAlpha(idx === this.cursor ? 1 : 0.15);
      a.setY(cardY[idx]);
    });
  }

  private confirmSelection(): void {
    const dest = MODES[this.cursor].key;
    this.cameras.main.fade(350, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start(dest);
    });
  }

  update(): void {
    const upDown = Phaser.Input.Keyboard.JustDown(this.upKey);
    const dnDown = Phaser.Input.Keyboard.JustDown(this.downKey);
    const ok     = Phaser.Input.Keyboard.JustDown(this.enterKey);

    if (upDown)   { this.cursor = (this.cursor - 1 + MODES.length) % MODES.length; this.updateCursor(); }
    if (dnDown)   { this.cursor = (this.cursor + 1) % MODES.length; this.updateCursor(); }
    if (ok)       { this.confirmSelection(); }
  }
}
