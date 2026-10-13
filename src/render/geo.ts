// Сборщик геометрии: позволяет склеивать много плиток в один меш (меньше draw calls).
import * as THREE from 'three';
import { profileGrad, profileHeight, type PlatformDef } from '../world/platform';

export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  get count(): number {
    return this.pos.length / 3;
  }

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, c: THREE.Color): number {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(c.r, c.g, c.b);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }

  /** Коробка с цветами граней (верх светлее). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, yaw: number, color: THREE.Color, topColor?: THREE.Color): void {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const tr = (lx: number, ly: number, lz: number): [number, number, number] => [cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs];
    const rn = (nx: number, nz: number): [number, number] => [nx * cs + nz * sn, -nx * sn + nz * cs];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces: [number, number, number, number[][]][] = [
      [0, 1, 0, [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
      [0, -1, 0, [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
      [0, 0, 1, [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
      [0, 0, -1, [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
      [1, 0, 0, [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
      [-1, 0, 0, [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    ];
    for (const [nx, ny, nz, vs] of faces) {
      const [wx, wz] = rn(nx, nz);
      const c = ny > 0 && topColor ? topColor : color;
      const base = this.count;
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      vs.forEach((v, i) => {
        const [x, y, z] = tr(v[0], v[1], v[2]);
        this.vert(x, y, z, wx, ny, wz, uvs[i][0], uvs[i][1], c);
      });
      this.tri(base, base + 1, base + 2);
      this.tri(base, base + 2, base + 3);
    }
  }
}

export interface PlatformGeoOpts {
  world: boolean; // true — вершины в мировых координатах (статичный меш), false — локальные
  sideTop: THREE.Color;
  sideBottom: THREE.Color;
}

const WHITE = new THREE.Color(1, 1, 1);

/** Верх платформы (с профилем) в builder `top`, бока и низ — в builder `side`. */
export function buildPlatformGeo(def: PlatformDef, top: GeoBuilder, side: GeoBuilder, o: PlatformGeoOpts, inset = 0, lift = 0): void {
  const cs = Math.cos(def.yaw), sn = Math.sin(def.yaw);
  const ox = o.world ? def.x : 0, oy = o.world ? def.y : 0, oz = o.world ? def.z : 0;
  const tx = (lx: number, lz: number) => (o.world ? ox + lx * cs + lz * sn : lx);
  const tz = (lx: number, lz: number) => (o.world ? oz - lx * sn + lz * cs : lz);
  const rn = (nx: number, nz: number): [number, number] => (o.world ? [nx * cs + nz * sn, -nx * sn + nz * cs] : [nx, nz]);

  const hw = def.w / 2 - inset, hl = def.l / 2;
  const curved = def.profile && def.profile.type !== 'flat';
  const nx = curved && def.profile!.type === 'descent' ? 12 : 1;
  const nz = curved ? Math.max(4, Math.ceil(def.l / 1.5)) : 1;

  // Верх
  const base = top.count;
  for (let j = 0; j <= nz; j++) {
    const lz = hl - (2 * hl * j) / nz;
    for (let i = 0; i <= nx; i++) {
      const lx = -hw + (2 * hw * i) / nx;
      const h = profileHeight(def, lx, lz) + lift;
      const [gx, gz] = profileGrad(def, lx, lz);
      const nl = 1 / Math.hypot(gx, 1, gz);
      const [wnx, wnz] = rn(-gx * nl, -gz * nl);
      top.vert(tx(lx, lz), oy + h, tz(lx, lz), wnx, nl, wnz, (lx + def.w / 2) / 2, (hl - lz) / 2, WHITE);
    }
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = base + j * (nx + 1) + i;
      const b = a + 1, c = a + nx + 1, d = c + 1;
      top.tri(a, b, c);
      top.tri(b, d, c);
    }

  if (lift > 0) return; // декаль — без боков

  // Бока: обходим периметр
  const edges: [number, number, number, number, number, number, number][] = [
    // x0,z0,x1,z1, nx,nz, segments
    [-hw, hl, hw, hl, 0, 1, nx],
    [hw, -hl, -hw, -hl, 0, -1, nx],
    [hw, hl, hw, -hl, 1, 0, nz],
    [-hw, -hl, -hw, hl, -1, 0, nz],
  ];
  for (const [x0, z0, x1, z1, enx, enz, segs] of edges) {
    const [wnx, wnz] = rn(enx, enz);
    const b0 = side.count;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t;
      const h = profileHeight(def, lx, lz);
      side.vert(tx(lx, lz), oy + h, tz(lx, lz), wnx, 0, wnz, t, 0, o.sideTop);
      side.vert(tx(lx, lz), oy + h - def.th, tz(lx, lz), wnx, 0, wnz, t, 1, o.sideBottom);
    }
    for (let k = 0; k < segs; k++) {
      const a = b0 + k * 2;
      side.tri(a, a + 1, a + 2);
      side.tri(a + 2, a + 1, a + 3);
    }
  }
  // Низ (простой: по углам)
  const corners: [number, number][] = [[-hw, hl], [hw, hl], [hw, -hl], [-hw, -hl]];
  const bb = side.count;
  for (const [lx, lz] of corners) side.vert(tx(lx, lz), oy + profileHeight(def, lx, lz) - def.th, tz(lx, lz), 0, -1, 0, 0, 0, o.sideBottom);
  side.tri(bb, bb + 2, bb + 1);
  side.tri(bb, bb + 3, bb + 2);
}
