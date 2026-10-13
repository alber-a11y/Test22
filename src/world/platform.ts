// Платформы уровня: описание + состояние во время игры (движение, исчезновение).

export type Role = 'tile' | 'barrier' | 'bounce' | 'vanish';

export type Profile =
  | { type: 'flat' }
  | { type: 'ramp'; rise: number }
  | { type: 'descent'; drop: number; pipe: number };

export type Motion =
  | { type: 'slide'; ax: number; ay: number; az: number; speed: number; phase: number }
  | { type: 'spin'; speed: number };

export interface PlatformDef {
  x: number;
  y: number; // высота верхней поверхности в начале (лок. z = +l/2)
  z: number;
  yaw: number;
  w: number; // ширина (лок. X)
  l: number; // длина (лок. Z, вперёд = -Z)
  th: number; // толщина
  role: Role;
  profile?: Profile;
  motion?: Motion;
  boost?: boolean; // ускоряющая дорожка с шевронами
  lift?: number; // для барьеров: высота нижней грани над y
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothD = (t: number) => 6 * t * (1 - t);

/** Высота профиля относительно def.y в локальных координатах. */
export function profileHeight(def: PlatformDef, lx: number, lz: number): number {
  const p = def.profile;
  if (!p || p.type === 'flat') return 0;
  const t = Math.min(1, Math.max(0, (def.l / 2 - lz) / def.l));
  if (p.type === 'ramp') return p.rise * t;
  const side = Math.min(1, Math.abs(lx) / (def.w / 2));
  return -p.drop * smooth(t) + p.pipe * side * side * side * side;
}

/** Производные профиля: dh/dlx, dh/dlz. */
export function profileGrad(def: PlatformDef, lx: number, lz: number): [number, number] {
  const p = def.profile;
  if (!p || p.type === 'flat') return [0, 0];
  const t = (def.l / 2 - lz) / def.l;
  if (t < 0 || t > 1) return [0, 0];
  if (p.type === 'ramp') return [0, -p.rise / def.l];
  const hw = def.w / 2;
  const s = Math.min(1, Math.abs(lx) / hw);
  const dx = (4 * p.pipe * s * s * s * Math.sign(lx)) / hw;
  const dz = (p.drop * smoothD(t)) / def.l; // dt/dlz = -1/l, h = -drop*smooth(t)
  return [dx, dz];
}

export function profileEndRise(def: PlatformDef): number {
  const p = def.profile;
  if (!p || p.type === 'flat') return 0;
  if (p.type === 'ramp') return p.rise;
  return -p.drop;
}

export class Platform {
  x: number;
  y: number;
  z: number;
  yaw: number;
  // смещение за последний шаг (для переноса игрока)
  dx = 0;
  dy = 0;
  dz = 0;
  dyaw = 0;
  active = true;
  vanishT = -1; // >=0: идёт отсчёт до исчезновения
  hiddenT = 0;
  cos = 1;
  sin = 0;
  radius: number;
  object: { position: { set(x: number, y: number, z: number): void }; rotation: { y: number }; visible: boolean } | null = null;
  fade = 1;

  constructor(public def: PlatformDef, public index: number) {
    this.x = def.x;
    this.y = def.y;
    this.z = def.z;
    this.yaw = def.yaw;
    this.updateTrig();
    this.radius = Math.hypot(def.w, def.l) / 2 + (def.motion?.type === 'slide' ? Math.hypot(def.motion.ax, def.motion.az) : 0) + 1;
  }

  private updateTrig(): void {
    this.cos = Math.cos(this.yaw);
    this.sin = Math.sin(this.yaw);
  }

  /** Обновление движения на момент времени t. */
  update(t: number, dt: number): void {
    const m = this.def.motion;
    const px = this.x, py = this.y, pz = this.z, pyaw = this.yaw;
    if (m?.type === 'slide') {
      const s = Math.sin(t * m.speed + m.phase);
      this.x = this.def.x + m.ax * s;
      this.y = this.def.y + m.ay * s;
      this.z = this.def.z + m.az * s;
    } else if (m?.type === 'spin') {
      this.yaw = this.def.yaw + t * m.speed;
      this.updateTrig();
    }
    this.dx = this.x - px;
    this.dy = this.y - py;
    this.dz = this.z - pz;
    this.dyaw = this.yaw - pyaw;

    if (this.def.role === 'vanish') {
      if (this.vanishT >= 0) {
        this.vanishT += dt;
        this.fade = 1 - Math.min(1, this.vanishT / 0.6) * 0.6;
        if (this.vanishT > 0.6) {
          this.active = false;
          this.vanishT = -1;
          this.hiddenT = 2.6;
        }
      } else if (!this.active) {
        this.hiddenT -= dt;
        this.fade = 0;
        if (this.hiddenT <= 0) {
          this.active = true;
          this.fade = 1;
        }
      }
    }
  }

  reset(): void {
    this.active = true;
    this.vanishT = -1;
    this.hiddenT = 0;
    this.fade = 1;
  }

  toLocalX(px: number, pz: number): number {
    const wx = px - this.x, wz = pz - this.z;
    return wx * this.cos - wz * this.sin;
  }
  toLocalZ(px: number, pz: number): number {
    const wx = px - this.x, wz = pz - this.z;
    return wx * this.sin + wz * this.cos;
  }
  /** Локальный вектор -> мировой (без переноса). */
  dirToWorld(lx: number, lz: number): [number, number] {
    return [lx * this.cos + lz * this.sin, -lx * this.sin + lz * this.cos];
  }

  topAt(lx: number, lz: number): number {
    return this.y + profileHeight(this.def, lx, lz);
  }

  /** Мировой градиент высоты поверхности. */
  gradWorld(lx: number, lz: number): [number, number] {
    const [gx, gz] = profileGrad(this.def, lx, lz);
    return this.dirToWorld(gx, gz);
  }
}
