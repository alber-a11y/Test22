// Аркадная физика игрока на транспорте. Чистая логика без рендера.
import { CONFIG } from '../core/config';
import { clamp } from '../core/rng';
import type { Platform } from '../world/platform';

export interface Controls {
  gas: boolean;
  brake: boolean;
  steer: number; // -1 влево .. +1 вправо
  jump: boolean; // нажатие (фронт)
  nitro: boolean;
}

export interface Stats {
  maxSpeed: number;
  accel: number;
  jump: number;
  turn: number;
  nitroRegenMul: number;
}

export interface BodyEvents {
  jump(): void;
  land(impact: number): void;
  bounce(): void;
  boost(): void;
  barrier(): void;
}

const G = CONFIG.gravity;

export class PlayerBody {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  grounded = false;
  ground: Platform | null = null;
  sinceGround = 0;
  jumpBuf = 0;
  jumpedSinceGround = false;
  surfaceVy = 0;
  boostT = 0;
  nitro = 1;
  nitroActive = false;
  jumpMul = 1;
  nitroRegenBonus = 1;
  stunT = 0;
  stats: Stats;

  constructor(stats: Stats, public ev: BodyEvents) {
    this.stats = stats;
  }

  reset(x: number, y: number, z: number, yaw: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
    this.vx = this.vy = this.vz = 0;
    this.grounded = false;
    this.ground = null;
    this.sinceGround = 0;
    this.jumpBuf = 0;
    this.boostT = 0;
    this.stunT = 0;
    this.nitroActive = false;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** Скорость вдоль направления взгляда. */
  get forwardSpeed(): number {
    return this.vx * -Math.sin(this.yaw) + this.vz * -Math.cos(this.yaw);
  }

  step(dt: number, c: Controls, plats: Platform[]): void {
    const st = this.stats;
    this.jumpBuf = c.jump ? CONFIG.jumpBuffer : this.jumpBuf - dt;
    this.stunT = Math.max(0, this.stunT - dt);
    const ctl = this.stunT > 0 ? { gas: false, brake: false, steer: 0, jump: false, nitro: false } : c;

    // Перенос движущейся платформой
    if (this.grounded && this.ground) {
      const p = this.ground;
      this.x += p.dx;
      this.y += p.dy;
      this.z += p.dz;
      if (p.dyaw !== 0) {
        const rx = this.x - p.x, rz = this.z - p.z;
        const cs = Math.cos(p.dyaw), sn = Math.sin(p.dyaw);
        this.x = p.x + rx * cs + rz * sn;
        this.z = p.z - rx * sn + rz * cs;
        this.yaw += p.dyaw;
      }
    }

    // Нитро и бусты
    if (ctl.nitro && this.nitro > 0.02) {
      this.nitroActive = true;
      this.nitro = Math.max(0, this.nitro - CONFIG.nitroDrain * dt);
    } else {
      this.nitroActive = false;
      this.nitro = Math.min(1, this.nitro + CONFIG.nitroRegen * st.nitroRegenMul * this.nitroRegenBonus * dt);
    }
    this.boostT = Math.max(0, this.boostT - dt);

    // Руль
    let s = this.forwardSpeed;
    const steerF = clamp(Math.abs(s) / 5, 0.45, 1) * (this.grounded ? 1 : 0.75);
    this.yaw -= ctl.steer * st.turn * steerF * dt * (s < -0.5 ? -1 : 1);

    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    s = this.vx * fx + this.vz * fz;
    let l = this.vx * rx + this.vz * rz;

    const max = st.maxSpeed * (this.boostT > 0 ? CONFIG.boostSpeedMul : 1) * (this.nitroActive ? CONFIG.nitroSpeedMul : 1);
    if (this.grounded) {
      if (ctl.gas || this.nitroActive) {
        if (s < max) s = Math.min(max, s + st.accel * (this.nitroActive ? 1.6 : 1) * dt);
        else s += (max - s) * (1 - Math.exp(-2.5 * dt));
      } else if (ctl.brake) {
        if (s > 0) s = Math.max(0, s - st.accel * 1.8 * dt);
        else s = Math.max(-st.maxSpeed * 0.35, s - st.accel * 0.5 * dt);
      } else {
        s *= Math.exp(-1.1 * dt);
        if (Math.abs(s) < 0.2) s = 0;
        if (s > max) s += (max - s) * (1 - Math.exp(-2.5 * dt));
      }
      l *= Math.exp(-12 * dt);
    } else {
      if (ctl.gas && s < max) s = Math.min(max, s + st.accel * 0.3 * dt);
      if (ctl.brake && s > 0) s = Math.max(0, s - st.accel * 0.4 * dt);
      l *= Math.exp(-3 * dt);
    }
    this.vx = fx * s + rx * l;
    this.vz = fz * s + rz * l;

    // Уклон поверхности ускоряет вниз по склону
    if (this.grounded && this.ground) {
      const p = this.ground;
      const [gx, gz] = p.gradWorld(p.toLocalX(this.x, this.z), p.toLocalZ(this.x, this.z));
      this.vx -= gx * G * 0.55 * dt;
      this.vz -= gz * G * 0.55 * dt;
      this.surfaceVy = gx * this.vx + gz * this.vz + p.dy / dt;
    }

    // Прыжок (с «временем койота»)
    const canJump = this.grounded || (this.sinceGround < CONFIG.coyoteTime && !this.jumpedSinceGround);
    if (this.jumpBuf > 0 && canJump) {
      this.vy = st.jump * this.jumpMul + Math.max(0, this.grounded ? this.surfaceVy : 0);
      this.grounded = false;
      this.ground = null;
      this.jumpBuf = 0;
      this.jumpedSinceGround = true;
      this.ev.jump();
    }

    if (!this.grounded) {
      this.vy -= G * dt;
      this.sinceGround += dt;
    }

    const prevY = this.y;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (!this.grounded) this.y += this.vy * dt;

    this.collideWalls(plats);
    this.findGround(plats, prevY, dt);
  }

  private collideWalls(plats: Platform[]): void {
    const R = CONFIG.playerRadius, H = CONFIG.playerHeight;
    for (const p of plats) {
      if (!p.active) continue;
      const ddx = this.x - p.x, ddz = this.z - p.z;
      if (ddx * ddx + ddz * ddz > (p.radius + R) * (p.radius + R)) continue;
      const d = p.def;
      const lx = p.toLocalX(this.x, this.z), lz = p.toLocalZ(this.x, this.z);
      const hw = d.w / 2 + R, hl = d.l / 2 + R;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
      const cx = clamp(lx, -d.w / 2, d.w / 2), cz = clamp(lz, -d.l / 2, d.l / 2);
      const top = p.topAt(cx, cz);
      const barrier = d.role === 'barrier';
      const bottom = top - d.th;
      if (barrier) {
        if (this.y >= top || this.y + H <= bottom) continue;
      } else {
        if (this.y >= top - CONFIG.stepUp || this.y + H <= bottom) continue;
      }
      // Выталкиваем по оси наименьшего проникновения
      const penX = hw - Math.abs(lx), penZ = hl - Math.abs(lz);
      let nlx = 0, nlz = 0;
      if (penX < penZ) nlx = Math.sign(lx) || 1;
      else nlz = Math.sign(lz) || 1;
      const pen = Math.min(penX, penZ);
      const [nx, nz] = p.dirToWorld(nlx, nlz);
      this.x += nx * pen;
      this.z += nz * pen;
      const vn = this.vx * nx + this.vz * nz;
      if (barrier) {
        // Отбрасывает назад
        const push = 7;
        this.vx += nx * (push - vn);
        this.vz += nz * (push - vn);
        if (d.motion?.type === 'spin') {
          // добавляем касательную скорость вращающейся палки
          const tx = -(this.z - p.z) * d.motion.speed, tz = (this.x - p.x) * d.motion.speed;
          this.vx += tx * 0.5;
          this.vz += tz * 0.5;
        }
        this.vy = Math.max(this.vy, 5);
        this.grounded = false;
        this.ground = null;
        this.stunT = 0.35;
        this.ev.barrier();
      } else if (vn < 0) {
        this.vx -= nx * vn;
        this.vz -= nz * vn;
      }
    }
  }

  private findGround(plats: Platform[], prevY: number, dt: number): void {
    let best: Platform | null = null;
    let bestH = -Infinity;
    const fall = Math.max(0, -this.vy * dt);
    for (const p of plats) {
      if (!p.active || p.def.role === 'barrier') continue;
      const ddx = this.x - p.x, ddz = this.z - p.z;
      if (ddx * ddx + ddz * ddz > p.radius * p.radius) continue;
      const d = p.def;
      const lx = p.toLocalX(this.x, this.z), lz = p.toLocalZ(this.x, this.z);
      if (Math.abs(lx) > d.w / 2 + 0.12 || Math.abs(lz) > d.l / 2 + 0.12) continue;
      const h = p.topAt(clamp(lx, -d.w / 2, d.w / 2), clamp(lz, -d.l / 2, d.l / 2));
      const below = this.grounded ? CONFIG.snapDown + Math.abs(p.dy) : 0.02;
      if (this.y < h - CONFIG.stepUp - fall) continue;
      if (this.y > h + below) continue;
      if (!this.grounded && this.vy > 0 && prevY < h - 0.05 && this.y < h - 0.05) {
        // ещё летим вверх сквозь край — подсадим, только если почти достали
        if (h - this.y > 0.25) continue;
      }
      if (h > bestH) {
        bestH = h;
        best = p;
      }
    }

    if (best) {
      const wasGrounded = this.grounded;
      const impact = -this.vy;
      this.y = bestH;
      if (best.def.role === 'bounce') {
        // Батут подбрасывает и при наезде, и при приземлении
        this.vy = CONFIG.bounceVelocity * this.jumpMul ** 0.5;
        this.grounded = false;
        this.ground = null;
        this.sinceGround = 0;
        this.jumpedSinceGround = true;
        this.ev.bounce();
        return;
      }
      if (!wasGrounded) this.ev.land(impact);
      this.grounded = true;
      this.vy = 0;
      this.sinceGround = 0;
      this.jumpedSinceGround = false;
      if (best.def.role === 'vanish' && best.vanishT < 0) best.vanishT = 0;
      if (best.def.boost) {
        if (this.boostT < CONFIG.boostDuration - 0.3) this.ev.boost();
        this.boostT = CONFIG.boostDuration;
      }
      this.ground = best;
    } else if (this.grounded) {
      // Съехали с края: сохраняем вертикальную скорость поверхности (трамплины!)
      this.grounded = false;
      this.ground = null;
      this.vy = this.surfaceVy;
      this.sinceGround = 0;
    }
  }
}
