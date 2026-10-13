// Игровой контроллер уровня: физика, камера, жизни, чекпоинты, монеты, финиш, эффекты.
import * as THREE from 'three';
import { CONFIG } from '../core/config';
import { bus } from '../core/events';
import { input } from '../core/input';
import { save } from '../core/save';
import { clamp, damp } from '../core/rng';
import { generateLevel, type LevelData, type Spot } from '../world/generator';
import { LevelView } from '../world/levelView';
import { PlayerBody, type Controls } from './body';
import { Rider } from '../entities/rider';
import { characterById, paintById, trailById, vehicleById, type BoosterKind } from '../economy/catalog';
import { sfx, EngineSound } from '../audio/sfx';
import { Shape } from '../render/particles';
import type { Stage } from './stage';
import { t } from '../ui/i18n';

export type GameState = 'ready' | 'play' | 'dead' | 'over' | 'finished';

export interface LevelResult {
  level: number;
  time: number;
  deaths: number;
  coins: number;
  reward: number;
  stars: number;
  newRecord: boolean;
  x2: boolean;
}

export interface HudState {
  time: number;
  coins: number;
  deaths: number;
  lives: number;
  progress: number;
  nitro: number;
  level: number;
  shield: boolean;
}

const tmp = new THREE.Vector3();
const trailPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

export class Game {
  data: LevelData | null = null;
  view: LevelView | null = null;
  rider: Rider | null = null;
  body: PlayerBody;
  state: GameState = 'ready';
  paused = false;
  time = 0;
  simTime = 0;
  deaths = 0;
  lives: number = CONFIG.freeLives;
  runCoins = 0;
  respawn: Spot = { x: 0, y: 0, z: 0, yaw: 0 };
  boosters = new Set<BoosterKind>();
  shield = false;
  private deadT = 0;
  private acc = 0;
  private camYaw = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private shake = 0;
  private engine = new EngineSound();
  private trailT = 0;
  private hudT = 0;
  private lastVanishSound = 0;
  private finishedT = 0;
  private hue = 0;
  restartStreak = 0;

  constructor(private stage: Stage) {
    this.body = new PlayerBody(
      { maxSpeed: 13, accel: 17, jump: 10, turn: 2.6, nitroRegenMul: 1 },
      {
        jump: () => {
          sfx.jump();
          this.burst(Shape.Circle, 0xffffff, 6, 0.3);
        },
        land: (impact) => {
          if (impact > 3) {
            sfx.land(impact);
            this.rider?.landed(impact);
            this.burst(Shape.Circle, this.dustColor(), Math.min(14, Math.floor(impact)), 0.45);
            if (impact > 14) this.shake = Math.max(this.shake, 0.25);
          }
        },
        bounce: () => {
          sfx.bounce();
          this.burst(Shape.Star, 0xff4fa8, 14, 0.4);
          this.rider?.landed(12);
        },
        boost: () => {
          sfx.boost();
          bus.emit('fx:boost');
        },
        barrier: () => {
          sfx.barrier();
          this.shake = 0.45;
          this.vibrate(60);
          this.burst(Shape.Spark, 0xffffff, 10, 0.5);
        },
      },
    );
  }

  private dustColor(): number {
    return this.data ? this.data.theme.tileA : 0xffffff;
  }

  private vibrate(ms: number): void {
    if (save.settings.vibration && navigator.vibrate) navigator.vibrate(ms);
  }

  // ------------------------------------------------------------ жизненный цикл уровня

  start(level: number, boosters: BoosterKind[]): void {
    this.dispose();
    const data = generateLevel(level);
    this.data = data;
    this.view = new LevelView(data, this.stage.shadows);
    this.stage.scene.add(this.view.group);
    this.stage.setTheme(data.theme);
    this.stage.env.populateClouds(data.path, level * 31, data.killY + 4);
    this.stage.particles.clear();

    const vdef = vehicleById(save.vehicle);
    this.rider = new Rider(vdef, characterById(save.character), paintById(save.paint));
    this.stage.scene.add(this.rider.root);
    this.body.stats = { maxSpeed: vdef.maxSpeed, accel: vdef.accel, jump: vdef.jump, turn: vdef.turn, nitroRegenMul: vdef.nitroRegenMul };
    this.engine.start(vdef.motor);

    this.boosters = new Set(boosters);
    this.restartStreak = 0;
    this.resetRun();
  }

  /** Полный перезапуск уровня (те же бустеры). */
  restart(): void {
    if (!this.data) return;
    this.restartStreak++;
    this.view!.resetCoins();
    for (const p of this.view!.platforms) p.reset();
    for (const cp of this.view!.checkpoints) {
      cp.active = false;
      (cp.flag.material as THREE.MeshToonMaterial).color.setHex(0xffffff);
      (cp.ring.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
    }
    this.resetRun();
  }

  private resetRun(): void {
    this.time = 0;
    this.simTime = 0;
    this.deaths = 0;
    this.lives = CONFIG.freeLives;
    this.runCoins = 0;
    this.shield = this.boosters.has('shield');
    this.body.jumpMul = this.boosters.has('superjump') ? 1.35 : 1;
    this.body.nitroRegenBonus = this.boosters.has('nitro') ? 2.5 : 1;
    this.body.nitro = 1;
    this.respawn = { ...this.data!.checkpoints[0] };
    this.state = 'ready';
    this.paused = false;
    this.spawnAt(this.respawn);
    this.emitHud(true);
  }

  private spawnAt(s: Spot): void {
    this.body.reset(s.x, s.y + 0.05, s.z, s.yaw);
    this.body.grounded = true;
    this.camYaw = s.yaw;
    const back = 7;
    this.camPos.set(s.x + Math.sin(s.yaw) * back, s.y + 3.4, s.z + Math.cos(s.yaw) * back);
    this.camLook.set(s.x, s.y + 1, s.z);
    this.rider?.setShield(this.shield);
    for (const p of this.view?.platforms ?? []) if (p.def.role === 'vanish') p.reset();
  }

  /** Продолжить после рекламы (возрождение). */
  revive(): void {
    if (this.state !== 'over') return;
    this.lives = CONFIG.reviveLives;
    this.state = 'play';
    this.spawnAt(this.respawn);
    this.emitHud(true);
  }

  /** Добровольный возврат на чекпоинт (клавиша R) — без потери жизни, но засчитывается падение. */
  toCheckpoint(): void {
    if (this.state !== 'play') return;
    this.die();
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  dispose(): void {
    this.view?.dispose();
    this.view = null;
    this.rider?.dispose();
    this.rider = null;
    this.data = null;
    this.engine.stop();
  }

  get active(): boolean {
    return !!this.data;
  }

  // ------------------------------------------------------------ кадр

  update(dt: number): void {
    if (!this.data || !this.view || !this.rider) return;
    const frozen = this.paused || this.state === 'over';
    if (!frozen) {
      this.simTime += dt;
      this.view.update(this.simTime, dt);
    }

    const ctl = this.readControls();
    if (this.state === 'ready' && (ctl.gas || ctl.jump || ctl.steer !== 0 || ctl.nitro || ctl.brake)) {
      this.state = 'play';
      bus.emit('game:go');
    }

    if (!frozen && (this.state === 'play' || this.state === 'ready' || this.state === 'finished')) {
      if (this.state === 'play') this.time += dt;
      const c = this.state === 'finished' ? { gas: false, brake: true, steer: 0, jump: false, nitro: false } : ctl;
      if (c.nitro && this.body.nitro > 0.05 && !this.body.nitroActive) sfx.nitro();
      this.acc += Math.min(dt, 0.1);
      const step = 1 / 120;
      let first = true;
      while (this.acc >= step) {
        this.body.step(step, first ? c : { ...c, jump: false }, this.view.platforms);
        first = false;
        this.acc -= step;
      }
      if (this.state === 'play') this.checkGameplay();
    }

    if (this.state === 'dead' && !this.paused) {
      this.deadT -= dt;
      // продолжаем падать
      this.body.vy -= CONFIG.gravity * dt;
      this.body.y += this.body.vy * dt;
      this.body.x += this.body.vx * dt * 0.5;
      this.body.z += this.body.vz * dt * 0.5;
      if (this.deadT <= 0) this.afterDeath();
    }

    if (this.state === 'finished' && !this.paused) {
      this.finishedT += dt;
      if (Math.random() < dt * 20) this.confetti(1);
    }

    this.updateVisuals(dt, ctl);
    this.updateCamera(dt);
    this.stage.env.update(this.body.grounded ? tmp.set(this.body.x, this.body.y, this.body.z) : tmp.set(this.body.x, this.body.y, this.body.z), this.simTime, frozen ? 0 : dt);
    this.stage.particles.update(frozen ? 0 : dt);

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.emitHud(false);
    }
  }

  private readControls(): Controls {
    const left = input.held('left'), right = input.held('right');
    return {
      gas: input.held('gas'),
      brake: input.held('brake'),
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      jump: input.pressed('jump'),
      nitro: input.held('nitro'),
    };
  }

  private checkGameplay(): void {
    const b = this.body, v = this.view!, d = this.data!;
    // Падение
    if (b.y < d.killY) {
      this.die();
      return;
    }
    // Монеты
    const magnet = this.boosters.has('magnet');
    const cy = b.y + 0.8;
    for (let i = 0; i < v.coinPos.length; i++) {
      if (v.coinTaken[i]) continue;
      const c = v.coinPos[i];
      const dx = c.x - b.x, dy = c.y - cy, dz = c.z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (magnet && d2 < 36) {
        const k = Math.min(1, 12 / Math.sqrt(d2) * (1 / 60));
        c.x -= dx * k * 2;
        c.y -= dy * k * 2;
        c.z -= dz * k * 2;
      }
      if (d2 < 1.3) {
        v.coinTaken[i] = true;
        this.runCoins += CONFIG.economy.coinValue;
        sfx.coin();
        this.stage.particles.emit({ x: c.x, y: c.y, z: c.z, color: 0xffe14d, shape: Shape.Star, count: 5, spread: 4, size: 0.35, life: 0.5, vy: 1.5 });
      }
    }
    // Чекпоинты
    for (const cp of v.checkpoints) {
      if (cp.active) continue;
      const s = cp.spot;
      if (Math.hypot(b.x - s.x, b.z - s.z) < 3.2 && Math.abs(b.y - s.y) < 2) {
        v.activateCheckpoint(cp);
        this.respawn = { ...s };
        sfx.checkpoint();
        bus.emit('toast', t('checkpoint'), 'good');
        this.confetti(30, s.x, s.y + 1.5, s.z);
      }
    }
    // Финиш
    const f = d.finish;
    const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw);
    const wx = b.x - f.x, wz = b.z - f.z;
    const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
    if (lz < 0 && lz > -6 && Math.abs(lx) < f.w / 2 + 0.5 && b.y > f.y - 1.5) this.finish();
    // исчезающие плитки — звук
    const g = b.ground;
    if (g && g.def.role === 'vanish' && g.vanishT >= 0 && g.vanishT < 0.05 && this.simTime - this.lastVanishSound > 0.3) {
      this.lastVanishSound = this.simTime;
      sfx.vanish();
    }
  }

  private die(): void {
    this.state = 'dead';
    this.deaths++;
    save.totalDeaths++;
    this.deadT = CONFIG.respawnDelay;
    sfx.fall();
    this.vibrate(120);
  }

  private afterDeath(): void {
    if (this.shield) {
      this.shield = false;
      this.state = 'play';
      this.spawnAt(this.respawn);
      bus.emit('toast', t('shieldSaved'), 'good');
      this.emitHud(true);
      return;
    }
    this.lives--;
    if (this.lives > 0) {
      this.state = 'play';
      this.spawnAt(this.respawn);
      this.emitHud(true);
    } else {
      this.lives = 0;
      this.state = 'over';
      sfx.gameOver();
      this.emitHud(true);
      bus.emit('game:over');
    }
  }

  private finish(): void {
    this.state = 'finished';
    this.finishedT = 0;
    const d = this.data!;
    const time = this.time;
    const stars = 1 + (time <= d.parTime ? 1 : 0) + (this.deaths === 0 ? 1 : 0);
    const x2 = this.boosters.has('x2');
    const e = CONFIG.economy;
    const base = Math.min(e.levelRewardMax, e.levelBaseReward + d.number * e.levelRewardPerLevel);
    const reward = (base + this.runCoins) * (x2 ? 2 : 1);
    const prevBest = save.bestTime[d.number];
    const newRecord = prevBest === undefined || time < prevBest;
    this.confetti(80, d.finish.x, d.finish.y + 3, d.finish.z);
    sfx.win();
    this.vibrate(80);
    const res: LevelResult = { level: d.number, time, deaths: this.deaths, coins: this.runCoins, reward, stars, newRecord, x2 };
    window.setTimeout(() => bus.emit('game:finished', res), 1300);
  }

  // ------------------------------------------------------------ визуал

  private burst(shape: Shape, color: number, n: number, size: number): void {
    const b = this.body;
    this.stage.particles.emit({ x: b.x, y: b.y + 0.15, z: b.z, color, shape, count: n, spread: 5, size, life: 0.6, vy: 1.5, gravity: 4 });
  }

  confetti(n: number, x?: number, y?: number, z?: number): void {
    const b = this.body;
    const cols = [0xff4f9a, 0xffd54f, 0x4fc3f7, 0x66ff8a, 0xb388ff, 0xff7043];
    for (let i = 0; i < n; i++) {
      this.stage.particles.emit({
        x: x ?? b.x + (Math.random() - 0.5) * 6,
        y: y ?? b.y + 5,
        z: z ?? b.z + (Math.random() - 0.5) * 6,
        vy: 4 + Math.random() * 4,
        spread: 9,
        color: cols[i % cols.length],
        shape: i % 3 === 0 ? Shape.Star : Shape.Spark,
        size: 0.35,
        life: 1.8,
        gravity: 7,
        drag: 1.2,
      });
    }
  }

  private updateVisuals(dt: number, ctl: Controls): void {
    const b = this.body, r = this.rider!;
    r.root.position.set(b.x, b.y, b.z);
    r.root.rotation.y = b.yaw;
    const fs = b.forwardSpeed;
    r.update(this.paused ? 0 : dt, fs, ctl.steer, b.grounded, b.vy, ctl.gas && this.state === 'play');
    r.setShield(this.shield);
    this.engine.update(b.speed, ctl.gas, !this.paused && this.state !== 'over');

    if (this.paused || this.state === 'over') return;
    // След
    this.trailT -= dt;
    const n = r.trailPoints(trailPts);
    const kind = trailById(save.trail).id;
    const speed = b.speed;
    const vid = r.vdef.id;
    if (this.trailT <= 0) {
      this.trailT = 0.03;
      for (let i = 0; i < n; i++) {
        const p = trailPts[i];
        if (vid === 'fire' && speed > 1) {
          this.stage.particles.emit({ x: p.x, y: p.y + 0.3, z: p.z, vy: 1.5, spread: 1, color: Math.random() < 0.5 ? 0xffb300 : 0xff5722, shape: Shape.Spark, size: 0.35, life: 0.35, gravity: -2 });
        }
        if ((vid === 'rocket' || vid === 'hover') && speed > 0.5) {
          const col = vid === 'hover' ? 0x00e5ff : b.nitroActive ? 0x40c4ff : 0xff9100;
          this.stage.particles.emit({ x: p.x, y: p.y, z: p.z, vx: -b.vx * 0.2, vz: -b.vz * 0.2, vy: vid === 'hover' ? -1 : 0, spread: 0.8, color: col, shape: Shape.Circle, size: 0.35, life: 0.3, grow: -0.6 });
          continue;
        }
        if (!b.grounded || speed < 2.5) continue;
        if (i % 2 === 1 && kind !== 'rainbow') continue;
        switch (kind) {
          case 'dust':
            this.stage.particles.emit({ x: p.x, y: p.y + 0.1, z: p.z, vy: 0.6, spread: 1, color: 0xffffff, size: 0.18, life: 0.4, grow: 1 });
            break;
          case 'stars':
            this.stage.particles.emit({ x: p.x, y: p.y + 0.2, z: p.z, vy: 1.2, spread: 1.5, color: 0xffe14d, shape: Shape.Star, size: 0.3, life: 0.6 });
            break;
          case 'hearts':
            this.stage.particles.emit({ x: p.x, y: p.y + 0.2, z: p.z, vy: 1.4, spread: 1, color: 0xff4f9a, shape: Shape.Heart, size: 0.32, life: 0.7, gravity: -0.5 });
            break;
          case 'bubbles':
            this.stage.particles.emit({ x: p.x, y: p.y + 0.2, z: p.z, vy: 1, spread: 1, color: 0x9be7ff, size: 0.28, life: 0.9, gravity: -1.5, grow: 0.6 });
            break;
          case 'fire':
            this.stage.particles.emit({ x: p.x, y: p.y + 0.15, z: p.z, vy: 1.8, spread: 0.8, color: Math.random() < 0.5 ? 0xffc400 : 0xff3d00, shape: Shape.Spark, size: 0.3, life: 0.35, gravity: -2 });
            break;
          case 'rainbow': {
            this.hue = (this.hue + 0.02) % 1;
            const col = new THREE.Color().setHSL(this.hue, 0.9, 0.6);
            this.stage.particles.emit({ x: p.x, y: p.y + 0.15, z: p.z, spread: 0.2, color: col, size: 0.45, life: 0.8, drag: 3 });
            break;
          }
        }
      }
      if (b.nitroActive) {
        this.stage.particles.emit({ x: b.x + Math.sin(b.yaw) * 0.9, y: b.y + 0.5, z: b.z + Math.cos(b.yaw) * 0.9, vx: Math.sin(b.yaw) * 4, vz: Math.cos(b.yaw) * 4, spread: 1, color: 0x40c4ff, size: 0.45, life: 0.3, grow: -0.5 });
      }
    }
  }

  private updateCamera(dt: number): void {
    const b = this.body, cam = this.stage.camera;
    const dead = this.state === 'dead' || this.state === 'over';
    const portrait = cam.aspect < 1;
    // плавно догоняем курс
    let dy = b.yaw - this.camYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (!dead) this.camYaw += dy * (1 - Math.exp(-4 * dt));
    const dist = portrait ? 8.4 : 7;
    const height = portrait ? 4.4 : 3.8;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const ty = dead ? Math.max(b.y, this.respawn.y - 6) : b.y;
    const want = tmp.set(b.x - fx * dist, ty + height, b.z - fz * dist);
    if (!dead) {
      this.camPos.x = damp(this.camPos.x, want.x, 10, dt);
      this.camPos.z = damp(this.camPos.z, want.z, 10, dt);
      this.camPos.y = damp(this.camPos.y, want.y, 6, dt);
    }
    this.camLook.x = damp(this.camLook.x, b.x + fx * 5, 12, dt);
    this.camLook.z = damp(this.camLook.z, b.z + fz * 5, 12, dt);
    this.camLook.y = damp(this.camLook.y, (dead ? b.y : ty) + 1.1, 8, dt);
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    cam.lookAt(this.camLook);
    const fast = b.boostT > 0 || b.nitroActive;
    const baseFov = portrait ? 74 : 62;
    const fov = baseFov + clamp(b.speed / 20, 0, 1) * 8 + (fast ? 6 : 0);
    cam.fov = damp(cam.fov, fov, 4, dt);
    cam.updateProjectionMatrix();
    bus.emit('fx:speed', fast ? 1 : clamp((b.speed - 14) / 8, 0, 0.5));
  }

  private emitHud(force: boolean): void {
    if (!this.data) return;
    const hud: HudState = {
      time: this.time,
      coins: this.runCoins,
      deaths: this.deaths,
      lives: this.lives,
      progress: this.progress(),
      nitro: this.body.nitro,
      level: this.data.number,
      shield: this.shield,
    };
    bus.emit('hud', hud, force);
  }

  private progress(): number {
    const path = this.data!.path;
    const b = this.body;
    let best = Infinity, bestS = 0, acc = 0, total = 0;
    for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], c = path[i];
      const sx = c[0] - a[0], sz = c[2] - a[2];
      const len = Math.hypot(sx, sz) || 1;
      let k = ((b.x - a[0]) * sx + (b.z - a[2]) * sz) / (len * len);
      k = clamp(k, 0, 1);
      const px = a[0] + sx * k, pz = a[2] + sz * k;
      const d = Math.hypot(b.x - px, b.z - pz);
      if (d < best) {
        best = d;
        bestS = acc + len * k;
      }
      acc += len;
    }
    return total > 0 ? clamp(bestS / total, 0, 1) : 0;
  }
}
