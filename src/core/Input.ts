/**
 * Minimal input manager:
 * - Keyboard states
 * - Pointer lock mouse deltas
 */
export class Input {
  private keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  mouseDown = false;

  constructor(private readonly el: HTMLElement) {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Track mouse button (useful if you later want click interactions)
    window.addEventListener("mousedown", () => (this.mouseDown = true));
    window.addEventListener("mouseup", () => (this.mouseDown = false));

    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
