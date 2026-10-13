// Все настраиваемые параметры игры в одном месте.

export const CONFIG = {
  // Жизни и возрождение
  freeLives: 3,
  reviveLives: 1,
  respawnDelay: 0.9,

  // Физика (базовые значения, транспорт масштабирует их)
  gravity: 30,
  stepUp: 0.45,
  snapDown: 0.65,
  playerRadius: 0.4,
  playerHeight: 1.6,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  bounceVelocity: 17.5,
  boostDuration: 0.9,
  boostSpeedMul: 1.6,
  nitroSpeedMul: 1.35,
  nitroDrain: 0.45,
  nitroRegen: 0.08,

  // Реклама (агрессивность выше среднего)
  ads: {
    interstitialCooldown: 45, // сек. между fullscreen-показами
    firstInterstitialDelay: 25, // сек. от старта сессии до первого fullscreen
    restartsPerInterstitial: 4, // fullscreen после каждых N рестартов подряд
    rewardedResetsCooldown: true, // rewarded сбрасывает кулдаун fullscreen
    stubInterstitialSeconds: 3,
    stubRewardedSeconds: 5,
  },

  // Экономика
  economy: {
    levelBaseReward: 50,
    levelRewardPerLevel: 4,
    levelRewardMax: 180,
    coinValue: 1,
    freeCoinsReward: 150,
    freeCoinsCooldown: 30,
    dailyGiftHours: 24,
  },

  // Бонус монет за место в гонке с соперниками: 1-е, 2-е, 3-е
  placeBonus: [20, 10, 5],

  // Уровни
  handcraftedLevels: 20,
  trackLengthMul: 1.3, // удлинение трассы относительно базового набора сегментов
};

export type Quality = 'auto' | 'low' | 'high';
