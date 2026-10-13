// Локализация RU/EN.
import { save } from '../core/save';

const DICT = {
  play: ['Играть', 'Play'],
  levels: ['Уровни', 'Levels'],
  shop: ['Магазин', 'Shop'],
  settings: ['Настройки', 'Settings'],
  level: ['Уровень', 'Level'],
  world: ['Мир', 'World'],
  back: ['Назад', 'Back'],
  close: ['Закрыть', 'Close'],
  pause: ['Пауза', 'Paused'],
  resume: ['Продолжить', 'Resume'],
  restart: ['Начать сначала', 'Restart'],
  mainMenu: ['Главное меню', 'Main Menu'],
  map: ['Карта', 'Map'],
  revive: ['Возродиться', 'Revive'],
  gameOver: ['Игра окончена', 'Game Over'],
  outOfLives: ['Жизни закончились!', 'Out of lives!'],
  levelComplete: ['Уровень пройден!', 'Level Complete!'],
  next: ['Дальше', 'Next'],
  time: ['Время', 'Time'],
  best: ['Рекорд', 'Best'],
  falls: ['Падения', 'Falls'],
  coins: ['Монеты', 'Coins'],
  reward: ['Награда', 'Reward'],
  multiply: ['Умножить', 'Multiply'],
  free: ['Бесплатно', 'Free'],
  owned: ['Есть', 'Owned'],
  select: ['Выбрать', 'Select'],
  selected: ['Выбрано', 'Selected'],
  buy: ['Купить', 'Buy'],
  watch: ['Смотреть', 'Watch'],
  vehicles: ['Транспорт', 'Vehicles'],
  characters: ['Персонажи', 'Characters'],
  style: ['Стиль', 'Style'],
  paint: ['Краска', 'Paint'],
  trails: ['Следы', 'Trails'],
  boosters: ['Бустеры', 'Boosters'],
  getCoins: ['Монеты', 'Coins'],
  freeCoins: ['Бесплатные монеты', 'Free coins'],
  watchAd: ['Смотреть рекламу', 'Watch ad'],
  speed: ['Скорость', 'Speed'],
  accel: ['Разгон', 'Acceleration'],
  jump: ['Прыжок', 'Jump'],
  handling: ['Управление', 'Handling'],
  music: ['Музыка', 'Music'],
  sound: ['Звуки', 'Sounds'],
  quality: ['Графика', 'Graphics'],
  qAuto: ['Авто', 'Auto'],
  qLow: ['Низкая', 'Low'],
  qHigh: ['Высокая', 'High'],
  vibration: ['Вибрация', 'Vibration'],
  language: ['Язык', 'Language'],
  resetProgress: ['Сбросить прогресс', 'Reset progress'],
  resetConfirm: ['Точно сбросить весь прогресс? Это нельзя отменить.', 'Reset all progress? This cannot be undone.'],
  yes: ['Да', 'Yes'],
  no: ['Нет', 'No'],
  on: ['Вкл', 'On'],
  off: ['Выкл', 'Off'],
  controls: ['Управление', 'Controls'],
  controlsHelp: [
    'W/↑ — газ, S/↓ — тормоз, A/D ←/→ — руль, Пробел — прыжок, Shift — нитро, R — к чекпоинту, Esc — пауза',
    'W/↑ — gas, S/↓ — brake, A/D ←/→ — steer, Space — jump, Shift — nitro, R — to checkpoint, Esc — pause',
  ],
  adNotAvailable: ['Реклама сейчас недоступна. Попробуйте позже.', 'Ad is not available right now. Try later.'],
  adNotFinished: ['Досмотрите рекламу, чтобы получить награду', 'Watch the whole ad to get the reward'],
  advert: ['Реклама', 'Advertisement'],
  adStub: ['Здесь будет реклама', 'Ad placeholder'],
  adSkip: ['Закрыть без награды', 'Close without reward'],
  adGetReward: ['Получить награду', 'Get reward'],
  adClose: ['Закрыть', 'Close'],
  notEnoughCoins: ['Не хватает монет', 'Not enough coins'],
  dailyGift: ['Подарок дня', 'Daily gift'],
  open: ['Открыть', 'Open'],
  comeBack: ['Возвращайтесь через', 'Come back in'],
  youGot: ['Вы получили', 'You got'],
  skipLevel: ['Пропустить уровень?', 'Skip this level?'],
  skip: ['Пропустить', 'Skip'],
  checkpoint: ['Чекпоинт!', 'Checkpoint!'],
  go: ['ВПЕРЁД!', 'GO!'],
  shieldSaved: ['Щит спас!', 'Shield saved you!'],
  activeBoosters: ['Бустеры на уровень', 'Boosters for this level'],
  getFree: ['Получить', 'Get'],
  start: ['Старт', 'Start'],
  newRecord: ['Новый рекорд!', 'New record!'],
  locked: ['Закрыто', 'Locked'],
  unlockedNew: ['Открыто!', 'Unlocked!'],
  loading: ['Загрузка...', 'Loading...'],
  tapToStart: ['Нажмите, чтобы начать', 'Tap to start'],
  endless: ['Бесконечный режим', 'Endless mode'],
  boost: ['Буст!', 'Boost!'],
  lives: ['Жизни', 'Lives'],
  nitro: ['Нитро', 'Nitro'],
  gas: ['Газ', 'Gas'],
  brake: ['Тормоз', 'Brake'],
  ads3: ['за рекламу', 'for ads'],
  progress: ['Прогресс', 'Progress'],
  continueQ: ['Продолжить с чекпоинта?', 'Continue from checkpoint?'],
  hint: ['Подсказка', 'Hint'],
} as const;

export type Key = keyof typeof DICT;

export function t(k: Key): string {
  const v = DICT[k];
  return save.settings.lang === 'ru' ? v[0] : v[1];
}

export function tn(name: { ru: string; en: string }): string {
  return save.settings.lang === 'ru' ? name.ru : name.en;
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
