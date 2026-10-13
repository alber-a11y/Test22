// Headless-проверка проходимости уровней: бот-автопилот едет по пути и прыгает перед пропастями.
// Запуск: npm run bot -- [from] [to]
import { generateLevel } from '../src/world/generator';
import { Platform } from '../src/world/platform';
import { PlayerBody } from '../src/game/body';

const noop = () => {};
const DT = 1 / 120;

function groundAt(plats: Platform[], x: number, z: number, y: number): number | null {
  let best: number | null = null;
  for (const p of plats) {
    if (!p.active || p.def.role === 'barrier') continue;
    const lx = p.toLocalX(x, z), lz = p.toLocalZ(x, z);
    if (Math.abs(lx) > p.def.w / 2 || Math.abs(lz) > p.def.l / 2) continue;
    const h = p.topAt(lx, lz);
    if (h < y + 2.5 && (best === null || h > best)) best = h;
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

function run(n: number, maxDeaths = 40, trace = false) {
  const log: string[] = [];
  const data = generateLevel(n);
  const plats = data.platforms.map((d, i) => new Platform(d, i));
  const body = new PlayerBody(process.env.FAST ? { maxSpeed: 16.5, accel: 32, jump: 11, turn: 3, nitroRegenMul: 2 } : { maxSpeed: 13, accel: 17, jump: 10, turn: 2.6, nitroRegenMul: 1 }, { jump: noop, land: noop, bounce: noop, boost: noop, barrier: noop });
  let spawn = data.checkpoints[0];
  body.reset(spawn.x, spawn.y + 0.05, spawn.z, spawn.yaw);
  body.grounded = true;
  const path = data.path;
  let t = 0, time = 0, deaths = 0, pathIdx = 1;
  const deathSpots: string[] = [];
  const cps = data.checkpoints.slice(1).map((c) => ({ ...c, on: false }));
  while (time < 400) {
    t += DT; time += DT;
    for (const p of plats) p.update(t, DT);
    // ближайшая точка пути впереди
    while (pathIdx < path.length - 1 && Math.hypot(path[pathIdx][0] - body.x, path[pathIdx][2] - body.z) < 2.5) pathIdx++;
    const tgt = path[pathIdx];
    const desired = Math.atan2(-(tgt[0] - body.x), -(tgt[2] - body.z));
    let diff = desired - body.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const steer = Math.max(-1, Math.min(1, -diff * 3));
    // проба земли впереди
    const fx = -Math.sin(body.yaw), fz = -Math.cos(body.yaw);
    const look = 0.9 + body.speed * 0.06;
    const g = groundAt(plats, body.x + fx * look, body.z + fz * look, body.y);
    const wallAhead = (() => { const g2 = groundAt(plats, body.x + fx * 1.2, body.z + fz * 1.2, body.y); return g2 !== null && g2 > body.y + 0.45; })();
    const jump = body.grounded && (g === null || g < body.y - 1.2 || wallAhead || barrierAhead(plats, body.x + fx * 2.2, body.z + fz * 2.2, body.y));
    body.step(DT, { gas: true, brake: false, steer, jump, nitro: false }, plats);
    if (trace && Math.round(time * 120) % 6 === 0) log.push(`${time.toFixed(2)} ${data.pathSeg[pathIdx]} x=${body.x.toFixed(1)} y=${body.y.toFixed(2)} z=${body.z.toFixed(1)} v=${body.speed.toFixed(1)} vy=${body.vy.toFixed(1)} g=${body.grounded ? (body.ground?.index) : '-'}${jump ? ' JUMP' : ''}`);
    for (const c of cps) if (!c.on && Math.hypot(body.x - c.x, body.z - c.z) < 3.2 && Math.abs(body.y - c.y) < 2) { c.on = true; spawn = c; }
    const f = data.finish;
    const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw);
    const lz = (body.x - f.x) * sn + (body.z - f.z) * cs;
    const lx = (body.x - f.x) * cs - (body.z - f.z) * sn;
    if (lz < 0 && lz > -6 && Math.abs(lx) < f.w / 2 + 0.5 && body.y > f.y - 1.5) return { n, ok: true, time: +time.toFixed(1), par: data.parTime, deaths, deathSpots };
    if (body.y < data.killY) {
      deaths++;
      // какой сегмент: ближайшая платформа
      deathSpots.push(`${data.pathSeg[pathIdx]}`);
      if (trace && deaths === 1) { console.log(log.slice(-50).join('\n')); const near = plats.filter(p => Math.hypot(p.x-body.x,p.z-body.z)<14); near.forEach(p=>console.log('plat', p.index, p.def.role, 'x', p.x.toFixed(1),'y', p.y.toFixed(2),'z', p.z.toFixed(1),'w',p.def.w.toFixed(1),'l',p.def.l.toFixed(1),'yaw',p.yaw.toFixed(2), p.def.motion?'M':'')); }
      if (deaths > maxDeaths) break;
      body.reset(spawn.x, spawn.y + 0.05, spawn.z, spawn.yaw);
      body.grounded = true;
      pathIdx = Math.max(1, path.findIndex((p) => Math.hypot(p[0] - spawn.x, p[2] - spawn.z) < 4) + 1);
      for (const p of plats) p.reset();
    }
  }
  return { n, ok: false, time: +time.toFixed(1), par: data.parTime, deaths, deathSpots: deathSpots.slice(0, 6) };
}

const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 40);
if (process.argv[4] === 'trace') { run(from, 1, true); process.exit(0); }
let fails = 0;
for (let n = from; n <= to; n++) {
  const r = run(n);
  if (!r.ok) fails++;
  console.log(`L${String(n).padStart(3)} ${r.ok ? 'OK  ' : 'FAIL'} time=${r.time}s par=${r.par}s deaths=${r.deaths} ${r.deathSpots.join(',')}`);
}
console.log(`fails: ${fails}`);
