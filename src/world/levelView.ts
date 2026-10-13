// 3D-представление уровня: плитки (склеенные в общие меши), движущиеся объекты, монеты, флаги, финиш.
import * as THREE from 'three';
import { GeoBuilder, buildPlatformGeo } from '../render/geo';
import { bounceTexture, chevronTexture, crackTexture, finishTexture, tileTexture } from '../render/textures';
import { GEO, glow, mesh, toon } from '../entities/materials';
import { Platform, type PlatformDef } from './platform';
import type { LevelData, Spot } from './generator';

export interface CheckpointView {
  spot: Spot;
  flag: THREE.Mesh;
  ring: THREE.Mesh;
  active: boolean;
  pole: THREE.Group;
}

export class LevelView {
  group = new THREE.Group();
  platforms: Platform[] = [];
  coinMesh: THREE.InstancedMesh;
  coinTaken: boolean[];
  coinPos: THREE.Vector3[];
  checkpoints: CheckpointView[] = [];
  private chevronTex: THREE.Texture;
  private flagGeo: THREE.PlaneGeometry;
  private flagBase: Float32Array;
  private dummy = new THREE.Object3D();
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  finishGate: THREE.Group;

  constructor(public data: LevelData, shadows: boolean) {
    const th = data.theme;
    const sideTop = new THREE.Color(th.side), sideBottom = new THREE.Color(th.sideDark);
    const opts = { world: true, sideTop, sideBottom };

    const topMat = new THREE.MeshLambertMaterial({ map: tileTexture(data.look.pattern, data.look.tileA, data.look.tileB) });
    const sideMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.chevronTex = chevronTexture().clone();
    this.chevronTex.needsUpdate = true;
    this.chevronTex.wrapS = this.chevronTex.wrapT = THREE.RepeatWrapping;
    const chevMat = new THREE.MeshBasicMaterial({ map: this.chevronTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const bounceMat = new THREE.MeshLambertMaterial({ map: bounceTexture() });
    const barrierMat = toon(th.accent);
    this.materials.push(topMat, sideMat, chevMat, bounceMat);

    const staticTop = new GeoBuilder(), staticSide = new GeoBuilder(), chev = new GeoBuilder(), barriers = new GeoBuilder();
    const accent = new THREE.Color(th.accent), white = new THREE.Color(0xffffff), pole = new THREE.Color(0xdddddd);

    data.platforms.forEach((def, i) => {
      const p = new Platform(def, i);
      this.platforms.push(p);
      const dynamic = !!def.motion || def.role === 'vanish';
      if (def.role === 'barrier') {
        if (def.motion) {
          // Вращающаяся палка
          const g = new THREE.Group();
          const bar = new GeoBuilder();
          bar.box(0, -def.th / 2, 0, def.w, def.th, def.l, 0, accent, white);
          const barMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: barrierMat.gradientMap });
          this.materials.push(barMat);
          const m = new THREE.Mesh(this.track(bar.build()), barMat);
          m.castShadow = shadows;
          g.add(m);
          g.add(mesh(GEO.cyl, toon(0xdddddd), 0.25, def.lift! + def.th, 0.25, 0, -(def.lift! + def.th) / 2, 0));
          g.add(mesh(GEO.sphere, toon(th.accent), 0.35, 0.35, 0.35, 0, 0.05, 0));
          this.group.add(g);
          p.object = g;
        } else {
          barriers.box(def.x, def.y - def.th / 2, def.z, def.w, def.th, def.l, def.yaw, accent, white);
          const cs = Math.cos(def.yaw), sn = Math.sin(def.yaw);
          const postH = def.lift! + def.th;
          for (const s of [-1, 1]) {
            const lx = s * (def.w / 2 - 0.15);
            barriers.box(def.x + lx * cs, def.y - postH / 2, def.z - lx * sn, 0.22, postH, 0.22, def.yaw, pole);
          }
        }
        return;
      }
      if (dynamic) {
        const top = new GeoBuilder(), side = new GeoBuilder();
        buildPlatformGeo(def, top, side, { world: false, sideTop, sideBottom });
        const g = new THREE.Group();
        let tm: THREE.Material = topMat;
        if (def.role === 'vanish') {
          tm = new THREE.MeshLambertMaterial({ map: crackTexture(data.look.tileA, data.look.tileB), transparent: true });
          this.materials.push(tm);
        }
        const sm = def.role === 'vanish' ? new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }) : sideMat;
        if (sm !== sideMat) this.materials.push(sm);
        const tmesh = new THREE.Mesh(this.track(top.build()), tm);
        const smesh = new THREE.Mesh(this.track(side.build()), sm);
        tmesh.receiveShadow = true;
        smesh.castShadow = shadows;
        g.add(tmesh, smesh);
        g.position.set(def.x, def.y, def.z);
        g.rotation.y = def.yaw;
        this.group.add(g);
        p.object = g;
        g.userData.mats = [tm, sm];
        return;
      }
      if (def.role === 'bounce') {
        const top = new GeoBuilder(), side = new GeoBuilder();
        buildPlatformGeo(def, top, side, { world: true, sideTop, sideBottom });
        // UV батута на всю плитку
        const uv = top.uv;
        for (let k = 0; k < uv.length; k += 2) {
          uv[k] = uv[k] / (def.w / 2);
          uv[k + 1] = uv[k + 1] / (def.l / 2);
        }
        const tmesh = new THREE.Mesh(this.track(top.build()), bounceMat);
        tmesh.receiveShadow = true;
        this.group.add(tmesh);
        buildPlatformGeo(def, new GeoBuilder(), staticSide, opts);
        // пружины
        return;
      }
      buildPlatformGeo(def, staticTop, staticSide, opts);
      if (def.boost) this.addChevrons(def, chev);
    });

    const top = new THREE.Mesh(this.track(staticTop.build()), topMat);
    top.receiveShadow = true;
    const side = new THREE.Mesh(this.track(staticSide.build()), sideMat);
    side.castShadow = shadows;
    side.receiveShadow = false;
    this.group.add(top, side);
    if (chev.count) {
      const cm = new THREE.Mesh(this.track(chev.build()), chevMat);
      cm.renderOrder = 2;
      this.group.add(cm);
    }
    if (barriers.count) {
      const bm = new THREE.Mesh(this.track(barriers.build()), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: barrierMat.gradientMap }));
      bm.castShadow = shadows;
      this.group.add(bm);
    }

    // Монеты
    const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20);
    coinGeo.rotateX(Math.PI / 2);
    this.geometries.push(coinGeo);
    const coinMat = new THREE.MeshToonMaterial({ color: 0xffc928, emissive: 0x8a5a00, emissiveIntensity: 0.45, gradientMap: barrierMat.gradientMap });
    this.materials.push(coinMat);
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, Math.max(1, data.coins.length));
    this.coinMesh.castShadow = shadows;
    this.coinPos = data.coins.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.coinTaken = data.coins.map(() => false);
    this.group.add(this.coinMesh);

    // Флажки чекпоинтов
    this.flagGeo = new THREE.PlaneGeometry(1.2, 0.8, 8, 1);
    this.flagGeo.translate(0.6, 0, 0);
    this.flagBase = Float32Array.from(this.flagGeo.attributes.position.array as Float32Array);
    this.geometries.push(this.flagGeo);
    data.checkpoints.forEach((spot, i) => {
      if (i === 0) return;
      this.checkpoints.push(this.makeCheckpoint(spot, th.accent));
    });

    this.finishGate = this.makeFinish(data);
    this.group.add(this.finishGate);
  }

  private track<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private addChevrons(def: PlatformDef, b: GeoBuilder): void {
    const narrow: PlatformDef = { ...def, w: Math.min(def.w * 0.55, 3) };
    const start = b.count;
    buildPlatformGeo(narrow, b, new GeoBuilder(), { world: true, sideTop: new THREE.Color(), sideBottom: new THREE.Color() }, 0, 0.04);
    // UV: u по ширине 0..1, v вдоль длины (одна пара шевронов на 2 юнита)
    for (let k = start; k < b.count; k++) {
      b.uv[k * 2] = b.uv[k * 2] / (narrow.w / 2);
    }
  }

  private makeCheckpoint(spot: Spot, accent: number): CheckpointView {
    const g = new THREE.Group();
    const cs = Math.cos(spot.yaw), sn = Math.sin(spot.yaw);
    const lx = 2.6;
    g.position.set(spot.x + lx * cs, spot.y, spot.z - lx * sn);
    g.rotation.y = spot.yaw;
    g.add(mesh(GEO.cyl, toon(0xeeeeee), 0.07, 3.2, 0.07, 0, 1.6, 0));
    g.add(mesh(GEO.sphere, toon(0xffd54f), 0.13, 0.13, 0.13, 0, 3.22, 0));
    const flagMat = new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.materials.push(flagMat);
    const flag = new THREE.Mesh(this.flagGeo, flagMat);
    flag.position.set(0, 2.75, 0);
    flag.rotation.y = Math.PI / 2;
    flag.castShadow = true;
    g.add(flag);
    const ringMat = glow(0xffffff, 0.85);
    this.materials.push(ringMat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 6, 40), ringMat);
    this.geometries.push(ring.geometry);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spot.x, spot.y + 0.05, spot.z);
    this.group.add(ring, g);
    void accent;
    return { spot, flag, ring, active: false, pole: g };
  }

  activateCheckpoint(cp: CheckpointView): void {
    cp.active = true;
    (cp.flag.material as THREE.MeshToonMaterial).color.setHex(0x2ee86b);
    (cp.ring.material as THREE.MeshBasicMaterial).color.setHex(0x2ee86b);
  }

  private makeFinish(data: LevelData): THREE.Group {
    const f = data.finish;
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = f.yaw;
    const red = toon(data.theme.accent);
    const hw = f.w / 2;
    for (const s of [-1, 1]) {
      g.add(mesh(GEO.box, red, 0.5, 4.6, 0.5, s * hw, 2.3, 0));
      g.add(mesh(GEO.box, toon(0xffffff), 0.6, 0.25, 0.6, s * hw, 0.12, 0));
    }
    g.add(mesh(GEO.box, red, f.w + 0.5, 0.5, 0.5, 0, 4.6, 0));
    // внутренняя рамка (как на референсе)
    g.add(mesh(GEO.box, red, 0.25, 3.2, 0.25, -hw + 0.9, 2.6, -0.6));
    g.add(mesh(GEO.box, red, 0.25, 3.2, 0.25, hw - 0.9, 2.6, -0.6));
    g.add(mesh(GEO.box, red, f.w - 1.55, 0.25, 0.25, 0, 4.1, -0.6));
    const tex = finishTexture('FINISH');
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.4, 1.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.set(0, 5.5, 0);
    g.add(banner);
    this.geometries.push(banner.geometry);
    this.materials.push(banner.material as THREE.Material);
    // клетчатая полоса на земле
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(f.w, 1), new THREE.MeshBasicMaterial({ map: finishStripTexture() }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = 0.03;
    g.add(strip);
    this.geometries.push(strip.geometry);
    // шарики
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? -1 : 1;
      const k = i % 3;
      g.add(mesh(GEO.sphere, toon([0xff4f9a, 0xffd54f, 0x4fc3f7][k]), 0.35, 0.42, 0.35, s * (hw + 0.4 + k * 0.3), 4.8 + k * 0.6, 0.2 * k));
    }
    return g;
  }

  resetCoins(): void {
    this.coinTaken.fill(false);
    this.data.coins.forEach(([x, y, z], i) => this.coinPos[i].set(x, y, z));
  }

  update(t: number, dt: number): void {
    for (const p of this.platforms) {
      p.update(t, dt);
      if (p.object) {
        p.object.position.set(p.x, p.y, p.z);
        p.object.rotation.y = p.yaw;
        if (p.def.role === 'vanish') {
          const g = p.object as unknown as THREE.Group;
          g.visible = p.fade > 0.01;
          const shake = p.vanishT >= 0 ? Math.sin(t * 60) * 0.05 : 0;
          g.position.set(p.x + shake, p.y - (1 - p.fade) * 1.5, p.z);
          for (const m of g.userData.mats as THREE.Material[]) m.opacity = p.fade;
        }
      }
    }
    // монеты
    const d = this.dummy;
    for (let i = 0; i < this.coinPos.length; i++) {
      const c = this.coinPos[i];
      d.position.copy(c);
      d.position.y += Math.sin(t * 3 + i) * 0.08;
      d.rotation.set(0, t * 3 + i * 0.3, 0);
      d.scale.setScalar(this.coinTaken[i] ? 0 : 1);
      d.updateMatrix();
      this.coinMesh.setMatrixAt(i, d.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    // флажки колышутся
    const pos = this.flagGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = this.flagBase[i * 3];
      pos.setZ(i, Math.sin(t * 6 - x * 4) * 0.12 * x);
    }
    pos.needsUpdate = true;
    this.chevronTex.offset.y = -t * 1.5;
    for (const cp of this.checkpoints) cp.ring.rotation.z = t;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.coinMesh.dispose();
    this.chevronTex.dispose();
  }
}

let stripTex: THREE.Texture | null = null;
function finishStripTexture(): THREE.Texture {
  if (stripTex) return stripTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 16; x++) {
      g.fillStyle = (x + y) % 2 ? '#222' : '#fff';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  stripTex = new THREE.CanvasTexture(c);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  return stripTex;
}
