// Базовые элементы UI: корень, тосты, модальные окна, плашка монет.
import { bus } from '../core/events';
import { save } from '../core/save';
import { btn, coinIcon, fmtNum, h, icon } from './dom';

export const uiRoot = () => document.getElementById('ui')!;

let toastBox: HTMLElement | null = null;

export function toast(text: string, kind: '' | 'good' | 'big' = '', ms = 1600): void {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts' });
    uiRoot().appendChild(toastBox);
  }
  const el = h('div', { class: `toast ${kind}` }, text);
  toastBox.appendChild(el);
  setTimeout(() => el.classList.add('hide'), ms);
  setTimeout(() => el.remove(), ms + 450);
  while (toastBox.children.length > 3) toastBox.firstElementChild?.remove();
}

bus.on('toast', (text: string, kind?: '' | 'good' | 'big') => toast(text, kind ?? ''));

export interface Modal {
  el: HTMLElement;
  panel: HTMLElement;
  close(): void;
}

let modalStack: Modal[] = [];

export function modal(children: (Node | null | false)[], opts: { cls?: string; onClose?: () => void; closable?: boolean } = {}): Modal {
  const panel = h('div', { class: `panel ${opts.cls ?? ''}` });
  for (const c of children) if (c) panel.appendChild(c);
  const el = h('div', { class: 'modal' }, panel);
  const m: Modal = {
    el,
    panel,
    close: () => {
      el.remove();
      modalStack = modalStack.filter((x) => x !== m);
      opts.onClose?.();
    },
  };
  if (opts.closable) {
    panel.appendChild(btn(icon('left'), 'btn-round btn-red btn-small modal-close', () => m.close(), { 'aria-label': 'close' }));
  }
  uiRoot().appendChild(el);
  modalStack.push(m);
  return m;
}

export function closeAllModals(): void {
  for (const m of [...modalStack]) {
    m.el.remove();
  }
  modalStack = [];
}

export function hasModal(): boolean {
  return modalStack.length > 0;
}

/** Плашка с количеством монет, обновляется автоматически. */
export function coinPill(): HTMLElement {
  const val = h('span', {}, fmtNum(save.coins));
  const el = h('div', { class: 'pill coins' }, coinIcon(), val);
  let shown = save.coins;
  let raf = 0;
  bus.on('coins', (c: number) => {
    cancelAnimationFrame(raf);
    const from = shown, to = c, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 500);
      shown = Math.round(from + (to - from) * k);
      val.textContent = fmtNum(shown);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    step();
    el.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 });
  });
  return el;
}

export function screen(id: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = h('div', { class: 'screen', id });
    uiRoot().appendChild(el);
  }
  return el;
}

export function showScreen(id: string | null): void {
  document.querySelectorAll('#ui > .screen').forEach((s) => s.classList.toggle('show', s.id === id));
}
