// Главное меню и карта уровней.
import { CONFIG } from '../core/config';
import { save } from '../core/save';
import { THEMES, themeForLevel, worldIndex } from '../world/themes';
import type { App } from '../app';
import { btn, h, icon } from './dom';
import { t, tn } from './i18n';
import { coinPill, screen } from './base';

export class MenuScreen {
  el: HTMLElement;
  private levelTag: HTMLElement;
  private giftDot: HTMLElement;

  constructor(app: App) {
    this.el = screen('menu');
    this.levelTag = h('div', { class: 'level-tag' });
    this.giftDot = h('span', { class: 'dot-badge' });
    const title = h('div', { class: 'title', html: 'b<span class="o">O</span>bby<br>Rider' });

    const left = h('div', { class: 'side-col left' },
      h('div', { class: 'side-btn' }, btn(icon('gear'), 'btn-round btn-blue', () => app.openSettings()), t('settings')),
      h('div', { class: 'side-btn' }, h('div', { style: 'position:relative' }, btn(icon('gift'), 'btn-round btn-pink', () => app.openDailyGift()), this.giftDot), t('dailyGift')),
    );
    const right = h('div', { class: 'side-col right' },
      h('div', { class: 'side-btn' }, btn(icon('cart'), 'btn-round btn-orange', () => app.goShop('vehicles')), t('shop')),
      h('div', { class: 'side-btn' }, btn(icon('bike'), 'btn-round btn-blue', () => app.goShop('vehicles')), t('vehicles')),
      h('div', { class: 'side-btn' }, btn(icon('person'), 'btn-round btn-blue', () => app.goShop('characters')), t('characters')),
    );

    this.el.replaceChildren(
      h('div', { class: 'topbar' }, h('div', { class: 'spacer' }), coinPill()),
      title,
      left,
      right,
      h('div', { class: 'menu-bottom' },
        this.levelTag,
        btn([icon('play'), t('play')], 'btn-green btn-big', () => app.playFromMenu()),
        h('div', { class: 'menu-row' },
          btn([icon('map'), t('levels')], 'btn-blue', () => app.goMap()),
          btn([icon('cart'), t('shop')], 'btn-orange', () => app.goShop('vehicles')),
        ),
      ),
    );
  }

  refresh(): void {
    const n = save.maxLevel;
    this.levelTag.textContent = `${t('level')} ${n} · ${tn(themeForLevel(n).name)}`;
    const giftReady = Date.now() - save.lastDailyGift > CONFIG.economy.dailyGiftHours * 3600_000;
    this.giftDot.style.display = giftReady ? '' : 'none';
  }
}

const WORLD_COLORS = ['#4caf50', '#ff5fa8', '#ff8a3d', '#7c4dff', '#29b6f6'];

export class MapScreen {
  el: HTMLElement;
  private scroll: HTMLElement;
  private path: HTMLElement;
  private rendered = 0;

  constructor(private app: App) {
    this.el = screen('map');
    this.path = h('div', { class: 'map-path' });
    this.scroll = h('div', { class: 'map-scroll scrollable' }, this.path);
    this.scroll.addEventListener('scroll', () => {
      if (this.scroll.scrollTop + this.scroll.clientHeight > this.scroll.scrollHeight - 300) this.renderMore(10);
    });
    this.el.replaceChildren(
      this.scroll,
      h('div', { class: 'topbar' },
        btn(icon('home'), 'btn-round btn-blue', () => app.goMenu()),
        h('div', { class: 'subtitle', style: 'margin-left:6px' }, t('levels')),
        h('div', { class: 'spacer' }),
        coinPill(),
      ),
    );
  }

  refresh(): void {
    this.path.replaceChildren();
    this.rendered = 0;
    this.renderMore(Math.max(30, save.maxLevel + 12));
    // прокрутка к текущему уровню
    requestAnimationFrame(() => {
      const cur = this.path.querySelector('.lvl-node.current') as HTMLElement | null;
      if (cur) this.scroll.scrollTop = cur.parentElement!.offsetTop - this.scroll.clientHeight / 2 + 60;
    });
  }

  private renderMore(count: number): void {
    const end = this.rendered + count;
    for (let n = this.rendered + 1; n <= end; n++) {
      if ((n - 1) % 10 === 0) {
        const wi = worldIndex(n);
        const th = THEMES[wi % THEMES.length];
        const round = Math.floor(wi / THEMES.length);
        const name = tn(th.name) + (round > 0 ? ` ${'I'.repeat(Math.min(round + 1, 3))}` : '');
        const endless = n > CONFIG.handcraftedLevels ? ` · ${t('endless')}` : '';
        this.path.appendChild(h('div', { class: 'world-head', style: `background:${WORLD_COLORS[wi % WORLD_COLORS.length]}` }, `${t('world')} ${wi + 1}: ${name}${endless}`));
      }
      this.path.appendChild(this.node(n));
    }
    this.rendered = end;
  }

  private node(n: number): HTMLElement {
    const locked = n > save.maxLevel;
    const current = n === save.maxLevel;
    const x = 50 + Math.sin(n * 0.9) * 28;
    const color = WORLD_COLORS[worldIndex(n) % WORLD_COLORS.length];
    const stars = save.stars[n] ?? 0;
    const node = h('div', {
      class: `lvl-node ${locked ? 'locked' : ''} ${current ? 'current' : ''}`,
      style: `left:calc(${x}% - 39px);background:radial-gradient(circle at 35% 30%, #ffffff66, ${color} 60%)`,
      onclick: () => {
        if (!locked) this.app.openLevel(n);
      },
    },
      locked ? icon('lock', 'lk') : String(n),
      !locked && n < save.maxLevel ? h('div', { class: 'mini-stars' }, ...[0, 1, 2].map((i) => icon('star', i < stars ? 'on' : ''))) : null,
    );
    const row = h('div', { class: 'lvl-row' }, node);
    // точки-дорожка к следующему
    const nx = 50 + Math.sin((n + 1) * 0.9) * 28;
    for (let k = 1; k <= 2; k++) {
      const px = x + ((nx - x) * k) / 3;
      row.appendChild(h('div', { class: 'lvl-dot', style: `left:calc(${px}% - 6px);top:${84 + k * 4}px` }));
    }
    return row;
  }
}
