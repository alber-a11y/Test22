// Headless-проверка проходимости уровней автопилотом соперников.
// Запуск: npm run bot -- [from] [to]   (FAST=1 — быстрый транспорт, SKILL=rival — навыки соперника с ошибками)
import { generateLevel } from '../src/world/generator';
import { Platform } from '../src/world/platform';
import { PlayerBody } from '../src/game/body';
import { Autopilot } from '../src/game/autopilot';

const noop = () => {};
const DT = 1 / 120;

function run(n: number, maxDeaths = 40) {
  const data = generateLevel(n);
  const plats = data.platforms.map((d, i) => new Platform(d, i));
  const body = new PlayerBody(process.env.FAST ? { maxSpeed: 16.5, accel: 32, jump: 11, turn: 3, nitroRegenMul: 2 } : { maxSpeed: 13, accel: 17, jump: 10, turn: 2.6, nitroRegenMul: 1 }, { jump: noop, land: noop, bounce: noop, boost: noop, barrier: noop });
  const rival = process.env.SKILL === 'rival';
  const pilot = new Autopilot(data.path, { lane: rival ? 0.8 : 0, mistake: rival ? 0.08 : 0, hesitate: rival ? 0.1 : 0 }, n);
  let spawn = data.checkpoints[0];
  body.reset(spawn.x, spawn.y + 0.05, spawn.z, spawn.yaw);
  body.grounded = true;
  let t = 0, deaths = 0;
  const deathSpots: string[] = [];
  const cps = data.checkpoints.slice(1).map((c) => ({ ...c, on: false }));
  while (t < 400) {
    t += DT;
    for (const p of plats) p.update(t, DT);
    const c = pilot.think(body, plats, t, DT);
    body.step(DT, c, plats);
    for (const cp of cps) if (!cp.on && Math.hypot(body.x - cp.x, body.z - cp.z) < 3.2 && Math.abs(body.y - cp.y) < 2) { cp.on = true; spawn = cp; }
    const f = data.finish;
    const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw);
    const lz = (body.x - f.x) * sn + (body.z - f.z) * cs;
    const lx = (body.x - f.x) * cs - (body.z - f.z) * sn;
    if (lz < 0 && lz > -6 && Math.abs(lx) < f.w / 2 + 0.5 && body.y > f.y - 1.5) return { ok: true, t, par: data.parTime, deaths, deathSpots };
    if (body.y < data.killY) {
      deaths++;
      deathSpots.push(data.pathSeg[pilot.pathIdx]);
      if (deaths > maxDeaths) break;
      body.reset(spawn.x, spawn.y + 0.05, spawn.z, spawn.yaw);
      body.grounded = true;
      pilot.resetNear(spawn.x, spawn.z, spawn.yaw);
      for (const p of plats) p.reset();
    }
  }
  return { ok: false, t, par: data.parTime, deaths, deathSpots: deathSpots.slice(0, 6) };
}

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 40);
let fails = 0, totalDeaths = 0;
for (let n = from; n <= to; n++) {
  const r = run(n);
  if (!r.ok) fails++;
  totalDeaths += r.deaths;
  console.log(`L${String(n).padStart(3)} ${r.ok ? 'OK  ' : 'FAIL'} time=${r.t.toFixed(1)}s par=${r.par}s deaths=${r.deaths} ${r.deathSpots.join(',')}`);
}
console.log(`fails: ${fails}, deaths: ${totalDeaths}`);
