// Автопилот: управляет PlayerBody по пути уровня. Используется соперниками и тестовым ботом.
import { CONFIG } from '../core/config';
import { Rng, clamp } from '../core/rng';
import { profileHeight, type Platform } from '../world/platform';
import type { Controls, PlayerBody } from './body';

export interface PilotSkill {
  lane: number; // смещение от оси трассы (м)
  mistake: number; // вероятность опоздать с прыжком
  hesitate: number; // шанс в секунду ненадолго отпустить газ
}

const pose = { x: 0, y: 0, z: 0, yaw: 0 };

/** Высота земли в точке (x,z) на момент времени t (движущиеся платформы — по предсказанию). */
export function groundAt(plats: Platform[], x: number, z: number, y: number, t?: number): number | null {
  let best: number | null = null;
  for (const p of plats) {
    if (p.def.role === 'barrier') continue;
    if (t === undefined || !p.def.motion) {
      if (!p.active) continue;
      const lx = p.toLocalX(x, z), lz = p.toLocalZ(x, z);
      if (Math.abs(lx) > p.def.w / 2 || Math.abs(lz) > p.def.l / 2) continue;
      const h = p.topAt(lx, lz);
      if (h < y + 2.5 && (best === null || h > best)) best = h;
    } else {
      p.poseAt(t, pose);
      const cs = Math.cos(pose.yaw), sn = Math.sin(pose.yaw);
      const wx = x - pose.x, wz = z - pose.z;
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
      if (Math.abs(lx) > p.def.w / 2 || Math.abs(lz) > p.def.l / 2) continue;
      const h = pose.y + profileHeight(p.def, lx, lz);
      if (h < y + 2.5 && (best === null || h > best)) best = h;
    }
  }
  return best;
}

function barrierAhead(plats: Platform[], x: number, z: number, y: number): boolean {
  for (const p of plats) {
    if (p.def.role !== 'barrier') continue;
    const lx = p.toLocalX(x, z), lz = p.toLocalZ(x, z);
    if (Math.abs(lx) < p.def.w / 2 + 0.5 && Math.abs(lz) < p.def.l / 2 + 0.5 && y < p.y + 0.2) return true;
  }
  return false;
}

function movingNear(plats: Platform[], x: number, z: number, r: number): boolean {
  for (const p of plats) {
    if (!p.def.motion || p.def.role === 'barrier') continue;
    if (Math.hypot(p.x - x, p.z - z) < r + p.radius) return true;
  }
  return false;
}

export class Autopilot {
  pathIdx = 1;
  private waitT = 0;
  private lateT = -1;
  private hesitateT = 0;
  private rng: Rng;

  constructor(private path: [number, number, number][], public skill: PilotSkill, seed: number) {
    this.rng = new Rng(seed);
  }

  /** Сбросить прогресс по пути к точке (после респауна). */
  resetNear(x: number, z: number, yaw: number): void {
    let best = 1, bd = Infinity;
    for (let i = 1; i < this.path.length; i++) {
      const d = Math.hypot(this.path[i][0] - x, this.path[i][2] - z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    // берём ближайшую точку, которая впереди по направлению взгляда
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    while (best < this.path.length - 1 && (this.path[best][0] - x) * fx + (this.path[best][2] - z) * fz < 1) best++;
    this.pathIdx = best;
    this.waitT = 0;
    this.lateT = -1;
  }

  think(body: PlayerBody, plats: Platform[], t: number, dt: number): Controls {
    const path = this.path;
    while (this.pathIdx < path.length - 1 && Math.hypot(path[this.pathIdx][0] - body.x, path[this.pathIdx][2] - body.z) < 3) this.pathIdx++;
    const tgt = path[this.pathIdx], prev = path[this.pathIdx - 1];

    // Своя «полоса» — чтобы соперники не ехали гуськом
    let dx = tgt[0] - prev[0], dz = tgt[2] - prev[2];
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const w = body.ground ? body.ground.def.w : 3;
    const lane = w < 2.6 ? 0 : clamp(this.skill.lane, -(w / 2 - 0.9), w / 2 - 0.9);
    const tx = tgt[0] - dz * lane, tz = tgt[2] + dx * lane;

    const desired = Math.atan2(-(tx - body.x), -(tz - body.z));
    let diff = desired - body.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const steer = clamp(-diff * 3, -1, 1);

    let gas = true, brake = false, jump = false;
    if (this.hesitateT > 0) {
      this.hesitateT -= dt;
      gas = false;
    } else if (this.rng.next() < this.skill.hesitate * dt) this.hesitateT = this.rng.range(0.25, 0.6);

    if (body.grounded) {
      const fx = -Math.sin(body.yaw), fz = -Math.cos(body.yaw);
      const speed = Math.max(0, body.forwardSpeed);
      const look = 0.9 + speed * 0.06;
      const g = groundAt(plats, body.x + fx * look, body.z + fz * look, body.y);
      const g2 = groundAt(plats, body.x + fx * 1.2, body.z + fz * 1.2, body.y);
      const wall = g2 !== null && g2 > body.y + CONFIG.stepUp;
      const edge = g === null || g < body.y - 1.2;
      const barrier = barrierAhead(plats, body.x + fx * 2.2, body.z + fz * 2.2, body.y);

      // Движущиеся платформы впереди: заранее решаем — успеваем или ждём
      if (this.waitT < 2.5 && movingNear(plats, body.x + fx * 8, body.z + fz * 8, 7)) {
        const stop = (speed * speed) / (2 * body.stats.accel * 1.8) + 1.2;
        let e = -1;
        for (let d = look; d <= stop + 0.01; d += 0.5) {
          const gd = groundAt(plats, body.x + fx * d, body.z + fz * d, body.y);
          if (gd === null || gd < body.y - 1.2) {
            e = d;
            break;
          }
        }
        if (e >= 0) {
          const v = Math.max(speed, 6);
          const tEdge = Math.max(0, e - look) / v;
          const tAir = (2 * body.stats.jump * body.jumpMul) / CONFIG.gravity;
          let ok = false;
          for (const k of [0.6, 0.8, 1.0]) {
            const d = e + v * tAir * k - (e - look);
            const h = groundAt(plats, body.x + fx * d, body.z + fz * d, body.y + 1.5, t + tEdge + tAir * k);
            if (h !== null && h > body.y - 4) ok = true;
          }
          if (!ok) {
            gas = false;
            brake = speed > 0.5;
            this.waitT += dt;
            return { gas, brake, steer, jump: false, nitro: false };
          }
        }
      }

      if (wall || barrier || edge) {
        if (this.lateT < 0 && this.rng.next() < this.skill.mistake) this.lateT = this.rng.range(0.1, 0.22);
        if (this.lateT < 0 || this.lateT <= dt) {
          jump = true;
          this.lateT = -1;
          this.waitT = 0;
        } else this.lateT -= dt;
      }
    } else this.lateT = -1;

    return { gas, brake, steer, jump, nitro: false };
  }
}

/** Отслеживание пройденной дистанции вдоль пути (окно поиска вокруг последнего отрезка). */
export class PathTracker {
  private cum: number[] = [0];
  total = 0;
  private idx = 1;

  constructor(private path: [number, number, number][]) {
    for (let i = 1; i < path.length; i++) this.cum.push((this.total += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2])));
  }

  reset(): void {
    this.idx = 1;
  }

  /** Дистанция от старта до проекции точки на путь. */
  measure(x: number, z: number, full = false): number {
    const p = this.path;
    const from = full ? 1 : Math.max(1, this.idx - 4), to = full ? p.length - 1 : Math.min(p.length - 1, this.idx + 8);
    let best = Infinity, bestS = 0, bestI = this.idx;
    for (let i = from; i <= to; i++) {
      const a = p[i - 1], c = p[i];
      const sx = c[0] - a[0], sz = c[2] - a[2];
      const len2 = sx * sx + sz * sz || 1;
      const k = clamp(((x - a[0]) * sx + (z - a[2]) * sz) / len2, 0, 1);
      const d = Math.hypot(x - (a[0] + sx * k), z - (a[2] + sz * k));
      if (d < best) {
        best = d;
        bestS = this.cum[i - 1] + Math.sqrt(len2) * k;
        bestI = i;
      }
    }
    this.idx = bestI;
    return bestS;
  }
}
