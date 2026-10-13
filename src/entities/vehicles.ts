// Модели транспорта из примитивов. Нос смотрит в -Z.
import * as THREE from 'three';
import type { VehicleDef, VehicleKind } from '../economy/catalog';
import { GEO, glow, mesh, toon, toonUnique, tube } from './materials';

export interface VehicleModel {
  group: THREE.Group;
  body: THREE.Group; // часть, которая наклоняется
  wheels: { obj: THREE.Object3D; r: number }[];
  steer: THREE.Object3D | null;
  crank: THREE.Group | null;
  crankR: number;
  crankPos: THREE.Vector3;
  seat: THREE.Vector3;
  hands: [THREE.Vector3, THREE.Vector3];
  feet: [THREE.Vector3, THREE.Vector3];
  lean: number;
  paint: THREE.MeshToonMaterial;
  hover: number;
  exhaust: THREE.Vector3[];
  fireWheels: boolean;
  glowMats: THREE.MeshBasicMaterial[];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function wheel(r: number, width: number, tireColor: number, rimMat: THREE.Material, spokes = true, emissive?: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r - width * 0.4, width * 0.45, 8, 24), emissive ?? toon(tireColor));
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const hub = mesh(GEO.cyl, rimMat, r * 0.18, width * 0.9, r * 0.18);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  if (spokes) {
    for (let i = 0; i < 3; i++) {
      const s = mesh(GEO.box, rimMat, 0.02, (r - width * 0.4) * 2, 0.02);
      s.rotation.x = (i / 3) * Math.PI;
      g.add(s);
    }
  } else {
    const disc = mesh(GEO.cyl, rimMat, r * 0.62, width * 0.7, r * 0.62);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
  }
  return g;
}

function base(def: VehicleDef): VehicleModel {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  return {
    group, body, wheels: [], steer: null, crank: null, crankR: 0.17, crankPos: V(0, 0.36, 0),
    seat: V(0, 1, 0), hands: [V(-0.28, 1.15, -0.5), V(0.28, 1.15, -0.5)], feet: [V(-0.15, 0.2, 0.15), V(0.15, 0.2, -0.15)],
    lean: 0.3, paint: toonUnique(def.color), hover: 0, exhaust: [], fireWheels: false, glowMats: [],
  };
}

function bicycle(m: VehicleModel, opts: { tire: number; rim: THREE.Material; wheelMat?: THREE.Material; r?: number }): void {
  const r = opts.r ?? 0.36;
  const frame = m.paint;
  const back = V(0, r, 0.58);
  const crank = V(0, 0.38, 0.02), seatTop = V(0, 0.9, 0.2), head = V(0, 0.95, -0.42);
  m.body.add(tube(back, crank, 0.035, frame));
  m.body.add(tube(back, seatTop, 0.035, frame));
  m.body.add(tube(crank, seatTop, 0.04, frame));
  m.body.add(tube(crank, head, 0.045, frame));
  m.body.add(tube(seatTop.clone().add(V(0, -0.05, 0)), head, 0.04, frame));
  // седло
  m.body.add(mesh(GEO.capsule, toon(0x222222), 0.08, 0.12, 0.08, 0, 0.98, 0.2).rotateX(Math.PI / 2));
  // вилка + руль (поворачиваются)
  const steer = new THREE.Group();
  steer.position.copy(head);
  steer.rotation.x = -0.25;
  steer.add(tube(V(0, 0.2, 0), V(0, -(head.y - r), -0.1), 0.035, frame));
  steer.add(tube(V(-0.3, 0.25, 0.05), V(0.3, 0.25, 0.05), 0.03, toon(0x333333)));
  for (const s of [-1, 1]) steer.add(mesh(GEO.capsule, toon(0x111111), 0.04, 0.08, 0.04, s * 0.3, 0.25, 0.05).rotateZ(Math.PI / 2));
  m.body.add(steer);
  m.steer = steer;
  const fw = wheel(r, 0.09, opts.tire, opts.rim, true, opts.wheelMat);
  fw.position.set(0, -(head.y - r), -0.1);
  steer.add(fw);
  const bw = wheel(r, 0.09, opts.tire, opts.rim, true, opts.wheelMat);
  bw.position.copy(back);
  m.body.add(bw);
  m.wheels.push({ obj: fw, r }, { obj: bw, r });
  // шатуны
  const cr = new THREE.Group();
  cr.position.copy(crank);
  cr.add(mesh(GEO.cyl, toon(0x888888), 0.1, 0.05, 0.1).rotateZ(Math.PI / 2));
  for (const s of [-1, 1]) {
    const arm = mesh(GEO.box, toon(0x555555), 0.03, 0.03, 0.17, s * 0.1, 0, s * 0.085);
    cr.add(arm);
    cr.add(mesh(GEO.box, toon(0x222222), 0.1, 0.03, 0.06, s * 0.16, 0, s * 0.17));
  }
  m.body.add(cr);
  m.crank = cr;
  m.crankPos = crank;
  m.seat = V(0, 1.02, 0.22);
  m.hands = [V(-0.28, 1.17, -0.44), V(0.28, 1.17, -0.44)];
  m.lean = 0.42;
}

function standDeck(m: VehicleModel, deckY: number): void {
  m.seat = V(0, deckY + 0.7, 0.02);
  m.feet = [V(-0.08, deckY + 0.04, 0.18), V(0.08, deckY + 0.04, -0.2)];
  m.lean = 0.12;
}

const BUILDERS: Record<VehicleKind, (m: VehicleModel, def: VehicleDef) => void> = {
  bmx(m) {
    bicycle(m, { tire: 0x222222, rim: toon(0xdddddd) });
  },
  fire(m) {
    const fireMat = glow(0xffa21a);
    m.glowMats.push(fireMat);
    bicycle(m, { tire: 0x222222, rim: glow(0xffd36b), wheelMat: fireMat });
    m.fireWheels = true;
  },
  unicorn(m) {
    bicycle(m, { tire: 0xff7ac6, rim: toon(0xb388ff) });
    const horn = mesh(GEO.cone, glow(0xffd54f), 0.06, 0.35, 0.06, 0, 0.4, -0.1);
    horn.rotation.x = -1.1;
    m.steer!.add(horn);
    for (let i = 0; i < 4; i++) m.body.add(mesh(GEO.sphere, toon([0xff7ac6, 0xb388ff, 0x80deea, 0xffd54f][i]), 0.06, 0.06, 0.06, 0, 0.92 - i * 0.04, 0.32 + i * 0.06));
  },
  scooter(m) {
    const deckY = 0.2;
    m.body.add(mesh(GEO.box, m.paint, 0.22, 0.06, 0.95, 0, deckY, 0.05));
    m.body.add(mesh(GEO.box, toon(0x222222), 0.2, 0.015, 0.8, 0, deckY + 0.035, 0.08));
    const steer = new THREE.Group();
    steer.position.set(0, deckY, -0.45);
    steer.add(tube(V(0, 0, 0), V(0, 0.95, 0.05), 0.035, toon(0xcccccc)));
    steer.add(tube(V(-0.26, 0.95, 0.05), V(0.26, 0.95, 0.05), 0.03, toon(0x333333)));
    const fw = wheel(0.14, 0.07, 0x222222, m.paint, false);
    fw.position.set(0, 0.14 - deckY, -0.03);
    steer.add(fw);
    m.body.add(steer);
    m.steer = steer;
    const bw = wheel(0.14, 0.07, 0x222222, m.paint, false);
    bw.position.set(0, 0.14, 0.48);
    m.body.add(bw);
    m.wheels.push({ obj: fw, r: 0.14 }, { obj: bw, r: 0.14 });
    standDeck(m, deckY);
    m.hands = [V(-0.26, 1.15, -0.4), V(0.26, 1.15, -0.4)];
    m.lean = 0.1;
  },
  skate(m) {
    const deckY = 0.2;
    const deck = mesh(GEO.capsule, m.paint, 0.2, 0.6, 0.05, 0, deckY, 0);
    deck.rotation.x = Math.PI / 2;
    deck.scale.set(0.2, 0.55, 0.04);
    m.body.add(deck);
    for (const z of [-0.33, 0.33]) {
      m.body.add(mesh(GEO.box, toon(0xaaaaaa), 0.26, 0.04, 0.05, 0, deckY - 0.06, z));
      for (const x of [-0.14, 0.14]) {
        const w = wheel(0.07, 0.06, 0xffeb3b, toon(0xffeb3b), false);
        w.position.set(x, 0.07, z);
        m.body.add(w);
        m.wheels.push({ obj: w, r: 0.07 });
      }
    }
    standDeck(m, deckY + 0.03);
    m.hands = [V(-0.55, 0.85, 0.1), V(0.55, 0.85, -0.05)];
  },
  hover(m) {
    m.hover = 0.35;
    const deck = mesh(GEO.capsule, m.paint, 0.25, 0.7, 0.06, 0, 0.22, 0);
    deck.rotation.x = Math.PI / 2;
    deck.scale.set(0.26, 0.6, 0.06);
    m.body.add(deck);
    const g = glow(0x00e5ff, 0.85);
    m.glowMats.push(g);
    const ring = mesh(GEO.torus, g, 0.3, 0.6, 0.3, 0, 0.14, 0);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(0.24, 0.55, 0.3);
    m.body.add(ring);
    for (const z of [-0.35, 0.35]) m.body.add(mesh(GEO.cyl, g, 0.1, 0.05, 0.1, 0, 0.13, z));
    standDeck(m, 0.25);
    m.hands = [V(-0.55, 0.9, 0.05), V(0.55, 0.9, -0.05)];
    m.exhaust = [V(0, 0.1, -0.35), V(0, 0.1, 0.35)];
  },
  monowheel(m) {
    const r = 0.42;
    const w = wheel(r, 0.16, 0x222222, toon(0xdddddd), false);
    w.position.set(0, r, 0);
    m.body.add(w);
    m.wheels.push({ obj: w, r });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.paint);
    shell.scale.set(0.42, 1, 1);
    shell.position.y = r;
    shell.castShadow = true;
    m.body.add(shell);
    for (const s of [-1, 1]) m.body.add(mesh(GEO.box, toon(0x333333), 0.14, 0.03, 0.2, s * 0.17, 0.18, 0));
    m.seat = V(0, 0.92, 0.02);
    m.feet = [V(-0.17, 0.2, 0), V(0.17, 0.2, 0)];
    m.hands = [V(-0.45, 0.85, -0.15), V(0.45, 0.85, -0.15)];
    m.lean = 0.08;
  },
  minimoto(m) {
    moto(m, 0.3, 0.75);
  },
  cross(m) {
    moto(m, 0.38, 0.95);
    m.body.add(mesh(GEO.box, toon(0xffffff), 0.02, 0.2, 0.25, 0.2, 0.75, 0.1));
    m.body.add(mesh(GEO.box, toon(0xffffff), 0.02, 0.2, 0.25, -0.2, 0.75, 0.1));
  },
  rocket(m) {
    moto(m, 0.32, 0.8);
    for (const s of [-1, 1]) {
      const r = mesh(GEO.cyl, toon(0xdddddd), 0.1, 0.55, 0.1, s * 0.3, 0.6, 0.45);
      r.rotation.x = Math.PI / 2;
      m.body.add(r);
      const nose = mesh(GEO.cone, toon(0xff3b3b), 0.1, 0.18, 0.1, s * 0.3, 0.6, 0.1);
      nose.rotation.x = -Math.PI / 2;
      m.body.add(nose);
      m.exhaust.push(V(s * 0.3, 0.6, 0.78));
    }
  },
  quad(m) {
    const paint = m.paint;
    m.body.add(mesh(GEO.box, paint, 0.6, 0.25, 1.0, 0, 0.55, 0));
    m.body.add(mesh(GEO.box, toon(0x222222), 0.4, 0.12, 0.5, 0, 0.72, 0.15));
    m.body.add(mesh(GEO.box, paint, 0.9, 0.08, 0.35, 0, 0.62, -0.5));
    m.body.add(mesh(GEO.box, paint, 0.9, 0.08, 0.35, 0, 0.62, 0.5));
    const steer = new THREE.Group();
    steer.position.set(0, 0.7, -0.35);
    steer.add(tube(V(0, 0, 0), V(0, 0.35, 0.05), 0.04, toon(0x333333)));
    steer.add(tube(V(-0.32, 0.35, 0.05), V(0.32, 0.35, 0.05), 0.035, toon(0x333333)));
    m.body.add(steer);
    m.steer = steer;
    for (const z of [-0.5, 0.5])
      for (const x of [-0.45, 0.45]) {
        const w = wheel(0.3, 0.22, 0x222222, toon(0xcccccc), false);
        w.position.set(x, 0.3, z);
        m.body.add(w);
        m.wheels.push({ obj: w, r: 0.3 });
      }
    m.seat = V(0, 0.92, 0.15);
    m.feet = [V(-0.3, 0.5, -0.05), V(0.3, 0.5, -0.05)];
    m.hands = [V(-0.32, 1.07, -0.3), V(0.32, 1.07, -0.3)];
    m.lean = 0.3;
    m.exhaust = [V(0.2, 0.5, 0.55)];
  },
  kart(m) {
    const paint = m.paint;
    m.body.add(mesh(GEO.box, paint, 0.7, 0.12, 1.3, 0, 0.22, 0));
    m.body.add(mesh(GEO.box, paint, 0.5, 0.18, 0.35, 0, 0.32, -0.6));
    m.body.add(mesh(GEO.box, toon(0x222222), 0.42, 0.4, 0.12, 0, 0.45, 0.3));
    m.body.add(mesh(GEO.box, toon(0x333333), 1.0, 0.06, 0.12, 0, 0.5, 0.65));
    const steer = new THREE.Group();
    steer.position.set(0, 0.55, -0.32);
    steer.rotation.x = -0.9;
    const sw = mesh(GEO.torus, toon(0x222222), 0.15, 0.15, 0.3);
    steer.add(sw);
    m.body.add(steer);
    m.steer = steer;
    for (const z of [-0.5, 0.5])
      for (const x of [-0.45, 0.45]) {
        const w = wheel(0.2, 0.2, 0x222222, toon(0xcccccc), false);
        w.position.set(x, 0.2, z);
        m.body.add(w);
        m.wheels.push({ obj: w, r: 0.2 });
      }
    m.seat = V(0, 0.4, 0.2);
    m.feet = [V(-0.14, 0.32, -0.55), V(0.14, 0.32, -0.55)];
    m.hands = [V(-0.14, 0.65, -0.28), V(0.14, 0.65, -0.28)];
    m.lean = -0.05;
    m.exhaust = [V(0.25, 0.3, 0.7)];
  },
};

function moto(m: VehicleModel, r: number, seatY: number): void {
  const paint = m.paint;
  m.body.add(mesh(GEO.capsule, paint, 0.18, 0.4, 0.18, 0, seatY - 0.15, -0.05).rotateX(Math.PI / 2));
  m.body.add(mesh(GEO.box, toon(0x222222), 0.26, 0.1, 0.5, 0, seatY - 0.02, 0.25));
  m.body.add(mesh(GEO.box, toon(0x555555), 0.2, 0.25, 0.3, 0, r + 0.05, 0.05));
  m.body.add(tube(V(0, r, 0.6), V(0, seatY - 0.1, 0.2), 0.04, toon(0x444444)));
  const steer = new THREE.Group();
  steer.position.set(0, seatY + 0.05, -0.4);
  steer.rotation.x = -0.35;
  steer.add(tube(V(0, 0.15, 0), V(0, -(seatY + 0.05 - r) - 0.05, 0), 0.04, toon(0xaaaaaa)));
  steer.add(tube(V(-0.32, 0.18, 0.05), V(0.32, 0.18, 0.05), 0.03, toon(0x333333)));
  steer.add(mesh(GEO.sphere, glow(0xfff9c4), 0.08, 0.08, 0.05, 0, 0.05, -0.1));
  const fw = wheel(r, 0.14, 0x222222, toon(0xcccccc), false);
  fw.position.set(0, -(seatY + 0.05 - r) - 0.05, 0);
  steer.add(fw);
  m.body.add(steer);
  m.steer = steer;
  const bw = wheel(r, 0.16, 0x222222, toon(0xcccccc), false);
  bw.position.set(0, r, 0.6);
  m.body.add(bw);
  m.wheels.push({ obj: fw, r }, { obj: bw, r });
  m.seat = V(0, seatY + 0.08, 0.2);
  m.feet = [V(-0.2, r * 0.9, 0.05), V(0.2, r * 0.9, 0.05)];
  m.hands = [V(-0.32, seatY + 0.28, -0.35), V(0.32, seatY + 0.28, -0.35)];
  m.lean = 0.4;
  m.exhaust = [V(0.18, r + 0.1, 0.65)];
}

export function buildVehicle(def: VehicleDef): VehicleModel {
  const m = base(def);
  BUILDERS[def.id](m, def);
  m.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return m;
}
