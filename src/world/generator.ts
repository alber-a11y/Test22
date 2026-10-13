// Генератор уровней: первые 20 — авторские рецепты, дальше — бесконечная процедурная генерация.
import { CONFIG } from '../core/config';
import { Rng, clamp, lerp } from '../core/rng';
import { themeForLevel, type Theme } from './themes';
import { profileEndRise, type PlatformDef } from './platform';

export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface LevelData {
  number: number;
  theme: Theme;
  platforms: PlatformDef[];
  coins: [number, number, number][];
  checkpoints: Spot[]; // [0] — старт
  finish: Spot & { w: number };
  path: [number, number, number][];
  pathSeg: string[]; // имя сегмента для каждой точки пути (отладка)
  parTime: number;
  killY: number;
}

type SegName =
  | 'straight' | 'gaps' | 'islands' | 'stairsUp' | 'stairsDown' | 'beam' | 'zigzag' | 'ramp'
  | 'descent' | 'moving' | 'barriers' | 'spinner' | 'vanish' | 'bounce' | 'boostJump' | 'turn' | 'lift';

type Step = [SegName, number] | 'cp';

// Авторские уровни 1–20: постепенно знакомим с механиками.
const RECIPES: Step[][] = [
  /* 1 */ [['straight', 0], ['gaps', 0], 'cp', ['straight', 0], ['gaps', 0.05]],
  /* 2 */ [['gaps', 0.1], ['islands', 0], 'cp', ['stairsUp', 0], ['straight', 0]],
  /* 3 */ [['straight', 0], ['barriers', 0], 'cp', ['gaps', 0.15], ['barriers', 0.1]],
  /* 4 */ [['zigzag', 0], 'cp', ['beam', 0], ['islands', 0.15]],
  /* 5 */ [['ramp', 0], 'cp', ['gaps', 0.2], ['ramp', 0.1]],
  /* 6 */ [['moving', 0], 'cp', ['islands', 0.2], ['moving', 0.1]],
  /* 7 */ [['descent', 0], 'cp', ['stairsDown', 0.2], ['gaps', 0.25]],
  /* 8 */ [['bounce', 0], 'cp', ['beam', 0.2], ['bounce', 0.15], ['zigzag', 0.2]],
  /* 9 */ [['vanish', 0], 'cp', ['gaps', 0.3], ['vanish', 0.2], ['barriers', 0.3]],
  /* 10 */ [['descent', 0.2], 'cp', ['moving', 0.3], ['ramp', 0.3], 'cp', ['spinner', 0], ['islands', 0.3]],
  /* 11 */ [['spinner', 0.1], ['boostJump', 0], 'cp', ['beam', 0.35], ['stairsUp', 0.3], ['gaps', 0.35]],
  /* 12 */ [['islands', 0.4], ['turn', 0.3], 'cp', ['moving', 0.4], ['barriers', 0.4], ['vanish', 0.3]],
  /* 13 */ [['descent', 0.4], 'cp', ['bounce', 0.4], ['zigzag', 0.4], 'cp', ['lift', 0.3], ['gaps', 0.45]],
  /* 14 */ [['ramp', 0.45], ['beam', 0.4], 'cp', ['spinner', 0.4], ['islands', 0.45], ['stairsDown', 0.4]],
  /* 15 */ [['boostJump', 0.4], 'cp', ['vanish', 0.45], ['moving', 0.5], 'cp', ['barriers', 0.5], ['zigzag', 0.5]],
  /* 16 */ [['descent', 0.5], ['gaps', 0.5], 'cp', ['lift', 0.5], ['beam', 0.5], 'cp', ['spinner', 0.5], ['islands', 0.5]],
  /* 17 */ [['turn', 0.5], ['stairsUp', 0.55], ['bounce', 0.5], 'cp', ['vanish', 0.55], ['ramp', 0.55], 'cp', ['moving', 0.55]],
  /* 18 */ [['islands', 0.6], ['barriers', 0.6], 'cp', ['descent', 0.6], ['boostJump', 0.55], 'cp', ['zigzag', 0.6], ['gaps', 0.6]],
  /* 19 */ [['beam', 0.6], ['spinner', 0.6], 'cp', ['lift', 0.6], ['vanish', 0.6], 'cp', ['stairsUp', 0.65], ['moving', 0.65], ['islands', 0.65]],
  /* 20 */ [['descent', 0.65], ['gaps', 0.65], 'cp', ['bounce', 0.6], ['zigzag', 0.65], 'cp', ['spinner', 0.65], ['barriers', 0.65], 'cp', ['ramp', 0.7], ['vanish', 0.65]],
];

const ENDLESS_POOL: [SegName, number][] = [
  ['gaps', 3], ['islands', 3], ['stairsUp', 2], ['stairsDown', 1.5], ['beam', 2], ['zigzag', 2], ['ramp', 2],
  ['descent', 1.2], ['moving', 2.5], ['barriers', 2], ['spinner', 1.8], ['vanish', 2], ['bounce', 1.5],
  ['boostJump', 1.5], ['turn', 1], ['lift', 1.5],
];

class Builder {
  platforms: PlatformDef[] = [];
  coins: [number, number, number][] = [];
  checkpoints: Spot[] = [];
  path: [number, number, number][] = [];
  pathSeg: string[] = [];
  seg = 'start';
  cx = 0;
  cy = 0;
  cz = 0;
  yaw = 0;
  extraTime = 0;

  constructor(public rng: Rng) {
    this.path.push([0, 0, 0]);
    this.pathSeg.push('start');
  }

  fwd(): [number, number] {
    return [-Math.sin(this.yaw), -Math.cos(this.yaw)];
  }
  right(): [number, number] {
    return [Math.cos(this.yaw), -Math.sin(this.yaw)];
  }
  /** Точка относительно курсора: a — вбок, s — вперёд. */
  at(a: number, s: number): [number, number] {
    const [fx, fz] = this.fwd();
    const [rx, rz] = this.right();
    return [this.cx + rx * a + fx * s, this.cz + rz * a + fz * s];
  }

  mark(): void {
    this.path.push([this.cx, this.cy, this.cz]);
    this.pathSeg.push(this.seg);
  }

  /** Плитка впереди курсора; курсор переезжает на её дальний край. */
  tile(len: number, w: number, o: Partial<PlatformDef> & { a?: number; dy?: number; gap?: number; keepCursor?: boolean } = {}): PlatformDef {
    const a = o.a ?? 0, dy = o.dy ?? 0, gap = o.gap ?? 0;
    const [x, z] = this.at(a, gap + len / 2);
    const def: PlatformDef = {
      x, y: this.cy + dy, z, yaw: this.yaw, w, l: len, th: o.th ?? 1.2, role: o.role ?? 'tile',
      profile: o.profile, motion: o.motion, boost: o.boost, lift: o.lift,
    };
    this.platforms.push(def);
    if (!o.keepCursor) {
      const [nx, nz] = this.at(a, gap + len);
      this.cx = nx;
      this.cz = nz;
      this.cy += dy + profileEndRise(def);
      this.mark();
    }
    return def;
  }

  coinLine(s0: number, s1: number, n: number, a = 0, h = 0.9): void {
    for (let i = 0; i < n; i++) {
      const s = n === 1 ? (s0 + s1) / 2 : lerp(s0, s1, i / (n - 1));
      const [x, z] = this.at(a, s);
      this.coins.push([x, this.cy + h, z]);
    }
  }

  /** Дуга монет над пропастью длиной gap (относительно текущего курсора). */
  coinArc(gap: number, dy: number, n = 3, peak = 1.8, a = 0): void {
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      const [x, z] = this.at(a * t, gap * t);
      this.coins.push([x, this.cy + 0.9 + dy * t + peak * 4 * t * (1 - t), z]);
    }
  }

  checkpoint(): void {
    const len = 6, w = 6.5;
    this.tile(len, w, { keepCursor: true });
    const [x, z] = this.at(0, len / 2);
    this.checkpoints.push({ x, y: this.cy, z, yaw: this.yaw });
    const [nx, nz] = this.at(0, len);
    this.cx = nx;
    this.cz = nz;
    this.mark();
  }

  turnBy(angle: number, w: number): void {
    // Квадратная площадка на стыке скрывает поворот.
    const [x, z] = this.at(0, w / 2);
    this.platforms.push({ x, y: this.cy, z, yaw: this.yaw + angle / 2, w: w * 1.15, l: w * 1.15, th: 1.2, role: 'tile' });
    this.cx = x;
    this.cz = z;
    this.yaw = clamp(this.yaw + angle, -0.9, 0.9);
    const [nx, nz] = this.at(0, w * 0.5);
    this.cx = nx;
    this.cz = nz;
    this.mark();
  }
}

// ---------------------------------------------------------------- сегменты

type SegFn = (b: Builder, d: number, r: Rng) => void;

// Геометрия рассчитана на прыжок с полного газа: дальность ~9–11 м, высота ~1.7 м.
// Правило: пропасть + длина площадки приземления ≥ ~12, чтобы не перелетать.
const m1 = (d: number) => Math.min(d, 1);

const SEGMENTS: Record<SegName, SegFn> = {
  straight(b, d, r) {
    const len = r.range(10, 16), w = lerp(5, 3.2, m1(d));
    b.coinLine(2, len - 2, 4);
    b.tile(len, w);
  },

  gaps(b, d, r) {
    const n = 2 + Math.round(m1(d) * 2);
    for (let i = 0; i < n; i++) {
      const gap = r.range(lerp(2.2, 3.4, m1(d)), lerp(3.2, 4.8, m1(d)));
      const len = Math.max(7, 12.5 - gap) + r.range(0, 1.5);
      const a = r.range(-1, 1) * lerp(0, 1.3, m1(d));
      b.coinArc(gap, 0, 3, 1.5, a);
      b.tile(len, lerp(4.5, 3, m1(d)), { gap, a });
    }
  },

  islands(b, d, r) {
    const n = 3 + Math.floor(m1(d) * 2);
    const w = lerp(4, 2.8, m1(d));
    for (let i = 0; i < n; i++) {
      const gap = r.range(1.8, lerp(2.8, 3.8, m1(d)));
      const l = Math.max(6, 12 - gap) + r.range(-0.3, 0.6);
      const a = r.sign() * r.range(0, lerp(0.6, 1.4, m1(d)));
      const dy = r.range(-0.3, 0.4) * d;
      b.coinArc(gap, dy, 2, 1.4, a);
      b.tile(l, w, { gap, a, dy });
    }
  },

  stairsUp(b, d, r) {
    const n = 3 + (r.next() < d ? 1 : 0);
    b.tile(6, 4.2);
    for (let i = 0; i < n; i++) {
      const gap = r.range(1.2, lerp(2, 3, m1(d)));
      const dy = r.range(0.7, lerp(1.0, 1.25, m1(d)));
      b.coinArc(gap, dy, 2, 1.2);
      b.tile(Math.max(6, 10.5 - gap) + r.range(0, 1), 4, { gap, dy });
    }
  },

  stairsDown(b, d, r) {
    for (let i = 0; i < 3; i++) {
      const gap = r.range(2, lerp(3, 4.4, m1(d)));
      const dy = -r.range(1.2, 2.2);
      b.coinArc(gap, dy, 3, 1.2);
      b.tile(Math.max(8, 15 - gap), lerp(4.5, 3.2, m1(d)), { gap, dy });
    }
  },

  beam(b, d, r) {
    const w = lerp(2.2, 1.1, Math.min(d, 1.2));
    b.tile(4, 4);
    const len = r.range(10, 16);
    b.coinLine(1, len - 1, 5);
    b.tile(len, w);
    if (d > 0.35) {
      const a = r.sign() * r.range(0.7, 1.3);
      const gap = r.range(1.5, 2.4);
      b.coinArc(gap, 0, 2, 1.2, a);
      b.tile(r.range(11, 14), Math.max(w, 1.7), { gap, a });
    }
    b.tile(4, 4);
  },

  zigzag(b, d, r) {
    const n = 3 + Math.floor(m1(d) * 2);
    const w = lerp(3.5, 2.3, m1(d));
    let sign = b.yaw > 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const ang = sign * r.range(0.35, lerp(0.5, 0.7, m1(d)));
      b.turnBy(ang, w);
      const len = r.range(6, 9);
      b.coinLine(1, len - 1, 3);
      b.tile(len, w);
      sign = -sign;
    }
    b.turnBy(-b.yaw * 0.7, w);
  },

  ramp(b, d, r) {
    b.tile(8, 4.5);
    const rise = lerp(1.4, 2.2, m1(d));
    b.tile(6, 4.5, { profile: { type: 'ramp', rise } });
    const gap = r.range(lerp(4, 6, m1(d)), lerp(5.5, 8, m1(d)));
    const dy = -rise * 0.6;
    b.coinArc(gap, dy, 4, 2.4);
    b.tile(Math.max(10, 18 - gap), 5, { gap, dy });
  },

  descent(b, d, r) {
    b.tile(6, 6);
    const len = r.range(lerp(28, 36, m1(d)), lerp(32, 44, m1(d)));
    const drop = len * 0.3;
    const start = b.cy;
    b.tile(len, 6.5, { profile: { type: 'descent', drop, pipe: 1.6 }, th: 1.4, boost: true });
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const [x, z] = b.at(0, -len + len * t);
      const sm = t * t * (3 - 2 * t);
      b.coins.push([x, start - drop * sm + 0.9, z]);
    }
    b.tile(10, 5.5);
    const gap = r.range(5, lerp(7, 10, m1(d)));
    b.coinArc(gap, -1, 4, 2.2);
    b.tile(Math.max(16, 26 - gap), 5, { gap, dy: -1 });
  },

  moving(b, d, r) {
    b.tile(6, 4.5);
    const k = 1 + Math.min(2, Math.floor(d * 2.5 + r.next() * 0.5));
    const speed = lerp(0.8, 1.6, Math.min(d, 1.3));
    for (let i = 0; i < k; i++) {
      const gap = r.range(1.8, lerp(2.4, 3.2, m1(d)));
      const vertical = r.next() < 0.3;
      const amp = vertical ? lerp(0.6, 1.1, m1(d)) : lerp(1.5, 3, m1(d));
      const [rx, rz] = b.right();
      const motion = vertical
        ? { type: 'slide' as const, ax: 0, ay: amp, az: 0, speed, phase: r.range(0, 6.28) }
        : { type: 'slide' as const, ax: rx * amp, ay: 0, az: rz * amp, speed, phase: r.range(0, 6.28) };
      b.coinArc(gap, 0, 2, 1.2);
      b.tile(Math.max(6, 11.5 - gap), 4, { gap, motion, th: 0.8 });
    }
    const gap = r.range(1.8, 2.8);
    b.tile(Math.max(8, 12 - gap), 4.5, { gap });
  },

  barriers(b, d, r) {
    const n = 2 + Math.floor(m1(d) * 2);
    const spacing = lerp(11, 9.5, m1(d));
    const w = lerp(4.6, 3.6, m1(d));
    const len = 7 + spacing * n;
    for (let i = 0; i < n; i++) {
      const s = 7 + spacing * i;
      const h = lerp(0.55, 0.8, m1(d)) + r.range(-0.05, 0.05);
      const [x, z] = b.at(0, s);
      b.platforms.push({ x, y: b.cy + h, z, yaw: b.yaw, w: w + 0.6, l: 0.4, th: 0.35, role: 'barrier', lift: h - 0.35 });
      b.coinLine(s, s, 1, 0, h + 1.1);
    }
    b.tile(len, w);
  },

  spinner(b, d, r) {
    const size = 10;
    b.tile(3, 4.5);
    b.tile(size, size, { keepCursor: true });
    const [x, z] = b.at(0, size / 2);
    const speed = r.sign() * lerp(0.9, 2, Math.min(d, 1.3));
    b.platforms.push({ x, y: b.cy + 0.95, z, yaw: b.yaw, w: size - 1.2, l: 0.6, th: 0.6, role: 'barrier', lift: 0.35, motion: { type: 'spin', speed } });
    b.coinLine(size / 2 - 3, size / 2 - 3, 1, 3);
    b.coinLine(size / 2 + 3, size / 2 + 3, 1, -3);
    const [nx, nz] = b.at(0, size);
    b.cx = nx;
    b.cz = nz;
    b.mark();
    b.tile(5, 4.5);
    b.extraTime += 1.5;
  },

  vanish(b, d, r) {
    // Осыпающийся мост: плитки уходят из-под колёс — нельзя останавливаться.
    b.tile(5, 4.5);
    const n = 4 + Math.floor(m1(d) * 3);
    const w = lerp(3.6, 2.6, m1(d));
    for (let i = 0; i < n; i++) {
      b.tile(3.4, w, { gap: 0.12, role: 'vanish', th: 0.7, a: i === 0 ? 0 : r.range(-0.3, 0.3) * d });
      b.coinLine(-1.7, -1.7, 1);
    }
    b.tile(7, 4.5, { gap: 0.12 });
  },

  bounce(b, d, r) {
    b.tile(6, 4.5);
    b.tile(3.2, 3.6, { role: 'bounce', th: 0.9 });
    const gap = 4.5;
    const dy = lerp(2.4, 3.4, m1(d));
    b.coinArc(gap + 3, dy, 4, 3.2);
    b.tile(14, 4.5, { gap, dy });
  },

  boostJump(b, d, r) {
    b.tile(4, 4.5);
    b.tile(10, 4.5, { boost: true });
    const gap = r.range(lerp(6.5, 8, m1(d)), lerp(8, 10.5, m1(d)));
    b.coinArc(gap, 0, 5, 2.2);
    b.tile(Math.max(16, 27 - gap), 5, { gap });
  },

  turn(b, d, r) {
    const w = 4.5;
    const sign = b.yaw > 0.1 ? -1 : b.yaw < -0.1 ? 1 : r.sign();
    for (let i = 0; i < 3; i++) {
      b.turnBy(sign * 0.28, w);
      b.coinLine(0.5, 2.5, 2);
      b.tile(3, w);
    }
    b.tile(6, w);
    void d;
  },

  lift(b, d, r) {
    // Платформа-лифт ездит вперёд-назад над пропастью: заехать, притормозить, съехать.
    b.tile(5, 4.5);
    const span = lerp(12, 15, m1(d));
    const [fx, fz] = b.fwd();
    const pl = 6;
    const amp = span / 2 - pl / 2 - 0.2;
    const speed = lerp(0.7, 1.2, Math.min(d, 1.3));
    b.tile(pl, 4.5, { keepCursor: true, gap: span / 2 - pl / 2, motion: { type: 'slide', ax: fx * amp, ay: 0, az: fz * amp, speed, phase: r.range(0, 6.28) }, th: 0.8 });
    b.coinLine(span / 2 - 1, span / 2 + 1, 3, 0, 1.2);
    const [nx, nz] = b.at(0, span);
    b.cx = nx;
    b.cz = nz;
    b.mark();
    b.tile(8, 4.5);
    b.extraTime += 3;
  },
};

// ---------------------------------------------------------------- сборка уровня

export function pathLength(path: [number, number, number][]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
  return len;
}

export function generateLevel(n: number): LevelData {
  const rng = new Rng(n * 7919 + 13);
  const b = new Builder(rng);

  // Стартовая площадка
  b.tile(10, 7);
  b.checkpoints.push({ x: 0, y: 0, z: -3, yaw: 0 });

  let steps: Step[];
  if (n <= CONFIG.handcraftedLevels) {
    steps = RECIPES[n - 1];
  } else {
    const k = n - CONFIG.handcraftedLevels;
    const base = Math.min(1.3, 0.62 + k * 0.018);
    const count = Math.min(6 + Math.floor(k / 5), 14);
    steps = [];
    let last: SegName | null = null;
    for (let i = 0; i < count; i++) {
      let s: SegName;
      do s = rng.weighted(ENDLESS_POOL);
      while (s === last);
      last = s;
      steps.push([s, clamp(base + rng.range(-0.12, 0.08), 0, 1.3)]);
      if (i % 2 === 1 && i < count - 1) steps.push('cp');
    }
  }

  for (const st of steps) {
    b.seg = st === 'cp' ? 'cp' : st[0];
    if (st === 'cp') b.checkpoint();
    else SEGMENTS[st[0]](b, st[1], rng);
  }

  // Удлиняем трассу: добиваем сегментами того же уровня (те же механики и сложность)
  const FINISH_LEN = 16; // финишная часть добавляется ниже
  const target = (pathLength(b.path) + FINISH_LEN) * CONFIG.trackLengthMul - FINISH_LEN;
  const pool = steps.filter((st): st is [SegName, number] => st !== 'cp');
  let extra = 0;
  while (CONFIG.trackLengthMul > 1 && target - pathLength(b.path) > 12 && extra < 12) {
    if (extra % 2 === 0) {
      b.seg = 'cp';
      b.checkpoint();
    }
    const [name, d] = pool[Math.floor(rng.next() * pool.length)];
    b.seg = name;
    SEGMENTS[name](b, d, rng);
    extra++;
  }
  // Остаток добиваем прямой плиткой с монетами
  const rest = target - pathLength(b.path);
  if (CONFIG.trackLengthMul > 1 && rest > 2) {
    b.seg = 'straight';
    b.coinLine(1, rest - 1, Math.max(2, Math.round(rest / 3)));
    b.tile(rest, 4.5);
  }

  // Финиш
  b.tile(4, 5);
  const finLen = 12, finW = 8;
  b.tile(finLen, finW, { keepCursor: true });
  const [fx, fz] = b.at(0, finLen * 0.55);
  const finish = { x: fx, y: b.cy, z: fz, yaw: b.yaw, w: finW };
  const [ex, ez] = b.at(0, finLen);
  b.path.push([ex, b.cy, ez]);
  b.pathSeg.push('finish');

  const len = pathLength(b.path);
  let minY = 0;
  for (const p of b.platforms) minY = Math.min(minY, p.y - (p.profile?.type === 'descent' ? p.profile.drop : 0));

  return {
    number: n,
    theme: themeForLevel(n),
    platforms: b.platforms,
    coins: b.coins,
    checkpoints: b.checkpoints,
    finish,
    path: b.path,
    pathSeg: b.pathSeg,
    parTime: Math.round(len / 8.5 + b.extraTime + 3),
    killY: minY - 14,
  };
}
