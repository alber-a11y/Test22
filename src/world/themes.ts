// Темы миров: палитры неба и плиток.
export interface Theme {
  id: string;
  name: { ru: string; en: string };
  skyTop: number;
  skyHorizon: number;
  skyBottom: number;
  fog: number;
  tileA: number;
  tileB: number;
  side: number;
  sideDark: number;
  accent: number;
  cloud: number;
  sun: number;
  night?: boolean;
}

export const THEMES: Theme[] = [
  {
    id: 'meadow', name: { ru: 'Небесный луг', en: 'Sky Meadow' },
    skyTop: 0x3fa9f5, skyHorizon: 0xbff0ff, skyBottom: 0xe8fbff, fog: 0xc6efff,
    tileA: 0x7ed957, tileB: 0x5bbf3f, side: 0x2e3a8c, sideDark: 0x1b2160, accent: 0xff3b3b, cloud: 0xffffff, sun: 0xfff6c8,
  },
  {
    id: 'candy', name: { ru: 'Конфетная страна', en: 'Candy Land' },
    skyTop: 0xff7ac6, skyHorizon: 0xffd6ef, skyBottom: 0xfff0f8, fog: 0xffd9f0,
    tileA: 0xffffff, tileB: 0xff8cc6, side: 0x8b3fa8, sideDark: 0x5a2275, accent: 0x00c2ff, cloud: 0xfff4fb, sun: 0xffffff,
  },
  {
    id: 'desert', name: { ru: 'Закатная пустыня', en: 'Sunset Desert' },
    skyTop: 0xff7b54, skyHorizon: 0xffd38a, skyBottom: 0xfff1d6, fog: 0xffd9a8,
    tileA: 0xf7b052, tileB: 0xd98a2b, side: 0x4a2c7a, sideDark: 0x2c1650, accent: 0xff2d2d, cloud: 0xfff0e0, sun: 0xffffe0,
  },
  {
    id: 'neon', name: { ru: 'Неоновая ночь', en: 'Neon Night' },
    skyTop: 0x0e0838, skyHorizon: 0x5a2c91, skyBottom: 0x2a1460, fog: 0x3a1f70,
    tileA: 0x3ad7ff, tileB: 0x1c7fd6, side: 0x141a5a, sideDark: 0x0a0d33, accent: 0xff2bd6, cloud: 0x8a6bd1, sun: 0xff9cf0, night: true,
  },
  {
    id: 'ice', name: { ru: 'Ледяной пик', en: 'Ice Peak' },
    skyTop: 0x6fd3ff, skyHorizon: 0xe3f8ff, skyBottom: 0xffffff, fog: 0xe0f6ff,
    tileA: 0xffffff, tileB: 0x7cc8f2, side: 0x3c5aa8, sideDark: 0x243a78, accent: 0xff5c8a, cloud: 0xffffff, sun: 0xffffff,
  },
];

export function themeForLevel(level: number): Theme {
  return THEMES[Math.floor((level - 1) / 10) % THEMES.length];
}

export function worldIndex(level: number): number {
  return Math.floor((level - 1) / 10);
}
