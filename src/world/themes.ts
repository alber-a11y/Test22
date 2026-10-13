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
  /** Цветовые пары плиток — уровни мира перебирают их, чтобы не повторяться. */
  palettes: [number, number][];
}

export const THEMES: Theme[] = [
  {
    id: 'meadow', name: { ru: 'Небесный луг', en: 'Sky Meadow' },
    skyTop: 0x3fa9f5, skyHorizon: 0xbff0ff, skyBottom: 0xe8fbff, fog: 0xc6efff,
    tileA: 0x7ed957, tileB: 0x5bbf3f, side: 0x2e3a8c, sideDark: 0x1b2160, accent: 0xff3b3b, cloud: 0xffffff, sun: 0xfff6c8,
    palettes: [[0x7ed957, 0x5bbf3f], [0xb5e655, 0x7cc242], [0x8ee0c8, 0x4fbf9f], [0xf6e27a, 0x9fd356], [0xffb3a7, 0x7ed957]],
  },
  {
    id: 'candy', name: { ru: 'Конфетная страна', en: 'Candy Land' },
    skyTop: 0xff7ac6, skyHorizon: 0xffd6ef, skyBottom: 0xfff0f8, fog: 0xffd9f0,
    tileA: 0xffffff, tileB: 0xff8cc6, side: 0x8b3fa8, sideDark: 0x5a2275, accent: 0x00c2ff, cloud: 0xfff4fb, sun: 0xffffff,
    palettes: [[0xffffff, 0xff8cc6], [0xffd1e8, 0xc58cff], [0xfff3b0, 0xff9ec7], [0xb8f2ff, 0xff8cc6], [0xffc4a3, 0xff6fa8]],
  },
  {
    id: 'desert', name: { ru: 'Закатная пустыня', en: 'Sunset Desert' },
    skyTop: 0xff7b54, skyHorizon: 0xffd38a, skyBottom: 0xfff1d6, fog: 0xffd9a8,
    tileA: 0xf7b052, tileB: 0xd98a2b, side: 0x4a2c7a, sideDark: 0x2c1650, accent: 0xff2d2d, cloud: 0xfff0e0, sun: 0xffffe0,
    palettes: [[0xf7b052, 0xd98a2b], [0xffd08a, 0xe0a15a], [0xf28c5a, 0xc9653a], [0xf5d6a1, 0xd4a76a], [0xffb36b, 0xe07a45]],
  },
  {
    id: 'neon', name: { ru: 'Неоновая ночь', en: 'Neon Night' },
    skyTop: 0x0e0838, skyHorizon: 0x5a2c91, skyBottom: 0x2a1460, fog: 0x3a1f70,
    tileA: 0x3ad7ff, tileB: 0x1c7fd6, side: 0x141a5a, sideDark: 0x0a0d33, accent: 0xff2bd6, cloud: 0x8a6bd1, sun: 0xff9cf0, night: true,
    palettes: [[0x3ad7ff, 0x1c7fd6], [0xff4fd8, 0x8a2be2], [0x4dffb4, 0x00a884], [0xffe14d, 0xff7a00], [0x7c8cff, 0x3a2bd6]],
  },
  {
    id: 'ice', name: { ru: 'Ледяной пик', en: 'Ice Peak' },
    skyTop: 0x6fd3ff, skyHorizon: 0xe3f8ff, skyBottom: 0xffffff, fog: 0xe0f6ff,
    tileA: 0xffffff, tileB: 0x7cc8f2, side: 0x3c5aa8, sideDark: 0x243a78, accent: 0xff5c8a, cloud: 0xffffff, sun: 0xffffff,
    palettes: [[0xffffff, 0x7cc8f2], [0xe0f7ff, 0xa5b8ff], [0xd8fff6, 0x6fd6c8], [0xf3e8ff, 0xb79cff], [0xffffff, 0xa9d8ff]],
  },
];

export function themeForLevel(level: number): Theme {
  return THEMES[Math.floor((level - 1) / 10) % THEMES.length];
}

export function worldIndex(level: number): number {
  return Math.floor((level - 1) / 10);
}
