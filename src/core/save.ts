// Сохранения в localStorage. Обёртка позволяет позже подключить облачные сохранения площадки.
import type { BoosterKind } from '../economy/catalog';
import type { Quality } from './config';
import { bus } from './events';

export interface SaveData {
  version: number;
  coins: number;
  maxLevel: number; // максимальный открытый уровень
  stars: Record<number, number>;
  bestTime: Record<number, number>;
  owned: string[]; // id купленных предметов с префиксами: v:, c:, p:, t:
  adProgress: Record<string, number>; // прогресс 0..3 для предметов за рекламу
  vehicle: string;
  character: string;
  paint: string;
  trail: string;
  boosters: Record<BoosterKind, number>;
  settings: {
    music: number;
    sfx: number;
    quality: Quality;
    vibration: boolean;
    lang: 'ru' | 'en';
  };
  lastDailyGift: number;
  sessions: number;
  totalDeaths: number;
}

const KEY = 'bobby-rider-save-v1';

function defaults(): SaveData {
  const lang = (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  return {
    version: 1,
    coins: 0,
    maxLevel: 1,
    stars: {},
    bestTime: {},
    owned: ['v:bmx', 'c:bobby', 'c:lily', 'p:default', 'p:red', 'p:blue', 'p:green', 't:dust'],
    adProgress: {},
    vehicle: 'bmx',
    character: 'bobby',
    paint: 'default',
    trail: 'dust',
    boosters: { shield: 1, magnet: 1, x2: 0, superjump: 1, nitro: 1 },
    settings: { music: 0.6, sfx: 0.8, quality: 'auto', vibration: true, lang },
    lastDailyGift: 0,
    sessions: 0,
    totalDeaths: 0,
  };
}

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...d,
      ...parsed,
      settings: { ...d.settings, ...(parsed.settings ?? {}) },
      boosters: { ...d.boosters, ...(parsed.boosters ?? {}) },
    };
  } catch {
    return d;
  }
}

export const save: SaveData = load();

let pending = 0;
export function persist(): void {
  // Отложенная запись, чтобы не писать в storage на каждое изменение.
  if (pending) return;
  pending = window.setTimeout(() => {
    pending = 0;
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      /* storage недоступен — играем без сохранений */
    }
  }, 150);
}

export function addCoins(n: number): void {
  save.coins = Math.max(0, Math.round(save.coins + n));
  persist();
  bus.emit('coins', save.coins);
}

export function spendCoins(n: number): boolean {
  if (save.coins < n) return false;
  addCoins(-n);
  return true;
}

export const isOwned = (key: string) => save.owned.includes(key);
export function grant(key: string): void {
  if (!save.owned.includes(key)) save.owned.push(key);
  persist();
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  location.reload();
}
