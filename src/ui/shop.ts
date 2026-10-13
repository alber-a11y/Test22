// Магазин: транспорт, персонажи, стиль (краска и следы), бустеры, монеты.
import { CONFIG } from '../core/config';
import { addCoins, grant, isOwned, persist, save, spendCoins } from '../core/save';
import { ads } from '../ads/ads';
import { sfx } from '../audio/sfx';
import {
  BOOSTERS, CHARACTERS, PAINTS, TRAILS, VEHICLES,
  type BoosterDef, type CharacterDef, type PaintDef, type Price, type TrailDef, type VehicleDef,
} from '../economy/catalog';
import type { App } from '../app';
import { btn, coinIcon, fmtNum, h, icon } from './dom';
import { t, tn } from './i18n';
import { coinPill, screen, toast } from './base';

export type ShopTab = 'vehicles' | 'characters' | 'style' | 'boosters' | 'coins';

interface Item {
  key: string;
  name: string;
  price: Price;
  thumb(): HTMLElement;
  preview?(): void;
  equip?(): void;
  equipped?(): boolean;
  details?(): HTMLElement | null;
  custom?: () => HTMLElement; // своя кнопка действия
  counter?: () => string;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const PAINT_NAMES: Record<string, { ru: string; en: string }> = {
  default: { ru: 'Родной', en: 'Original' }, red: { ru: 'Красный', en: 'Red' }, blue: { ru: 'Синий', en: 'Blue' },
  green: { ru: 'Зелёный', en: 'Green' }, yellow: { ru: 'Жёлтый', en: 'Yellow' }, orange: { ru: 'Оранжевый', en: 'Orange' },
  pink: { ru: 'Розовый', en: 'Pink' }, purple: { ru: 'Фиолетовый', en: 'Purple' }, black: { ru: 'Чёрный', en: 'Black' },
  white: { ru: 'Белый', en: 'White' }, gold: { ru: 'Золотой', en: 'Gold' }, rainbow: { ru: 'Радужный', en: 'Rainbow' },
};
const MAX = { speed: 16.5, accel: 32, jump: 11.6, turn: 3.4 };

export class ShopScreen {
  el: HTMLElement;
  private tab: ShopTab = 'vehicles';
  private grid: HTMLElement;
  private detail: HTMLElement;
  private tabs: HTMLElement;
  private sel: Item | null = null;
  private items: Item[] = [];
  private lastFreeCoins = -Infinity;

  constructor(private app: App) {
    this.el = screen('shop');
    this.grid = h('div', { class: 'grid scrollable' });
    this.detail = h('div', { class: 'shop-detail' });
    this.tabs = h('div', { class: 'tabs' });
    this.el.replaceChildren(
      h('div', { class: 'topbar' },
        btn(icon('left'), 'btn-round btn-blue', () => app.closeShop()),
        h('div', { class: 'subtitle', style: 'margin-left:6px' }, t('shop')),
        h('div', { class: 'spacer' }),
        coinPill(),
      ),
      h('div', { class: 'shop-panel panel' }, this.tabs, this.grid, this.detail),
    );
  }

  open(tab: ShopTab): void {
    this.tab = tab;
    this.render();
  }

  private renderTabs(): void {
    const defs: [ShopTab, string, keyof typeof import('./dom').ICONS][] = [
      ['vehicles', t('vehicles'), 'bike'],
      ['characters', t('characters'), 'person'],
      ['style', t('style'), 'palette'],
      ['boosters', t('boosters'), 'bolt'],
      ['coins', t('getCoins'), 'coins'],
    ];
    this.tabs.replaceChildren(
      ...defs.map(([id, label, ic]) =>
        h('button', {
          class: `tab ${this.tab === id ? 'on' : ''}`,
          onclick: () => {
            sfx.click();
            this.tab = id;
            this.render();
          },
        }, icon(ic), label),
      ),
    );
  }

  render(): void {
    this.renderTabs();
    this.items = this.buildItems();
    const eq = this.items.find((i) => i.equipped?.()) ?? this.items[0];
    if (!this.sel || !this.items.some((i) => i.key === this.sel!.key)) this.sel = eq;
    else this.sel = this.items.find((i) => i.key === this.sel!.key)!;
    this.renderGrid();
    this.renderDetail();
    this.sel?.preview?.();
    if (!this.sel?.preview) this.app.stage.setShowcaseRider();
  }

  private renderGrid(): void {
    this.grid.replaceChildren(
      ...this.items.map((it) => {
        const card = h('div', {
          class: `card ${this.sel?.key === it.key ? 'sel' : ''} ${it.equipped?.() ? 'equipped' : ''}`,
          onclick: () => {
            sfx.click();
            this.sel = it;
            it.preview?.();
            this.renderGrid();
            this.renderDetail();
          },
        }, it.thumb(), h('div', { class: 'name' }, it.name), this.priceTag(it));
        return card;
      }),
    );
  }

  private owned(it: Item): boolean {
    return 'free' in it.price || isOwned(it.key);
  }

  private priceTag(it: Item): HTMLElement {
    if (it.counter) return h('div', { class: 'tagline' }, it.counter());
    if (this.owned(it)) return h('div', { class: 'tagline' }, it.equipped?.() ? t('selected') : t('owned'));
    if ('coins' in it.price) return h('div', { class: 'price' }, coinIcon(), fmtNum(it.price.coins));
    if ('ads' in it.price) {
      const p = save.adProgress[it.key] ?? 0;
      return h('div', { class: 'price ad' }, icon('film'), h('div', { class: 'adprog' }, ...Array.from({ length: it.price.ads }, (_, i) => h('i', { class: i < p ? 'on' : '' }))));
    }
    return h('div');
  }

  private renderDetail(): void {
    const it = this.sel;
    if (!it) {
      this.detail.replaceChildren();
      return;
    }
    const info = h('div', { class: 'info' }, h('b', {}, it.name), it.details?.() ?? null);
    this.detail.replaceChildren(info, it.custom ? it.custom() : this.actionButton(it));
  }

  private actionButton(it: Item): HTMLElement {
    if (this.owned(it)) {
      if (it.equipped?.()) return btn([icon('check'), t('selected')], 'btn-ghost', () => {}, { disabled: true });
      return btn(t('select'), 'btn-green', () => {
        it.equip?.();
        persist();
        this.render();
      });
    }
    if ('coins' in it.price) {
      const price = it.price.coins;
      return btn([t('buy'), coinIcon(), fmtNum(price)], save.coins >= price ? 'btn-orange' : 'btn-ghost', () => {
        if (!spendCoins(price)) {
          sfx.error();
          toast(t('notEnoughCoins'));
          return;
        }
        grant(it.key);
        sfx.buy();
        toast(`${t('unlockedNew')} ${it.name}`, 'good');
        it.equip?.();
        persist();
        this.render();
      });
    }
    if ('ads' in it.price) {
      const need = it.price.ads;
      const p = save.adProgress[it.key] ?? 0;
      return btn([icon('film'), `${t('watch')} ${p}/${need}`], 'btn-purple', async () => {
        const ok = await ads.rewarded(`unlock_${it.key}`);
        if (!ok) return;
        const np = (save.adProgress[it.key] ?? 0) + 1;
        save.adProgress[it.key] = np;
        if (np >= need) {
          grant(it.key);
          sfx.buy();
          toast(`${t('unlockedNew')} ${it.name}`, 'good');
          it.equip?.();
        } else {
          sfx.reward();
          toast(`${np}/${need}`, 'good');
        }
        persist();
        this.render();
      });
    }
    return h('div');
  }

  // ---------------------------------------------------------------- наполнение вкладок

  private buildItems(): Item[] {
    switch (this.tab) {
      case 'vehicles':
        return VEHICLES.map((v) => this.vehicleItem(v));
      case 'characters':
        return CHARACTERS.map((c) => this.characterItem(c));
      case 'style':
        return [...PAINTS.map((p) => this.paintItem(p)), ...TRAILS.map((tr) => this.trailItem(tr))];
      case 'boosters':
        return BOOSTERS.map((b) => this.boosterItem(b));
      case 'coins':
        return this.coinItems();
    }
  }

  private thumbImg(url: string, bg: string): HTMLElement {
    return h('div', { class: 'thumb', style: `background:${bg}` }, h('img', { src: url, style: 'width:100%;height:100%;object-fit:contain', draggable: 'false' }));
  }

  private vehicleItem(v: VehicleDef): Item {
    const stats = h('div', { class: 'statbars' },
      ...([[t('speed'), v.maxSpeed / MAX.speed], [t('accel'), v.accel / MAX.accel], [t('jump'), v.jump / MAX.jump], [t('handling'), v.turn / MAX.turn]] as [string, number][]).flatMap(([k, val]) => [
        h('span', {}, k),
        h('div', { class: 'bar' }, h('div', { style: `width:${Math.round(val * 100)}%` })),
      ]),
    );
    return {
      key: `v:${v.id}`,
      name: tn(v.name),
      price: v.price,
      thumb: () => this.thumbImg(this.app.stage.vehicleThumb(v), 'linear-gradient(180deg,#e3f2ff,#b8dcff)'),
      preview: () => this.app.stage.setShowcaseRider(v),
      equip: () => (save.vehicle = v.id),
      equipped: () => save.vehicle === v.id,
      details: () => stats,
    };
  }

  private characterItem(c: CharacterDef): Item {
    return {
      key: `c:${c.id}`,
      name: tn(c.name),
      price: c.price,
      thumb: () => this.thumbImg(this.app.stage.characterThumb(c), c.gender === 'girl' ? 'linear-gradient(180deg,#ffe3f1,#ffb8dc)' : 'linear-gradient(180deg,#e3f2ff,#b8dcff)'),
      preview: () => this.app.stage.setShowcaseRider(undefined, c),
      equip: () => (save.character = c.id),
      equipped: () => save.character === c.id,
    };
  }

  private paintItem(p: PaintDef): Item {
    const bg = p.rainbow
      ? 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)'
      : p.color < 0 ? 'linear-gradient(135deg,#ddd 50%,#999 50%)' : hex(p.color);
    return {
      key: `p:${p.id}`,
      name: PAINT_NAMES[p.id] ? tn(PAINT_NAMES[p.id]) : t('paint'),
      price: p.price,
      thumb: () => h('div', { class: 'thumb' }, h('div', { class: 'swatch', style: `background:${bg}` })),
      preview: () => this.app.stage.setShowcaseRider(undefined, undefined, p),
      equip: () => (save.paint = p.id),
      equipped: () => save.paint === p.id,
    };
  }

  private trailItem(tr: TrailDef): Item {
    const colors: Record<string, string> = { dust: '#c9d6e8', stars: '#ffd54f', hearts: '#ff5fa8', bubbles: '#80deea', fire: '#ff7043', rainbow: 'linear-gradient(135deg,#ff5252,#ffd740,#69f0ae,#40c4ff,#e040fb)' };
    const glyph: Record<string, string> = { dust: '💨', stars: '⭐', hearts: '💖', bubbles: '🫧', fire: '🔥', rainbow: '🌈' };
    return {
      key: `t:${tr.id}`,
      name: `${t('trails')}: ${tn(tr.name)}`,
      price: tr.price,
      thumb: () => h('div', { class: 'thumb', style: `background:${colors[tr.id]}` }, glyph[tr.id]),
      equip: () => (save.trail = tr.id),
      equipped: () => save.trail === tr.id,
    };
  }

  private boosterItem(b: BoosterDef): Item {
    return {
      key: `b:${b.id}`,
      name: tn(b.name),
      price: { coins: b.price },
      thumb: () => h('div', { class: 'thumb', style: 'background:linear-gradient(180deg,#e8f0ff,#c9dcff);color:#3b8bff' }, icon(b.icon as never)),
      counter: () => `× ${save.boosters[b.id] ?? 0}`,
      details: () => h('div', { class: 'tagline', style: 'text-align:left' }, tn(b.desc)),
      custom: () =>
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          btn([t('buy'), coinIcon(), fmtNum(b.price)], save.coins >= b.price ? 'btn-orange' : 'btn-ghost', () => {
            if (!spendCoins(b.price)) {
              sfx.error();
              toast(t('notEnoughCoins'));
              return;
            }
            save.boosters[b.id] = (save.boosters[b.id] ?? 0) + 1;
            persist();
            sfx.buy();
            this.render();
          }),
          btn([icon('film'), '+1'], 'btn-purple', async () => {
            if (!(await ads.rewarded(`booster_${b.id}`))) return;
            save.boosters[b.id] = (save.boosters[b.id] ?? 0) + 1;
            persist();
            sfx.reward();
            this.render();
          }),
        ),
    };
  }

  private coinItems(): Item[] {
    const e = CONFIG.economy;
    const free: Item = {
      key: 'x:freecoins',
      name: t('freeCoins'),
      price: { free: true },
      thumb: () => h('div', { class: 'thumb', style: 'background:linear-gradient(180deg,#fff3c4,#ffd36b)' }, coinIcon()),
      counter: () => `+${e.freeCoinsReward}`,
      custom: () => {
        const wait = Math.ceil(e.freeCoinsCooldown - (performance.now() / 1000 - this.lastFreeCoins));
        if (wait > 0) {
          setTimeout(() => this.tab === 'coins' && this.app.mode === 'shop' && this.renderDetail(), 1000);
          return btn(`${wait}s`, 'btn-ghost', () => {}, { disabled: true });
        }
        return btn([icon('film'), '+', coinIcon(), String(e.freeCoinsReward)], 'btn-purple', async () => {
          if (!(await ads.rewarded('free_coins'))) return;
          this.lastFreeCoins = performance.now() / 1000;
          addCoins(e.freeCoinsReward);
          sfx.reward();
          this.render();
        });
      },
    };
    const bag: Item = {
      key: 'x:coinbag',
      name: `${t('coins')} ×1000`,
      price: { free: true },
      thumb: () => h('div', { class: 'thumb', style: 'background:linear-gradient(180deg,#ffe0b2,#ffab40);font-size:34px' }, '💰'),
      counter: () => `${save.adProgress['x:coinbag'] ?? 0}/3`,
      custom: () =>
        btn([icon('film'), `${t('watch')} ${save.adProgress['x:coinbag'] ?? 0}/3`], 'btn-purple', async () => {
          if (!(await ads.rewarded('coin_bag'))) return;
          const p = (save.adProgress['x:coinbag'] ?? 0) + 1;
          if (p >= 3) {
            save.adProgress['x:coinbag'] = 0;
            addCoins(1000);
            sfx.buy();
            toast(`${t('youGot')} 1000`, 'good');
          } else {
            save.adProgress['x:coinbag'] = p;
            sfx.reward();
          }
          persist();
          this.render();
        }),
    };
    const gift: Item = {
      key: 'x:gift',
      name: t('dailyGift'),
      price: { free: true },
      thumb: () => h('div', { class: 'thumb', style: 'background:linear-gradient(180deg,#f8bbd0,#ff5fa8);color:#fff' }, icon('gift')),
      counter: () => '🎁',
      custom: () => btn([icon('gift'), t('open')], 'btn-pink', () => this.app.openDailyGift()),
    };
    return [free, bag, gift];
  }
}
