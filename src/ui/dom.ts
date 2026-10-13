// Мини-хелперы DOM и SVG-иконки (всё в коде, без файлов).
import { sfx } from '../audio/sfx';
import { audio } from '../audio/engine';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Кнопка со звуком клика. */
export function btn(label: Child | Child[], cls: string, onClick: () => void, extra: Attrs = {}): HTMLButtonElement {
  return h('button', {
    class: `btn ${cls}`,
    onclick: (e: Event) => {
      e.stopPropagation();
      audio.unlock();
      sfx.click();
      onClick();
    },
    ...extra,
  }, ...(Array.isArray(label) ? label : [label]));
}

export function icon(name: keyof typeof ICONS, cls = ''): HTMLElement {
  const s = h('span', { class: `ico ${cls}`, html: ICONS[name] });
  return s;
}

export const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.2 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h2.2l2.3 10.2A2 2 0 0 0 9.4 16H18a2 2 0 0 0 1.9-1.4L22 8H7"/><path d="M3 4h2.2l2.3 10.2A2 2 0 0 0 9.4 16H18a2 2 0 0 0 1.9-1.4L22 8H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="10" cy="20" r="1.8" fill="currentColor"/><circle cx="17" cy="20" r="1.8" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3 3 5.5v15.5l6-2.5 6 2.5 6-2.5V3l-6 2.5zm0 2.2 6 2.5v13l-6-2.5z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"/><path fill="currentColor" d="M20.5 3v7h-7z"/></svg>',
  film: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="15" height="14" rx="3" fill="currentColor"/><path fill="currentColor" d="m18 10 4-2.5v9L18 14z"/><path fill="#fff" d="M8 9v6l5-3z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8l-6.3 3.6 1.5-7.1L1.8 9.4 9 8.6z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="3" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-8.5-5.3-8.5-11.3A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 3.1C20.5 15.7 12 21 12 21z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a9 9 0 0 0-9 9c0 3 1.4 5 3.5 6.3V21h3v-2h1v2h3v-2h1v2h3v-3.7C19.6 16 21 14 21 11a9 9 0 0 0-9-9zM8.5 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 18.5a3 3 0 1 1-2-2.8V5l12-2.5v13a3 3 0 1 1-2-2.8V6.9L9 8.6z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 9h4l5-4.5v15L7 15H3z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
  ff: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 5.5v13l9-6.5zM12 5.5v13l9-6.5z"/></svg>',
  bike: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 9 9h7l2.5 7M9 9l3.5 7L16 9M8 6h3"/></g></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.5" fill="currentColor"/><path fill="currentColor" d="M4 21a8 8 0 0 1 16 0z"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0 0 20c1.4 0 2-1 2-2 0-1.6-1.5-1.8-1.5-3s1-2 2.5-2H18a4 4 0 0 0 4-4c0-5-4.5-9-10-9z"/><circle cx="7" cy="11" r="1.6" fill="#ff4f9a"/><circle cx="10" cy="6.5" r="1.6" fill="#ffd54f"/><circle cx="15" cy="6.5" r="1.6" fill="#4fc3f7"/><circle cx="18" cy="10.5" r="1.6" fill="#66ff8a"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  coins: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="5" rx="1" fill="currentColor"/><rect x="5" y="14" width="14" height="8" rx="1" fill="currentColor"/><path d="M12 9v13" stroke="#fff" stroke-width="2.4"/><path fill="none" stroke="currentColor" stroke-width="2.2" d="M12 9C9 9 6.5 7.5 7.5 5.2 8.6 3 11 5.5 12 9c1-3.5 3.4-6 4.5-3.8C17.5 7.5 15 9 12 9z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="4" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.5 5 5 10-11"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>',
  magnet: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="4.2" d="M6 3v8a6 6 0 0 0 12 0V3"/><path stroke="#fff" stroke-width="4.2" d="M6 3v3M18 3v3"/></svg>',
  x2: '<svg viewBox="0 0 24 24"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial" fill="currentColor">x2</text></svg>',
  jump: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 4 12h5v9h6v-9h5z"/></svg>',
  nitro: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 2-5 0 2 1 3 2 3 0-4 1-7 2-10z"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 4 6.5 12l9 8z"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.5 4l9 8-9 8z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 15.5 12 6.5l8 9z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 8.5 12 17.5l8-9z"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19"/></svg>',
  trail: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m12 2 2 5 5 .5-4 3.5 1.2 5L12 13l-4.2 3 1.2-5-4-3.5L10 7z"/><circle cx="5" cy="20" r="1.6" fill="currentColor"/><circle cx="10" cy="21" r="1.2" fill="currentColor"/></svg>',
} as const;

export function coinIcon(): HTMLElement {
  return h('span', { class: 'coin-ico' });
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}
