// Модальные окна: старт уровня, пауза, победа, Game Over, настройки, подарок дня.
import { CONFIG, type Quality } from '../core/config';
import { addCoins, persist, resetSave, save } from '../core/save';
import { ads } from '../ads/ads';
import { audio } from '../audio/engine';
import { sfx } from '../audio/sfx';
import { BOOSTERS, type BoosterKind } from '../economy/catalog';
import type { LevelResult } from '../game/game';
import { themeForLevel } from '../world/themes';
import { btn, coinIcon, fmtNum, h, icon } from './dom';
import { fmtTime, t, tn } from './i18n';
import { modal, toast, type Modal } from './base';

// ------------------------------------------------------------ старт уровня

export function levelStartDialog(level: number, onStart: (boosters: BoosterKind[]) => void, onClose: () => void): Modal {
  const chosen = new Set<BoosterKind>();
  const grid = h('div', { class: 'boosters' });
  const render = () => {
    grid.replaceChildren(
      ...BOOSTERS.map((b) => {
        const cnt = save.boosters[b.id] ?? 0;
        return h('div', {
          class: `booster ${chosen.has(b.id) ? 'on' : ''} ${cnt === 0 ? 'empty' : ''}`,
          title: tn(b.desc),
          onclick: () => {
            if (cnt === 0) {
              sfx.error();
              toast(tn(b.desc));
              return;
            }
            sfx.click();
            if (chosen.has(b.id)) chosen.delete(b.id);
            else chosen.add(b.id);
            render();
          },
        }, icon(b.icon as never), tn(b.name), h('span', { class: 'cnt' }, String(cnt)));
      }),
    );
  };
  render();
  const stars = save.stars[level] ?? 0;
  const best = save.bestTime[level];
  const m = modal([
    h('h2', {}, `${t('level')} ${level}`),
    h('div', { class: 'note' }, tn(themeForLevel(level).name) + (level > CONFIG.handcraftedLevels ? ` · ${t('endless')}` : '')),
    h('div', { class: 'stars' }, ...[0, 1, 2].map((i) => icon('star', i < stars ? 'on' : ''))),
    best !== undefined ? h('div', { class: 'note' }, `${t('best')}: ${fmtTime(best)}`) : null,
    h('div', { class: 'note' }, t('activeBoosters')),
    grid,
    btn([icon('film'), `${t('getFree')} +1`], 'btn-purple btn-small', async () => {
      if (!(await ads.rewarded('free_booster'))) return;
      const b = BOOSTERS[Math.floor(Math.random() * BOOSTERS.length)];
      save.boosters[b.id] = (save.boosters[b.id] ?? 0) + 1;
      chosen.add(b.id);
      persist();
      sfx.reward();
      toast(`${t('youGot')}: ${tn(b.name)}`, 'good');
      render();
    }),
    btn([icon('play'), t('start')], 'btn-green btn-big', () => {
      for (const b of chosen) save.boosters[b] = Math.max(0, (save.boosters[b] ?? 0) - 1);
      persist();
      started = true;
      m.close();
      onStart([...chosen]);
    }),
  ], { closable: true, onClose: () => !started && onClose() });
  let started = false;
  return m;
}

// ------------------------------------------------------------ пауза

export interface PauseActions {
  resume(): void;
  restart(): void;
  map(): void;
  menu(): void;
  settings(): void;
}

export function pauseDialog(a: PauseActions): Modal {
  const m = modal([
    h('h2', {}, t('pause')),
    h('div', { class: 'btn-col' },
      btn([icon('play'), t('resume')], 'btn-green btn-big', () => {
        m.close();
        a.resume();
      }),
      btn([icon('restart'), t('restart')], 'btn-blue', () => {
        m.close();
        a.restart();
      }),
      btn([icon('gear'), t('settings')], 'btn-blue', () => a.settings()),
      btn([icon('map'), t('levels')], 'btn-orange', () => {
        m.close();
        a.map();
      }),
      btn([icon('home'), t('mainMenu')], 'btn-orange', () => {
        m.close();
        a.menu();
      }),
    ),
  ], { cls: 'wide-land' });
  return m;
}

// ------------------------------------------------------------ Game Over

export interface GameOverActions {
  revive(): void;
  restart(): void;
  shop(): void;
  menu(): void;
}

export function gameOverDialog(deaths: number, a: GameOverActions): Modal {
  const m = modal([
    h('h2', {}, t('gameOver')),
    icon('skull', 'big-skull'),
    h('div', { class: 'note' }, `${t('outOfLives')} ${t('falls')}: ${deaths}`),
    h('div', { class: 'btn-col' },
      btn([icon('film'), t('revive'), h('span', { class: 'ad-badge' }, `+${CONFIG.reviveLives}`, icon('heart'))], 'btn-purple btn-big', async () => {
        const ok = await ads.rewarded('revive');
        if (!ok) return;
        m.close();
        a.revive();
      }, { style: 'animation:pulse 1.1s infinite' }),
      btn([icon('restart'), t('restart')], 'btn-blue', () => {
        m.close();
        a.restart();
      }),
      btn([icon('cart'), t('shop')], 'btn-orange', () => {
        m.close();
        a.shop();
      }),
      btn([icon('home'), t('mainMenu')], 'btn-orange', () => {
        m.close();
        a.menu();
      }),
    ),
  ], { cls: 'wide-land' });
  return m;
}

// ------------------------------------------------------------ победа

export interface WinActions {
  next(): void;
  map(): void;
}

export function winDialog(r: LevelResult, a: WinActions): Modal {
  const starsEl = h('div', { class: 'stars' }, ...[0, 1, 2].map(() => icon('star')));
  const rewardVal = h('span', {}, fmtNum(r.reward));
  let claimed = false;
  // Рулетка множителя
  const segs = [2, 3, 2, 5, 2, 3, 2];
  const colors = ['#3b8bff', '#a259ff', '#3b8bff', '#ff4d5e', '#3b8bff', '#a259ff', '#3b8bff'];
  const needle = h('div', { class: 'needle' });
  const roulette = h('div', { class: 'roulette' }, ...segs.map((s, i) => h('div', { style: `background:${colors[i]}` }, `x${s}`)), needle);
  let pos = 0, dir = 1, running = true;
  const tick = () => {
    if (!running) return;
    pos += dir * 0.012;
    if (pos >= 1) { pos = 1; dir = -1; }
    if (pos <= 0) { pos = 0; dir = 1; }
    needle.style.left = `${pos * 100}%`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const currentMult = () => segs[Math.min(segs.length - 1, Math.floor(pos * segs.length))];

  const multBtn = btn([icon('film'), t('multiply')], 'btn-purple btn-big', async () => {
    running = false;
    const mult = currentMult();
    const ok = await ads.rewarded('win_multiplier');
    if (!ok) {
      running = true;
      requestAnimationFrame(tick);
      return;
    }
    claimed = true;
    addCoins(r.reward * (mult - 1));
    rewardVal.textContent = fmtNum(r.reward * mult);
    sfx.reward();
    toast(`x${mult}!`, 'big');
    multBtn.remove();
    roulette.remove();
  }, { style: 'animation:pulse 1.1s infinite' });

  const m = modal([
    h('h2', {}, t('levelComplete')),
    starsEl,
    r.newRecord ? h('div', { class: 'note', style: 'color:#ff9800' }, `🏆 ${t('newRecord')}`) : null,
    h('div', { class: 'results' },
      h('span', { class: 'k' }, t('time')), h('span', { class: 'v' }, fmtTime(r.time)),
      h('span', { class: 'k' }, t('falls')), h('span', { class: 'v' }, String(r.deaths)),
      h('span', { class: 'k' }, t('coins')), h('span', { class: 'v' }, String(r.coins) + (r.x2 ? ' ×2' : '')),
    ),
    h('div', { class: 'reward-big' }, coinIcon(), rewardVal),
    roulette,
    multBtn,
    h('div', { class: 'btn-row' },
      btn([icon('map'), t('levels')], 'btn-orange', () => {
        running = false;
        m.close();
        a.map();
      }),
      btn([t('next'), icon('play')], 'btn-green', () => {
        running = false;
        m.close();
        a.next();
      }),
    ),
  ]);
  // звёзды по очереди
  starsEl.querySelectorAll('.ico').forEach((s, i) => {
    if (i < r.stars) setTimeout(() => {
      s.classList.add('on');
      sfx.star(i);
    }, 300 + i * 280);
  });
  void claimed;
  return m;
}

// ------------------------------------------------------------ настройки

export function settingsDialog(onClose?: () => void): Modal {
  const s = save.settings;
  const slider = (val: number, on: (v: number) => void) =>
    h('input', {
      type: 'range', min: 0, max: 100, value: Math.round(val * 100),
      oninput: (e: Event) => on(Number((e.target as HTMLInputElement).value) / 100),
      onchange: () => sfx.click(),
    });
  const seg = <T extends string>(opts: [T, string][], cur: T, on: (v: T) => void) => {
    const wrap = h('div', { class: 'seg' });
    const draw = (c: T) =>
      wrap.replaceChildren(...opts.map(([v, label]) => h('button', {
        class: v === c ? 'on' : '',
        onclick: () => {
          sfx.click();
          on(v);
          draw(v);
        },
      }, label)));
    draw(cur);
    return wrap;
  };
  const qualityNote = h('div', { class: 'note', style: 'display:none' }, '↻');
  const m = modal([
    h('h2', {}, t('settings')),
    h('div', { class: 'settings-grid' },
      h('label', {}, icon('music'), t('music')),
      slider(s.music, (v) => {
        s.music = v;
        audio.setVolumes(s.music, s.sfx);
        persist();
      }),
      h('label', {}, icon('sound'), t('sound')),
      slider(s.sfx, (v) => {
        s.sfx = v;
        audio.setVolumes(s.music, s.sfx);
        persist();
      }),
      h('label', {}, t('quality')),
      seg<Quality>([['auto', t('qAuto')], ['low', t('qLow')], ['high', t('qHigh')]], s.quality, (v) => {
        s.quality = v;
        persist();
        qualityNote.style.display = '';
        qualityNote.textContent = save.settings.lang === 'ru' ? 'Применится после перезапуска игры' : 'Applies after restarting the game';
      }),
      h('label', {}, t('vibration')),
      seg<'on' | 'off'>([['on', t('on')], ['off', t('off')]], s.vibration ? 'on' : 'off', (v) => {
        s.vibration = v === 'on';
        persist();
      }),
      h('label', {}, icon('globe'), t('language')),
      seg<'ru' | 'en'>([['ru', 'Русский'], ['en', 'English']], s.lang, (v) => {
        if (v === s.lang) return;
        s.lang = v;
        try {
          localStorage.setItem('bobby-rider-save-v1', JSON.stringify(save));
        } catch {
          /* ignore */
        }
        location.reload();
      }),
    ),
    qualityNote,
    h('div', { class: 'note', style: 'font-size:13px' }, `${t('controls')}: ${t('controlsHelp')}`),
    btn(t('resetProgress'), 'btn-red btn-small', () => {
      const c = modal([
        h('h2', {}, t('resetProgress')),
        h('div', { class: 'note' }, t('resetConfirm')),
        h('div', { class: 'btn-row' },
          btn(t('no'), 'btn-blue', () => c.close()),
          btn(t('yes'), 'btn-red', () => resetSave()),
        ),
      ]);
    }),
    btn(t('close'), 'btn-green', () => m.close()),
  ], { onClose });
  return m;
}

// ------------------------------------------------------------ подарок дня

export function dailyGiftDialog(onDone: () => void): Modal {
  const hours = CONFIG.economy.dailyGiftHours;
  const left = save.lastDailyGift + hours * 3600_000 - Date.now();
  const chest = h('div', { style: 'font-size:84px;animation:bob 1.6s infinite' }, '🎁');
  const children: (Node | null)[] = [h('h2', {}, t('dailyGift')), chest];
  if (left > 0) {
    const hh = Math.floor(left / 3600_000), mm = Math.floor((left % 3600_000) / 60_000);
    children.push(h('div', { class: 'note' }, `${t('comeBack')} ${hh}:${String(mm).padStart(2, '0')}`));
    children.push(btn(t('close'), 'btn-blue', () => m.close()));
  } else {
    children.push(btn([icon('film'), t('open')], 'btn-purple btn-big', async () => {
      if (!(await ads.rewarded('daily_gift'))) return;
      save.lastDailyGift = Date.now();
      let text: string;
      if (Math.random() < 0.6) {
        const coins = 150 + Math.floor(Math.random() * 6) * 50;
        addCoins(coins);
        text = `${t('youGot')} ${coins} ${t('coins').toLowerCase()}`;
      } else {
        const b = BOOSTERS[Math.floor(Math.random() * BOOSTERS.length)];
        save.boosters[b.id] = (save.boosters[b.id] ?? 0) + 2;
        text = `${t('youGot')}: ${tn(b.name)} ×2`;
      }
      persist();
      sfx.buy();
      chest.textContent = '✨';
      toast(text, 'good', 2400);
      setTimeout(() => m.close(), 900);
    }, { style: 'animation:pulse 1.1s infinite' }));
    children.push(btn(t('close'), 'btn-ghost btn-small', () => m.close()));
  }
  const m = modal(children, { onClose: onDone });
  return m;
}

// ------------------------------------------------------------ пропуск уровня

export function skipDialog(onSkip: () => void, onCancel: () => void): Modal {
  const m = modal([
    h('h2', {}, t('skipLevel')),
    icon('ff', 'big-skull'),
    h('div', { class: 'btn-row' },
      btn(t('no'), 'btn-blue', () => m.close()),
      btn([icon('film'), t('skip')], 'btn-purple', async () => {
        if (!(await ads.rewarded('skip_level'))) return;
        skipped = true;
        m.close();
        onSkip();
      }),
    ),
  ], { onClose: () => !skipped && onCancel() });
  let skipped = false;
  return m;
}
