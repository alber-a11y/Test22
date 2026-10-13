// Игровой HUD: таймер, падения, жизни, прогресс, монеты, кнопки, сенсорное управление.
import { CONFIG } from '../core/config';
import { bus } from '../core/events';
import { input } from '../core/input';
import type { HudState } from '../game/game';
import { themeForLevel } from '../world/themes';
import { btn, coinIcon, fmtNum, h, icon } from './dom';
import { fmtTime, t, tn } from './i18n';
import { screen } from './base';

export interface HudActions {
  pause(): void;
  skip(): void;
}

export class Hud {
  el: HTMLElement;
  private timer: HTMLElement;
  private deaths: HTMLElement;
  private hearts: HTMLElement;
  private fill: HTMLElement;
  private coins: HTMLElement;
  private label: HTMLElement;
  private nitro: HTMLElement;
  private speed: HTMLElement;
  private hint: HTMLElement;
  private placeEl: HTMLElement;
  private markers: HTMLElement;
  private lastLives = -1;
  private lastShield = false;

  constructor(actions: HudActions) {
    this.el = screen('hud');
    this.timer = h('div', { class: 'timer' }, '00:00.00');
    this.deaths = h('span', {}, '0');
    this.hearts = h('div', { class: 'hearts' });
    this.fill = h('div', { class: 'fill' });
    this.coins = h('span', {}, '0');
    this.label = h('div', { class: 'level-label' });
    this.nitro = h('div');
    this.speed = h('div', { class: 'speedlines' });
    this.placeEl = h('div', { class: 'race-place' });
    this.markers = h('div', { class: 'markers' });
    this.hint = h('div', {},
      h('div', { class: 'hud-hint keys' }, t('controlsHelp')),
      h('div', { class: 'hud-hint taps' }, `◀ ▶ — ${t('controls').toLowerCase()} · ${t('jump')} = ${t('jump').toLowerCase()} + ${t('gas').toLowerCase()}`),
    );

    const top = h('div', { class: 'hud-top' },
      h('div', { class: 'hud-left' },
        h('div', { style: 'display:flex;gap:8px;align-items:center' },
          btn(icon('pause'), 'btn-round btn-blue', () => actions.pause(), { 'aria-label': 'pause' }),
          this.timer,
        ),
        h('div', { class: 'stat' }, icon('skull'), this.deaths),
        this.hearts,
      ),
      h('div', { class: 'hud-center' },
        h('div', { class: 'progress-wrap' }, h('div', { class: 'progress' }, this.fill), this.markers),
        this.label,
        this.placeEl,
        h('div', { class: 'nitro-bar' }, this.nitro),
      ),
      h('div', { class: 'hud-right' },
        h('div', { class: 'pill coins' }, coinIcon(), this.coins),
        btn([icon('ff'), h('span', { class: 'ad-badge' }, icon('film'))], 'btn-purple btn-small', () => actions.skip(), { 'aria-label': 'skip level' }),
      ),
    );

    // Сенсорные кнопки
    const touch = h('div', { class: 'touch-layer' },
      h('div', { class: 'tbtn big', 'data-action': 'left', style: 'left:calc(16px + var(--safe-l));bottom:calc(20px + var(--safe-b))' }, icon('left')),
      h('div', { class: 'tbtn big', 'data-action': 'right', style: 'left:calc(16px + var(--safe-l) + clamp(84px,15vmin,120px) + 14px);bottom:calc(20px + var(--safe-b))' }, icon('right')),
      h('div', { class: 'tbtn small brake', 'data-action': 'brake', style: 'left:calc(26px + var(--safe-l));bottom:calc(36px + var(--safe-b) + clamp(84px,15vmin,120px))' }, icon('down')),
      h('div', { class: 'tbtn big jump', 'data-action': 'jump', style: 'right:calc(16px + var(--safe-r));bottom:calc(20px + var(--safe-b))' }, icon('jump'), h('span', {}, t('jump'))),
      h('div', { class: 'tbtn big gas', 'data-action': 'gas', style: 'right:calc(16px + var(--safe-r) + clamp(84px,15vmin,120px) + 14px);bottom:calc(20px + var(--safe-b))' }, icon('up'), h('span', {}, t('gas'))),
      h('div', { class: 'tbtn small nitro', 'data-action': 'nitro', style: 'right:calc(30px + var(--safe-r));bottom:calc(36px + var(--safe-b) + clamp(84px,15vmin,120px))' }, icon('nitro')),
    );
    input.bindTouchLayer(touch);

    this.el.replaceChildren(this.speed, touch, top, this.hint);

    bus.on('hud', (s: HudState, force: boolean) => this.update(s, force));
    bus.on('fx:speed', (k: number) => {
      this.speed.style.opacity = String(k * 0.55);
    });
    bus.on('game:go', () => this.showHint(false));
  }

  showHint(on: boolean): void {
    this.hint.style.display = on ? '' : 'none';
  }

  setLevel(n: number): void {
    this.label.textContent = `${t('level')} ${n} · ${tn(themeForLevel(n).name)}`;
    this.showHint(true);
    this.lastLives = -1;
  }

  private update(s: HudState, force: boolean): void {
    this.timer.textContent = fmtTime(s.time);
    this.deaths.textContent = String(s.deaths);
    this.coins.textContent = fmtNum(s.coins);
    this.fill.style.width = `${(s.progress * 100).toFixed(1)}%`;
    this.nitro.style.width = `${(s.nitro * 100).toFixed(0)}%`;
    if (s.racers > 1) {
      this.placeEl.style.display = '';
      this.placeEl.textContent = `🏁 ${t('place')} ${s.place}/${s.racers}`;
      this.placeEl.classList.toggle('lead', s.place === 1);
      while (this.markers.children.length < s.rivals.length) this.markers.appendChild(h('i'));
      while (this.markers.children.length > s.rivals.length) this.markers.lastElementChild!.remove();
      s.rivals.forEach((r, i) => {
        const m = this.markers.children[i] as HTMLElement;
        m.style.left = `${(r.p * 100).toFixed(1)}%`;
        m.style.background = r.color;
      });
      const me = (this.markers.querySelector('.me') as HTMLElement) ?? this.markers.appendChild(h('b', { class: 'me' }));
      me.style.left = `${(s.progress * 100).toFixed(1)}%`;
    } else {
      this.placeEl.style.display = 'none';
      this.markers.replaceChildren();
    }
    if (force || s.lives !== this.lastLives || s.shield !== this.lastShield) {
      this.lastLives = s.lives;
      this.lastShield = s.shield;
      const max = Math.max(CONFIG.freeLives, s.lives);
      const items: HTMLElement[] = [];
      for (let i = 0; i < max; i++) items.push(icon('heart', i < s.lives ? '' : 'lost'));
      if (s.shield) items.push(icon('shield', 'shield'));
      this.hearts.replaceChildren(...items);
    }
  }
}
