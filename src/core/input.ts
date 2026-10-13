// Ввод: клавиатура + сенсорные кнопки (со скольжением пальца между кнопками).

export type Action = 'gas' | 'brake' | 'left' | 'right' | 'jump' | 'nitro';

const KEYMAP: Record<string, Action> = {
  KeyW: 'gas', ArrowUp: 'gas',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro',
};

class Input {
  private keys = new Set<Action>();
  private touch = new Map<number, Action | null>();
  private pressedEdges = new Set<Action>();
  enabled = true;
  isTouch = false;
  onKey: ((code: string) => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.onKey?.(e.code);
      const a = KEYMAP[e.code];
      if (!a) return;
      if (!this.held(a)) this.pressedEdges.add(a);
      this.keys.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('touchstart', () => this.markTouch(), { passive: true });
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  private markTouch(): void {
    if (!this.isTouch) {
      this.isTouch = true;
      document.body.classList.add('touch');
    }
  }

  /** Подключает слой сенсорного управления: кнопки помечены data-action. */
  bindTouchLayer(layer: HTMLElement): void {
    const resolve = (x: number, y: number): Action | null => {
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        const a = (el as HTMLElement).dataset?.action as Action | undefined;
        if (a) return a;
        if (el === layer) break;
      }
      return null;
    };
    const update = (id: number, a: Action | null) => {
      const prev = this.touch.get(id);
      if (a && a !== prev && !this.held(a)) this.pressedEdges.add(a);
      this.touch.set(id, a);
      this.refreshTouchVisuals(layer);
    };
    layer.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.markTouch();
      e.preventDefault();
      update(e.pointerId, resolve(e.clientX, e.clientY));
    });
    layer.addEventListener('pointermove', (e) => {
      if (!this.touch.has(e.pointerId)) return;
      update(e.pointerId, resolve(e.clientX, e.clientY));
    });
    const end = (e: PointerEvent) => {
      this.touch.delete(e.pointerId);
      this.refreshTouchVisuals(layer);
    };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    // Мышью кнопки тоже нажимаются (удобно тестировать).
    layer.addEventListener('mousedown', (e) => {
      const a = resolve(e.clientX, e.clientY);
      if (!a) return;
      update(-1, a);
      const up = () => {
        this.touch.delete(-1);
        this.refreshTouchVisuals(layer);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mouseup', up);
    });
  }

  private refreshTouchVisuals(layer: HTMLElement): void {
    const active = new Set([...this.touch.values()].filter(Boolean));
    layer.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.classList.toggle('pressed', active.has(el.dataset.action as Action));
    });
  }

  held(a: Action): boolean {
    if (!this.enabled) return false;
    if (this.keys.has(a)) return true;
    for (const v of this.touch.values()) if (v === a) return true;
    // Кнопка прыжка на тач-экране одновременно жмёт газ — удобно двумя большими пальцами.
    if (a === 'gas') for (const v of this.touch.values()) if (v === 'jump') return true;
    return false;
  }

  /** true один раз после нажатия. */
  pressed(a: Action): boolean {
    if (!this.enabled) return false;
    if (this.pressedEdges.has(a)) {
      this.pressedEdges.delete(a);
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.pressedEdges.clear();
  }

  clear(): void {
    this.keys.clear();
    this.touch.clear();
    this.pressedEdges.clear();
    document.querySelectorAll('.pressed').forEach((el) => el.classList.remove('pressed'));
  }

  anyHeld(): boolean {
    return this.keys.size > 0 || [...this.touch.values()].some(Boolean);
  }
}

export const input = new Input();
