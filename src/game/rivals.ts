// Соперники-боты: ездят по трассе на автопилоте, падают и возрождаются на чекпоинтах.
import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { Rng, clamp } from '../core/rng';
import { save } from '../core/save';
import { CHARACTERS, PAINTS, VEHICLES } from '../economy/catalog';
import { Rider } from '../entities/rider';
import type { LevelData, Spot } from '../world/generator';
import type { Platform } from '../world/platform';
import { Autopilot, PathTracker, groundAt } from './autopilot';
import { PlayerBody, type Controls } from './body';

export const RIVAL_COLORS = ['#ff5c5c', '#ffb02e', '#2ee86b', '#b56bff', '#29c5ff'];

const NAMES = {
  boy: { ru: ['Тимка', 'Гоша', 'Артём', 'Кирюха', 'Дэн', 'Вовчик', 'Егор'], en: ['Tim', 'Leo', 'Rex', 'Sam', 'Ben', 'Jake', 'Finn'] },
  girl: { ru: ['Соня', 'Лиза', 'Ника', 'Алиса', 'Мила', 'Катя', 'Ева'], en: ['Zoe', 'Lily', 'Ava', 'Ruby', 'Emma', 'Nora', 'Ivy'] },
};

/** Сколько соперников на уровне: с 3-го уровня 1–2, потом 2–3 … максимум 5. */
export function rivalCount(level: number, rng: Rng): number {
  if (level < 3) return 0;
  if (level <= 6) return rng.int(1, 2);
  if (level <= 12) return rng.int(2, 3);
  if (level <= 20) return rng.int(3, 4);
  return rng.int(4, 5);
}

const noop = () => {};

function nameTag(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 34px "Trebuchet MS", Arial, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 34);
  g.fillStyle = color;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  const x = (256 - w) / 2;
  g.beginPath();
  if (g.roundRect) g.roundRect(x, 6, w, 52, 24);
  else g.rect(x, 6, w, 52);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowOffsetY = 2;
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(1.9, 0.475, 1);
  s.position.y = 2.7;
  s.renderOrder = 10;
  return s;
}

export class Rival {
  body: PlayerBody;
  pilot: Autopilot;
  rider: Rider;
  tracker: PathTracker;
  tag: THREE.Sprite;
  spawn: Spot;
  start: Spot;
  cpIndex = 0;
  deadT = 0;
  deathsHere = 0;
  finished = false;
  finishTime = 0;
  dist = 0;
  private bestDist = 0;
  private stuckT = 0;
  private ctl: Controls = { gas: false, brake: false, steer: 0, jump: false, nitro: false };

  name = '';

  constructor(public color: string, data: LevelData, start: Spot, rng: Rng, level: number, public index: number) {
    const maxV = clamp(Math.floor(level / 5), 1, VEHICLES.length - 1);
    const vdef = VEHICLES[rng.int(0, maxV)];
    const cdef = CHARACTERS[rng.int(0, CHARACTERS.length - 1)];
    const paint = PAINTS[rng.int(0, PAINTS.length - 2)];
    // Сила соперников растёт с уровнем, но они чуть медленнее идеального игрока
    const speedMul = clamp(0.76 + Math.min(level, 50) * 0.0045 + rng.range(0, 0.06), 0.76, 0.98);
    this.body = new PlayerBody(
      { maxSpeed: vdef.maxSpeed * speedMul, accel: vdef.accel * speedMul, jump: vdef.jump, turn: vdef.turn, nitroRegenMul: 1 },
      { jump: noop, land: noop, bounce: noop, boost: noop, barrier: noop },
    );
    this.pilot = new Autopilot(
      data.path,
      {
        lane: (index % 2 ? 1 : -1) * (0.6 + rng.range(0, 0.8)),
        mistake: clamp(0.12 - level * 0.0012, 0.04, 0.12) + rng.range(0, 0.04),
        hesitate: rng.range(0.04, 0.14),
      },
      level * 101 + index,
    );
    this.rider = new Rider(vdef, cdef, paint);
    this.rider.root.traverse((o) => (o.castShadow = false));
    this.rider.shield.visible = false;
    this.tag = new THREE.Sprite();
    this.tracker = new PathTracker(data.path);
    this.start = start;
    this.spawn = start;
  }

  setName(name: string): void {
    this.name = name;
    this.rider.root.remove(this.tag);
    this.tag = nameTag(name, this.color);
    this.rider.root.add(this.tag);
  }

  reset(): void {
    this.spawn = this.start;
    this.cpIndex = 0;
    this.deadT = 0;
    this.deathsHere = 0;
    this.finished = false;
    this.finishTime = 0;
    this.respawn();
    this.tracker.reset();
    this.dist = 0;
    this.bestDist = 0;
    this.stuckT = 0;
  }

  /** Перенос на следующий чекпоинт (застрял или дважды упал на одном месте). */
  private skipAhead(data: LevelData, plats: Platform[]): void {
    this.deathsHere = 0;
    this.stuckT = 0;
    if (this.cpIndex + 1 < data.checkpoints.length) {
      this.cpIndex++;
      this.spawn = data.checkpoints[this.cpIndex];
      return;
    }
    // после последнего чекпоинта — на следующую плитку по пути
    const path = data.path;
    for (let k = Math.max(1, this.pilot.pathIdx + 1); k < path.length; k++) {
      const a = path[k - 1], c = path[k];
      const x = (a[0] + c[0]) / 2, z = (a[2] + c[2]) / 2;
      const y = groundAt(plats, x, z, Math.max(a[1], c[1]) + 1);
      if (y === null) continue;
      this.spawn = { x, y, z, yaw: Math.atan2(-(c[0] - a[0]), -(c[2] - a[2])) };
      return;
    }
  }

  respawn(): void {
    const s = this.spawn;
    this.body.reset(s.x, s.y + 0.05, s.z, s.yaw);
    this.body.grounded = true;
    this.pilot.resetNear(s.x, s.z, s.yaw);
    this.tracker.measure(s.x, s.z, true);
  }

  think(plats: Platform[], t: number, dt: number, racing: boolean): void {
    if (this.deadT > 0 || !racing || this.finished) {
      // Стоим/тормозим до полной остановки. Тормоз на месте = задний ход, поэтому только пока едем вперёд.
      this.ctl = { gas: false, brake: this.body.forwardSpeed > 0.3, steer: 0, jump: false, nitro: false };
      return;
    }
    this.ctl = this.pilot.think(this.body, plats, t, dt);
  }

  step(dt: number, first: boolean, plats: Platform[]): void {
    if (this.deadT > 0) return;
    this.body.step(dt, first ? this.ctl : { ...this.ctl, jump: false }, plats);
  }

  post(dt: number, data: LevelData, raceTime: number, racingNow: boolean, plats: Platform[]): void {
    const b = this.body;
    if (this.deadT > 0) {
      this.deadT -= dt;
      b.vy -= CONFIG.gravity * dt;
      b.y += b.vy * dt;
      if (this.deadT <= 0) {
        // Два падения подряд на одном месте — «срезаем» до следующего чекпоинта, чтобы гонка не вставала
        if (this.deathsHere >= 2) this.skipAhead(data, plats);
        this.respawn();
      }
    } else if (b.y < data.killY) {
      this.deadT = CONFIG.respawnDelay + 0.3;
      this.deathsHere++;
    } else if (!this.finished) {
      // чекпоинты
      for (let i = this.cpIndex + 1; i < data.checkpoints.length; i++) {
        const c = data.checkpoints[i];
        if (Math.hypot(b.x - c.x, b.z - c.z) < 3.2 && Math.abs(b.y - c.y) < 2) {
          this.cpIndex = i;
          this.spawn = c;
          this.deathsHere = 0;
        }
      }
      // финиш
      const f = data.finish;
      const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw);
      const wx = b.x - f.x, wz = b.z - f.z;
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
      if (lz < 0 && lz > -6 && Math.abs(lx) < f.w / 2 + 0.5 && b.y > f.y - 1.5) {
        this.finished = true;
        this.finishTime = raceTime;
      }
      this.dist = this.tracker.measure(b.x, b.z);
      // сторож: нет прогресса 6 секунд — переносим вперёд
      if (this.dist > this.bestDist + 1) {
        this.bestDist = this.dist;
        this.stuckT = 0;
      } else if (racingNow && (this.stuckT += dt) > 6) {
        this.skipAhead(data, plats);
        this.respawn();
      }
    }
    if (this.finished) this.dist = this.tracker.total;

    // визуал
    const r = this.rider;
    r.root.position.set(b.x, b.y, b.z);
    r.root.rotation.y = b.yaw;
    r.update(dt, b.forwardSpeed, this.ctl.steer, b.grounded, b.vy, this.ctl.gas);
  }

  dispose(): void {
    (this.tag.material as THREE.SpriteMaterial).map?.dispose();
    this.tag.material.dispose();
    this.rider.dispose();
  }
}

export class Rivals {
  list: Rival[] = [];

  setup(level: number, data: LevelData, scene: THREE.Scene): void {
    this.dispose();
    const rng = new Rng(level * 7349 + 3);
    const n = rivalCount(level, rng);
    const s = data.checkpoints[0];
    const lang = save.settings.lang;
    const used = new Set<string>();
    // стартовая решётка: рядом и чуть позади игрока
    const grid: [number, number][] = [[-2.3, 0], [2.3, 0], [-1.2, 2.2], [1.2, 2.2], [0, 2.2]];
    for (let i = 0; i < n; i++) {
      const [a, back] = grid[i];
      const cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const start: Spot = { x: s.x + a * cs + back * sn, y: s.y, z: s.z - a * sn + back * cs, yaw: s.yaw };
      const r = new Rival(RIVAL_COLORS[i], data, start, rng, level, i);
      const pool = NAMES[r.rider.cdef.gender][lang].filter((x) => !used.has(x));
      r.setName(pool[rng.int(0, pool.length - 1)]);
      used.add(r.name);
      r.reset();
      scene.add(r.rider.root);
      this.list.push(r);
    }
  }

  reset(): void {
    for (const r of this.list) r.reset();
  }

  setVisible(v: boolean): void {
    for (const r of this.list) r.rider.root.visible = v;
  }

  think(plats: Platform[], t: number, dt: number, racing: boolean): void {
    for (const r of this.list) r.think(plats, t, dt, racing);
  }

  step(dt: number, first: boolean, plats: Platform[]): void {
    for (const r of this.list) r.step(dt, first, plats);
  }

  post(dt: number, data: LevelData, raceTime: number, racing: boolean, plats: Platform[]): void {
    for (const r of this.list) r.post(dt, data, raceTime, racing, plats);
  }

  finishedCount(): number {
    return this.list.filter((r) => r.finished).length;
  }

  dispose(): void {
    for (const r of this.list) r.dispose();
    this.list = [];
  }
}

// ---------------------------------------------------------------- столкновения гонщиков

export interface Racer {
  body: PlayerBody;
  alive: boolean;
  id: number; // -1 — игрок
}

const RACER_R = 0.6;
const RESTITUTION = 0.7;

/** Расталкивает гонщиков (игрок и боты): круги в плоскости XZ + перекрытие по высоте. */
export function collideRacers(racers: Racer[], onHit: (a: Racer, b: Racer, power: number, x: number, y: number, z: number) => void): void {
  for (let i = 0; i < racers.length; i++) {
    const A = racers[i];
    if (!A.alive) continue;
    for (let j = i + 1; j < racers.length; j++) {
      const B = racers[j];
      if (!B.alive) continue;
      const a = A.body, b = B.body;
      if (Math.abs(a.y - b.y) > 1.2) continue;
      let nx = a.x - b.x, nz = a.z - b.z;
      const d2 = nx * nx + nz * nz;
      const min = RACER_R * 2;
      if (d2 >= min * min) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        nx = Math.cos(a.yaw);
        nz = -Math.sin(a.yaw);
        d = 1e-4;
      } else {
        nx /= d;
        nz /= d;
      }
      // раздвигаем поровну
      const push = (min - d) / 2;
      a.x += nx * push;
      a.z += nz * push;
      b.x -= nx * push;
      b.z -= nz * push;
      // упругий обмен импульсом вдоль нормали (массы равны)
      const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (vn < 0) {
        const jImp = (-(1 + RESTITUTION) * vn) / 2 + 1.2; // +1.2 — минимальный «пинок»
        a.vx += nx * jImp;
        a.vz += nz * jImp;
        b.vx -= nx * jImp;
        b.vz -= nz * jImp;
        a.bumpT = b.bumpT = 0.45;
        onHit(A, B, -vn, (a.x + b.x) / 2, (a.y + b.y) / 2 + 0.7, (a.z + b.z) / 2);
      }
    }
  }
}
