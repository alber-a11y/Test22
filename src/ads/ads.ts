// Реклама: менеджер + сменные провайдеры. Сейчас — заглушка StubProvider.
// Подключение площадки (Яндекс Игры, VK, CrazyGames, GameDistribution...) = новый класс AdProvider.
import { CONFIG } from '../core/config';
import { bus } from '../core/events';
import { input } from '../core/input';
import { audio } from '../audio/engine';
import { t } from '../ui/i18n';

export interface AdProvider {
  readonly name: string;
  init(): Promise<void>;
  /** true — реклама показана (или пропущена провайдером без ошибки). */
  showInterstitial(): Promise<boolean>;
  /** true — пользователь досмотрел, награду можно выдать. */
  showRewarded(): Promise<boolean>;
}

/** Заглушка: полноэкранная плашка «Реклама» с таймером. ?ads=fail — симуляция ошибок. */
export class StubProvider implements AdProvider {
  readonly name = 'stub';
  private fail = new URLSearchParams(location.search).get('ads') === 'fail';

  async init(): Promise<void> {}

  showInterstitial(): Promise<boolean> {
    if (this.fail) return Promise.resolve(false);
    return this.overlay(false, CONFIG.ads.stubInterstitialSeconds);
  }

  showRewarded(): Promise<boolean> {
    if (this.fail) return Promise.resolve(false);
    return this.overlay(true, CONFIG.ads.stubRewardedSeconds);
  }

  private overlay(rewarded: boolean, seconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-stub';
      el.innerHTML = `
        <div class="ad-stub-badge">${t('advert')}${rewarded ? ' · 🎁' : ''}</div>
        <div class="ad-stub-box">
          <div class="ad-stub-logo">AD</div>
          <div class="ad-stub-text">${t('adStub')}</div>
          <div class="ad-stub-timer">${seconds}</div>
        </div>
        <div class="ad-stub-actions"></div>`;
      document.body.appendChild(el);
      const timerEl = el.querySelector('.ad-stub-timer') as HTMLElement;
      const actions = el.querySelector('.ad-stub-actions') as HTMLElement;
      let left = seconds;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearInterval(iv);
        el.remove();
        resolve(ok);
      };
      const btn = (label: string, cls: string, ok: boolean) => {
        const b = document.createElement('button');
        b.className = `btn ${cls}`;
        b.textContent = label;
        b.onclick = () => finish(ok);
        actions.appendChild(b);
      };
      if (rewarded) btn(t('adSkip'), 'btn-ghost', false);
      const iv = window.setInterval(() => {
        left--;
        timerEl.textContent = String(Math.max(0, left));
        if (left <= 0) {
          clearInterval(iv);
          actions.innerHTML = '';
          if (rewarded) btn(t('adGetReward'), 'btn-green', true);
          else btn(t('adClose'), 'btn-blue', true);
        }
      }, 1000);
    });
  }
}

class AdManager {
  provider: AdProvider = new StubProvider();
  private lastInterstitial = -Infinity;
  private sessionStart = performance.now() / 1000;
  private showing = false;

  async init(provider?: AdProvider): Promise<void> {
    if (provider) this.provider = provider;
    try {
      await this.provider.init();
    } catch {
      /* площадка недоступна — работаем без рекламы */
    }
  }

  get busy(): boolean {
    return this.showing;
  }

  private begin(): void {
    this.showing = true;
    input.clear();
    input.enabled = false;
    audio.suspend('ad');
    bus.emit('ad:start');
  }

  private end(): void {
    this.showing = false;
    input.clear();
    input.enabled = true;
    audio.resume('ad');
    bus.emit('ad:end');
  }

  /** Можно ли сейчас показать fullscreen (кулдауны). */
  canInterstitial(): boolean {
    const now = performance.now() / 1000;
    return !this.showing && now - this.lastInterstitial >= CONFIG.ads.interstitialCooldown && now - this.sessionStart >= CONFIG.ads.firstInterstitialDelay;
  }

  /** Fullscreen-реклама. Всегда резолвится (после показа или сразу, если нельзя). */
  async interstitial(placement: string): Promise<void> {
    if (!this.canInterstitial()) return;
    this.begin();
    bus.emit('ad:interstitial', placement);
    try {
      await this.provider.showInterstitial();
    } catch {
      /* ignore */
    }
    this.lastInterstitial = performance.now() / 1000;
    this.end();
  }

  /** Rewarded-реклама. true — награду выдаём. */
  async rewarded(placement: string): Promise<boolean> {
    if (this.showing) return false;
    this.begin();
    bus.emit('ad:rewarded', placement);
    let ok = false;
    try {
      ok = await this.provider.showRewarded();
    } catch {
      ok = false;
    }
    if (CONFIG.ads.rewardedResetsCooldown) this.lastInterstitial = performance.now() / 1000;
    this.end();
    if (!ok) bus.emit('toast', t('adNotFinished'));
    return ok;
  }
}

export const ads = new AdManager();
