// Оркестратор: экраны, игровой цикл, реклама, музыка, сохранение прогресса.
import { CONFIG } from './core/config';
import { bus } from './core/events';
import { input } from './core/input';
import { addCoins, persist, save } from './core/save';
import { ads } from './ads/ads';
import { audio } from './audio/engine';
import { music } from './audio/music';
import { sfx } from './audio/sfx';
import { Stage } from './game/stage';
import { Game, type LevelResult } from './game/game';
import type { BoosterKind } from './economy/catalog';
import { closeAllModals, hasModal, showScreen, toast, type Modal } from './ui/base';
import { Hud } from './ui/hud';
import { MapScreen, MenuScreen } from './ui/menu';
import { ShopScreen, type ShopTab } from './ui/shop';
import { dailyGiftDialog, gameOverDialog, levelStartDialog, pauseDialog, settingsDialog, skipDialog, winDialog } from './ui/dialogs';
import { t } from './ui/i18n';
import { worldIndex } from './world/themes';

export type Mode = 'loading' | 'menu' | 'map' | 'shop' | 'game';

export class App {
  stage: Stage;
  game: Game;
  mode: Mode = 'loading';
  hud: Hud;
  menu: MenuScreen;
  map: MapScreen;
  shop: ShopScreen;
  private shopReturn: 'menu' | 'map' | 'gameover' = 'menu';
  private pauseModal: Modal | null = null;
  private last = performance.now();
  private pausedBeforeAd = false;
  private sessionAdShown = false;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.game = new Game(this.stage);
    this.hud = new Hud({ pause: () => this.pauseGame(), skip: () => this.skipLevel() });
    this.menu = new MenuScreen(this);
    this.map = new MapScreen(this);
    this.shop = new ShopScreen(this);

    audio.setVolumes(save.settings.music, save.settings.sfx);
    save.sessions++;
    persist();

    bus.on('game:over', () => this.onGameOver());
    bus.on('game:finished', (r: LevelResult) => this.onFinished(r));
    bus.on('ad:start', () => {
      this.pausedBeforeAd = this.game.paused;
      this.game.setPaused(true);
    });
    bus.on('ad:end', () => {
      if (!this.pausedBeforeAd && !hasModal()) this.game.setPaused(false);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        audio.suspend('hidden');
        if (this.mode === 'game' && this.game.state === 'play' && !this.game.paused) this.pauseGame();
      } else audio.resume('hidden');
    });
    window.addEventListener('blur', () => {
      if (this.mode === 'game' && this.game.state === 'play' && !this.game.paused && !ads.busy) this.pauseGame();
    });

    input.onKey = (code) => {
      if (this.mode !== 'game' || ads.busy) return;
      if (code === 'Escape' || code === 'KeyP') {
        if (this.pauseModal) {
          this.pauseModal.close();
          this.pauseModal = null;
          this.resumeGame();
        } else if (!hasModal()) this.pauseGame();
      }
      if (code === 'KeyR' && !this.game.paused) this.game.toCheckpoint();
    };

    // первый жест пользователя включает звук
    const unlock = () => {
      audio.unlock();
      this.syncMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    audio.onReady = () => this.syncMusic();

    requestAnimationFrame((n) => this.loop(n));
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.mode === 'game' && this.game.active) this.game.update(dt);
    else this.stage.updateShowcase(dt);
    this.stage.trackFps(dt);
    this.stage.render();
    input.endFrame();
    requestAnimationFrame((n) => this.loop(n));
  }

  private syncMusic(): void {
    if (!audio.ctx) return;
    if (this.mode === 'game') music.play(worldIndex(this.game.data?.number ?? 1) % 2 === 0 ? 'game' : 'game2');
    else music.play('menu');
  }

  // ------------------------------------------------------------ навигация

  private setMode(m: Mode): void {
    this.mode = m;
    const inGameScene = m === 'game';
    this.stage.showShowcase(!inGameScene);
    if (this.game.view) this.game.view.group.visible = inGameScene;
    if (this.game.rider) this.game.rider.root.visible = inGameScene;
    this.stage.setShowcaseFocus(m === 'shop' ? (this.stage.width > this.stage.height && this.stage.width > 760 ? 0.27 : 0.5) : 0.5, m === 'shop' && !(this.stage.width > this.stage.height && this.stage.width > 760) ? 0.27 : 0.5);
    if (!inGameScene) this.stage.setShowcaseRider();
    this.stage.setPodiumVisible(m !== 'map');
    audio.setDuck(1);
    this.syncMusic();
  }

  /** Финальная загрузка: экран «нажмите, чтобы начать». */
  boot(): void {
    showScreen('loading');
    this.stage.showShowcase(true);
    this.stage.setShowcaseRider();
  }

  goMenu(): void {
    closeAllModals();
    this.pauseModal = null;
    this.game.dispose();
    this.setMode('menu');
    this.menu.refresh();
    showScreen('menu');
  }

  goMap(): void {
    closeAllModals();
    this.pauseModal = null;
    this.game.dispose();
    this.setMode('map');
    this.map.refresh();
    showScreen('map');
  }

  /** Выход из уровня в меню/карту — через fullscreen-рекламу. */
  private async leaveGame(to: 'menu' | 'map'): Promise<void> {
    await ads.interstitial('to_menu');
    if (to === 'menu') this.goMenu();
    else this.goMap();
  }

  goShop(tab: ShopTab): void {
    if (this.mode !== 'shop') this.shopReturn = this.mode === 'map' ? 'map' : this.mode === 'game' ? 'gameover' : 'menu';
    this.setMode('shop');
    showScreen('shop');
    this.shop.open(tab);
  }

  closeShop(): void {
    this.stage.setShowcaseRider();
    if (this.shopReturn === 'gameover' && this.game.active) {
      this.setMode('game');
      this.stage.setTheme(this.game.data!.theme);
      this.stage.env.populateClouds(this.game.data!.path, this.game.data!.number * 31, this.game.data!.killY + 4);
      showScreen('hud');
      this.onGameOver();
      return;
    }
    if (this.shopReturn === 'map') this.goMap();
    else this.goMenu();
  }

  openSettings(): void {
    settingsDialog();
  }

  openDailyGift(): void {
    dailyGiftDialog(() => this.menu.refresh());
  }

  async playFromMenu(): Promise<void> {
    // fullscreen при первом нажатии «Играть» за сессию (кроме самой первой сессии)
    if (!this.sessionAdShown && save.sessions > 1) {
      this.sessionAdShown = true;
      await ads.interstitial('session_start');
    }
    this.openLevel(save.maxLevel);
  }

  openLevel(n: number): void {
    levelStartDialog(n, (b) => this.playLevel(n, b), () => {});
  }

  playLevel(n: number, boosters: BoosterKind[]): void {
    closeAllModals();
    this.pauseModal = null;
    this.game.start(n, boosters);
    this.setMode('game');
    this.hud.setLevel(n);
    showScreen('hud');
    toast(`${t('level')} ${n}`, 'big', 1200);
  }

  pauseGame(): void {
    if (this.mode !== 'game' || this.pauseModal || this.game.state === 'over' || this.game.state === 'finished') return;
    this.game.setPaused(true);
    input.clear();
    audio.setDuck(0.35);
    this.pauseModal = pauseDialog({
      resume: () => {
        this.pauseModal = null;
        this.resumeGame();
      },
      restart: () => {
        this.pauseModal = null;
        this.restartLevel();
      },
      map: () => {
        this.pauseModal = null;
        void this.leaveGame('map');
      },
      menu: () => {
        this.pauseModal = null;
        void this.leaveGame('menu');
      },
      settings: () => settingsDialog(),
    });
  }

  resumeGame(): void {
    audio.setDuck(1);
    input.clear();
    this.game.setPaused(false);
  }

  async restartLevel(fromGameOver = false): Promise<void> {
    const streak = this.game.restartStreak + 1;
    if (fromGameOver || streak % CONFIG.ads.restartsPerInterstitial === 0) await ads.interstitial(fromGameOver ? 'gameover_restart' : 'restart_streak');
    closeAllModals();
    this.game.restart();
    this.resumeGame();
    showScreen('hud');
    this.hud.setLevel(this.game.data!.number);
  }

  private onGameOver(): void {
    audio.setDuck(0.35);
    gameOverDialog(this.game.deaths, {
      revive: () => {
        this.game.revive();
        this.resumeGame();
        sfx.reward();
      },
      restart: () => void this.restartLevel(true),
      shop: () => this.goShop('vehicles'),
      menu: () => void this.leaveGame('menu'),
    });
  }

  private onFinished(r: LevelResult): void {
    // прогресс
    save.maxLevel = Math.max(save.maxLevel, r.level + 1);
    save.stars[r.level] = Math.max(save.stars[r.level] ?? 0, r.stars);
    if (r.newRecord) save.bestTime[r.level] = r.time;
    addCoins(r.reward);
    persist();
    audio.setDuck(0.5);
    winDialog(r, {
      next: async () => {
        await ads.interstitial('level_complete');
        this.openLevelAfterWin(r.level + 1);
      },
      map: () => void this.leaveGame('map'),
    });
  }

  /** Следующий уровень: окно старта поверх текущей сцены. */
  private openLevelAfterWin(n: number): void {
    levelStartDialog(n, (b) => this.playLevel(n, b), () => this.goMap());
  }

  private skipLevel(): void {
    if (this.mode !== 'game' || this.game.state === 'finished') return;
    const wasPaused = this.game.paused;
    this.game.setPaused(true);
    skipDialog(
      () => {
        const n = this.game.data!.number;
        save.maxLevel = Math.max(save.maxLevel, n + 1);
        save.stars[n] = Math.max(save.stars[n] ?? 0, 1);
        persist();
        this.openLevelAfterWin(n + 1);
      },
      () => this.game.setPaused(wasPaused),
    );
  }
}
