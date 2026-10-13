// Точка входа bObby Rider.
import { installPageProtection } from './core/protect';
import { ads } from './ads/ads';
import { App } from './app';
import { audio } from './audio/engine';
import { h } from './ui/dom';
import { screen, showScreen } from './ui/base';
import { t } from './ui/i18n';
import { input } from './core/input';

installPageProtection();
if (input.isTouch) document.body.classList.add('touch');

async function boot(): Promise<void> {
  const loading = screen('loading');
  const bar = h('div');
  const hint = h('div', { class: 'tap-hint', style: 'visibility:hidden' }, t('tapToStart'));
  loading.replaceChildren(h('div', { class: 'title', html: 'b<span class="o">O</span>bby<br>Rider' }), h('div', { class: 'loadbar' }, bar), hint);
  showScreen('loading');

  const step = (p: number) => new Promise<void>((r) => {
    bar.style.width = `${p}%`;
    requestAnimationFrame(() => setTimeout(r, 30));
  });

  await step(15);
  await ads.init();
  await step(40);
  const app = new App(document.getElementById('game-canvas') as HTMLCanvasElement);
  await step(75);
  app.boot();
  await step(100);
  hint.style.visibility = 'visible';

  const go = () => {
    audio.unlock();
    loading.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
    app.goMenu();
  };
  loading.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

void boot();
