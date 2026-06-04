export class Input {
  private held = new Set<string>();
  private tapped = new Set<string>();

  constructor() {
    addEventListener('keydown', (event) => {
      if (!this.held.has(event.code)) this.tapped.add(event.code);
      this.held.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    });
    addEventListener('keyup', (event) => this.held.delete(event.code));
    addEventListener('blur', () => this.held.clear());
  }

  down(...codes: string[]) { return codes.some((code) => this.held.has(code)); }
  pressed(...codes: string[]) { return codes.some((code) => this.tapped.has(code)); }
  endFrame() { this.tapped.clear(); }
}
