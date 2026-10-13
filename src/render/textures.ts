// Процедурные текстуры: всё рисуется на canvas при запуске.
import * as THREE from 'three';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function shade(c: number, k: number): string {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * k));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * k));
  const b = Math.min(255, Math.max(0, (c & 255) * k));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function toTexture(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.Texture>();

/** Шахматка 2x2 клетки с мягкой фаской на каждой клетке. */
export function checkerTexture(a: number, b: number): THREE.Texture {
  const key = `chk${a}-${b}`;
  const got = cache.get(key);
  if (got) return got;
  const S = 128, C = S / 2;
  const [c, g] = canvas(S, S);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const col = (i + j) % 2 ? b : a;
      g.fillStyle = hex(col);
      g.fillRect(i * C, j * C, C, C);
      // мягкий блик сверху-слева и тень снизу-справа
      g.fillStyle = shade(col, 1.08);
      g.fillRect(i * C, j * C, C, 3);
      g.fillRect(i * C, j * C, 3, C);
      g.fillStyle = shade(col, 0.92);
      g.fillRect(i * C, j * C + C - 3, C, 3);
      g.fillRect(i * C + C - 3, j * C, 3, C);
    }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Плитка с трещинами для исчезающих платформ. */
export function crackTexture(a: number, b: number): THREE.Texture {
  const key = `crk${a}-${b}`;
  const got = cache.get(key);
  if (got) return got;
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(a);
  g.fillRect(0, 0, S, S);
  g.fillStyle = hex(b);
  g.fillRect(0, 0, S / 2, S / 2);
  g.fillRect(S / 2, S / 2, S / 2, S / 2);
  g.strokeStyle = 'rgba(40,20,10,0.55)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  const lines = [
    [20, 10, 50, 40, 44, 70, 70, 100],
    [100, 15, 80, 45, 95, 70],
    [10, 90, 35, 80, 50, 118],
    [118, 100, 90, 95, 80, 122],
  ];
  for (const l of lines) {
    g.beginPath();
    g.moveTo(l[0], l[1]);
    for (let i = 2; i < l.length; i += 2) g.lineTo(l[i], l[i + 1]);
    g.stroke();
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Батут: концентрические кольца. */
export function bounceTexture(): THREE.Texture {
  const got = cache.get('bounce');
  if (got) return got;
  const S = 128;
  const [c, g] = canvas(S, S);
  for (let r = 8; r >= 1; r--) {
    g.fillStyle = r % 2 ? '#ff3fa4' : '#ffe14d';
    g.beginPath();
    g.arc(S / 2, S / 2, (r / 8) * S * 0.72, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ff3fa4';
  g.globalCompositeOperation = 'destination-over';
  g.fillRect(0, 0, S, S);
  const t = toTexture(c, false);
  cache.set('bounce', t);
  return t;
}

/** Шевроны ускорения (прозрачный фон). */
export function chevronTexture(): THREE.Texture {
  const got = cache.get('chev');
  if (got) return got;
  const S = 128;
  const [c, g] = canvas(S, S);
  g.clearRect(0, 0, S, S);
  const draw = (y: number) => {
    g.beginPath();
    g.moveTo(10, y + 46);
    g.lineTo(64, y + 8);
    g.lineTo(118, y + 46);
    g.lineTo(118, y + 64);
    g.lineTo(64, y + 26);
    g.lineTo(10, y + 64);
    g.closePath();
  };
  const grd = g.createLinearGradient(0, 0, 0, S);
  grd.addColorStop(0, '#ffe066');
  grd.addColorStop(1, '#ff8a00');
  g.fillStyle = grd;
  g.strokeStyle = '#b34700';
  g.lineWidth = 3;
  draw(0);
  g.fill();
  g.stroke();
  draw(64);
  g.fill();
  g.stroke();
  const t = toTexture(c);
  cache.set('chev', t);
  return t;
}

/** Клетчатый финишный баннер с надписью. */
export function finishTexture(text: string): THREE.Texture {
  const W = 512, H = 128;
  const [c, g] = canvas(W, H);
  const s = 16;
  for (let y = 0; y < H; y += s)
    for (let x = 0; x < W; x += s) {
      g.fillStyle = ((x + y) / s) % 2 ? '#ffffff' : '#222222';
      g.fillRect(x, y, s, s);
    }
  g.fillStyle = 'rgba(255,59,59,0.92)';
  g.fillRect(70, 22, W - 140, H - 44);
  g.font = 'bold 64px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#7a0000';
  g.strokeText(text, W / 2, H / 2 + 3);
  g.fillStyle = '#ffffff';
  g.fillText(text, W / 2, H / 2 + 3);
  return toTexture(c, false);
}

/** Атлас частиц 4x1: круг, звезда, сердце, искра. */
export function particleAtlas(): THREE.Texture {
  const got = cache.get('patlas');
  if (got) return got;
  const S = 64;
  const [c, g] = canvas(S * 4, S);
  // круг с мягким краем
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  // звезда
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 12 : 30;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(S + S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
  }
  g.fill();
  // сердце
  g.beginPath();
  const hx = S * 2 + S / 2, hy = S / 2;
  g.moveTo(hx, hy + 22);
  g.bezierCurveTo(hx - 34, hy - 2, hx - 18, hy - 30, hx, hy - 12);
  g.bezierCurveTo(hx + 18, hy - 30, hx + 34, hy - 2, hx, hy + 22);
  g.fill();
  // искра-ромб
  g.beginPath();
  const sx = S * 3 + S / 2;
  g.moveTo(sx, 4);
  g.lineTo(sx + 9, S / 2);
  g.lineTo(sx, S - 4);
  g.lineTo(sx - 9, S / 2);
  g.closePath();
  g.fill();
  const t = toTexture(c, false);
  cache.set('patlas', t);
  return t;
}

/** Градиентная карта для мультяшного освещения. */
export function toonGradient(): THREE.Texture {
  const got = cache.get('toon');
  if (got) return got;
  const data = new Uint8Array([90, 160, 225, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  cache.set('toon', t);
  return t;
}

/** Мягкое пятно (для облаков-спрайтов и теней). */
export function softDot(): THREE.Texture {
  const got = cache.get('dot');
  if (got) return got;
  const S = 64;
  const [c, g] = canvas(S, S);
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, 'rgba(0,0,0,0.55)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const t = toTexture(c, false);
  cache.set('dot', t);
  return t;
}

// ---------------------------------------------------------------- узоры плиток (128px = 2 м, тайлятся)

export const TILE_PATTERNS = ['checker', 'stripes', 'bricks', 'dots', 'planks', 'diamonds', 'tiles', 'zigzag', 'grid'] as const;
export type TilePattern = (typeof TILE_PATTERNS)[number];

/** Текстура покрытия плитки: узор + два цвета. */
export function tileTexture(pattern: TilePattern, a: number, b: number): THREE.Texture {
  if (pattern === 'checker') return checkerTexture(a, b);
  const key = `tile-${pattern}-${a}-${b}`;
  const got = cache.get(key);
  if (got) return got;
  const S = 128;
  const [c, g] = canvas(S, S);
  const A = hex(a), B = hex(b);
  g.fillStyle = A;
  g.fillRect(0, 0, S, S);
  switch (pattern) {
    case 'stripes': {
      // диагональные полосы, период 32px по обеим осям — бесшовно
      g.fillStyle = B;
      for (let k = -S; k < S * 2; k += 32) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + 16, 0);
        g.lineTo(k + 16 - S, S);
        g.lineTo(k - S, S);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'bricks': {
      g.fillStyle = shade(b, 0.8);
      g.fillRect(0, 0, S, S);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 32 : 0;
        for (let x = -64; x < S + 64; x += 64) {
          g.fillStyle = (row + x / 64) % 2 ? A : shade(a, 0.92);
          g.fillRect(x + off + 2, row * 32 + 2, 60, 28);
          g.fillStyle = shade(a, 1.1);
          g.fillRect(x + off + 2, row * 32 + 2, 60, 3);
        }
      }
      break;
    }
    case 'dots': {
      g.fillStyle = B;
      for (let y = 0; y <= S; y += 32)
        for (let x = 0; x <= S; x += 32) {
          const ox = (y / 32) % 2 ? 16 : 0;
          for (const dx of [0, S]) {
            g.beginPath();
            g.arc(x + ox - dx, y, 8, 0, Math.PI * 2);
            g.fill();
          }
        }
      break;
    }
    case 'planks': {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? A : shade(a, 0.9);
        g.fillRect(i * 32, 0, 32, S);
        // стык досок
        const y = (i * 37) % S;
        g.fillStyle = shade(b, 0.7);
        g.fillRect(i * 32, y, 32, 3);
        g.fillStyle = shade(b, 0.6);
        g.fillRect(i * 32 + 6, (y + 8) % S, 3, 3);
        g.fillRect(i * 32 + 23, (y + 8) % S, 3, 3);
        // волокна
        g.strokeStyle = shade(a, 0.82);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(i * 32 + 12, 0);
        g.bezierCurveTo(i * 32 + 18, 40, i * 32 + 8, 90, i * 32 + 14, S);
        g.stroke();
      }
      g.fillStyle = shade(b, 0.65);
      for (let i = 0; i <= 4; i++) g.fillRect(i * 32 - 1, 0, 2, S);
      break;
    }
    case 'diamonds': {
      g.fillStyle = B;
      for (const [cx, cy] of [[32, 32], [96, 32], [32, 96], [96, 96]]) {
        g.beginPath();
        g.moveTo(cx, cy - 28);
        g.lineTo(cx + 28, cy);
        g.lineTo(cx, cy + 28);
        g.lineTo(cx - 28, cy);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = shade(a, 1.15);
      g.lineWidth = 2;
      for (let k = -S; k <= S; k += 64) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + S, S);
        g.moveTo(k + S, 0);
        g.lineTo(k, S);
        g.stroke();
      }
      break;
    }
    case 'tiles': {
      g.fillStyle = shade(b, 0.85);
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          g.fillStyle = (x + y) % 2 ? A : shade(a, 0.93);
          if (g.roundRect) {
            g.beginPath();
            g.roundRect(x * 64 + 4, y * 64 + 4, 56, 56, 12);
            g.fill();
          } else g.fillRect(x * 64 + 4, y * 64 + 4, 56, 56);
          g.fillStyle = 'rgba(255,255,255,0.22)';
          g.fillRect(x * 64 + 12, y * 64 + 9, 32, 5);
        }
      break;
    }
    case 'zigzag': {
      g.fillStyle = B;
      for (let y = 0; y < S; y += 32) {
        g.beginPath();
        g.moveTo(0, y + 16);
        for (let x = 0; x <= S; x += 16) g.lineTo(x, y + (x / 16) % 2 * 10 + 6);
        for (let x = S; x >= 0; x -= 16) g.lineTo(x, y + (x / 16) % 2 * 10 + 18);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'grid': {
      g.fillStyle = shade(a, 0.94);
      g.fillRect(0, 0, 64, 64);
      g.fillRect(64, 64, 64, 64);
      g.fillStyle = B;
      for (let i = 0; i <= S; i += 32) {
        const w = i % 64 === 0 ? 4 : 2;
        g.fillRect(i - w / 2, 0, w, S);
        g.fillRect(0, i - w / 2, S, w);
      }
      break;
    }
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}
