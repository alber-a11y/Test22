// Игрушечный персонаж из примитивов: голова, тело, руки и ноги на шарнирах.
import * as THREE from 'three';
import type { CharacterDef } from '../economy/catalog';
import { GEO, glow, mesh, toon } from './materials';

export const LEG_UPPER = 0.36;
export const LEG_LOWER = 0.36;
export const ARM_LEN = 0.5;

export interface Limb {
  pivot: THREE.Group;
  knee?: THREE.Group;
}

export class Character {
  root = new THREE.Group();
  hips = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  legL: Limb;
  legR: Limb;
  armL: THREE.Group;
  armR: THREE.Group;
  cape: THREE.Mesh | null = null;
  private blinkT = 2;
  private eyes: THREE.Object3D[] = [];

  constructor(public def: CharacterDef) {
    const skin = toon(def.skin);
    const shirt = toon(def.shirt);
    const pants = toon(def.pants);
    const shoes = toon(def.shoes);

    this.root.add(this.hips);
    // Таз
    this.hips.add(mesh(GEO.sphere, pants, 0.25, 0.16, 0.2, 0, 0.02, 0));

    // Торс
    this.hips.add(this.torso);
    this.torso.position.y = 0.05;
    const body = mesh(GEO.capsule, shirt, 0.25, 0.2, 0.2, 0, 0.3, 0);
    this.torso.add(body);
    if (def.gender === 'girl') {
      // юбочка
      const skirt = mesh(GEO.cone, pants, 0.33, 0.25, 0.3, 0, 0.06, 0);
      skirt.rotation.x = Math.PI;
      this.torso.add(skirt);
    }

    // Голова
    this.torso.add(this.head);
    this.head.position.y = 0.72;
    this.buildHead(skin);

    // Руки
    const mkArm = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.27, 0.48, 0);
      g.add(mesh(GEO.capsule, shirt, 0.085, 0.13, 0.085, 0, -0.12, 0));
      g.add(mesh(GEO.capsule, skin, 0.075, 0.12, 0.075, 0, -0.34, 0));
      g.add(mesh(GEO.sphere, skin, 0.095, 0.095, 0.095, 0, -ARM_LEN + 0.02, 0));
      this.torso.add(g);
      return g;
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);

    // Ноги
    const mkLeg = (side: number): Limb => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.12, 0, 0);
      pivot.add(mesh(GEO.capsule, pants, 0.1, LEG_UPPER * 0.55, 0.1, 0, -LEG_UPPER / 2, 0));
      const knee = new THREE.Group();
      knee.position.y = -LEG_UPPER;
      knee.add(mesh(GEO.capsule, def.gender === 'girl' ? skin : pants, 0.09, LEG_LOWER * 0.55, 0.09, 0, -LEG_LOWER / 2, 0));
      const shoe = mesh(GEO.sphere, shoes, 0.11, 0.08, 0.17, 0, -LEG_LOWER - 0.02, -0.05);
      knee.add(shoe);
      pivot.add(knee);
      this.hips.add(pivot);
      return { pivot, knee };
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

    // Аксессуары
    if (def.extra === 'backpack') {
      this.torso.add(mesh(GEO.box, toon(0xf2994a), 0.32, 0.36, 0.16, 0, 0.32, 0.2));
    }
    if (def.extra === 'cape') {
      const capeGeo = new THREE.PlaneGeometry(0.5, 0.75, 1, 4);
      capeGeo.translate(0, -0.375, 0);
      const cape = new THREE.Mesh(capeGeo, new THREE.MeshToonMaterial({ color: 0xeb5757, side: THREE.DoubleSide }));
      cape.position.set(0, 0.58, 0.2);
      cape.castShadow = true;
      this.torso.add(cape);
      this.cape = cape;
    }
    if (def.extra === 'bolts') {
      this.torso.add(mesh(GEO.cyl, toon(0xffd54f), 0.06, 0.04, 0.06, 0, 0.36, -0.21).rotateX(Math.PI / 2));
      this.torso.add(mesh(GEO.box, glow(0x00e5ff), 0.14, 0.08, 0.02, 0, 0.22, -0.21));
    }

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  private buildHead(skin: THREE.Material): void {
    const d = this.def;
    const h = this.head;
    const R = 0.36;
    h.add(mesh(GEO.sphere, skin, R, R * 0.95, R, 0, 0, 0));
    const face = d.face ?? 'happy';

    // Глаза
    const eyeMat = toon(face === 'robot' ? 0x00e5ff : 0x1b1b2f);
    const white = glow(0xffffff);
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.12, 0.04, -R * 0.9);
      if (face === 'robot') {
        eye.add(mesh(GEO.box, glow(0x00e5ff), 0.12, 0.05, 0.03));
      } else if (face === 'cool') {
        eye.add(mesh(GEO.box, toon(0x111111), 0.15, 0.07, 0.04));
      } else {
        eye.add(mesh(GEO.sphere, eyeMat, 0.055, face === 'zombie' ? 0.04 : 0.075, 0.04));
        eye.add(mesh(GEO.sphere, white, 0.02, 0.02, 0.02, 0.018, 0.025, -0.03));
      }
      h.add(eye);
      this.eyes.push(eye);
    }
    if (face === 'cool') h.add(mesh(GEO.box, toon(0x111111), 0.12, 0.025, 0.02, 0, 0.05, -R * 0.93));
    if (d.extra === 'eyepatch') {
      h.add(mesh(GEO.sphere, toon(0x111111), 0.08, 0.08, 0.03, 0.12, 0.04, -R * 0.93));
      const strap = mesh(GEO.torus, toon(0x111111), R * 1.0, R * 1.0, 0.25, 0, 0.06, 0);
      strap.rotation.set(0.2, 0, 0.35);
      strap.scale.set(R * 1.01, R * 1.01, 0.12);
      h.add(strap);
    }
    if (d.extra === 'mask') {
      const m = mesh(GEO.sphere, toon(0x111111), R * 1.01, 0.09, R * 1.01, 0, 0.04, 0);
      h.add(m);
    }
    if (d.extra === 'stitches') {
      h.add(mesh(GEO.box, toon(0x3e2723), 0.12, 0.012, 0.02, -0.18, 0.18, -R * 0.82));
      for (let i = 0; i < 3; i++) h.add(mesh(GEO.box, toon(0x3e2723), 0.012, 0.05, 0.02, -0.22 + i * 0.04, 0.18, -R * 0.83));
    }

    // Рот
    if (face !== 'robot') {
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 12, Math.PI), toon(face === 'zombie' ? 0x2e3b1f : 0x7a2a2a));
      smile.position.set(0, -0.1, -R * 0.93);
      smile.rotation.z = Math.PI;
      if (face === 'grin') smile.scale.set(1.3, 1.1, 1);
      h.add(smile);
    } else {
      h.add(mesh(GEO.box, toon(0x37474f), 0.16, 0.03, 0.03, 0, -0.1, -R * 0.93));
    }
    if (d.gender === 'girl') {
      const blush = glow(0xff8fb1, 0.6);
      h.add(mesh(GEO.sphere, blush, 0.05, 0.03, 0.02, -0.2, -0.05, -R * 0.84));
      h.add(mesh(GEO.sphere, blush, 0.05, 0.03, 0.02, 0.2, -0.05, -R * 0.84));
    }

    // Волосы
    const hair = toon(d.hairColor);
    switch (d.hair) {
      case 'short':
        h.add(mesh(GEO.sphere, hair, R * 1.04, R * 0.7, R * 1.04, 0, 0.1, 0.03));
        break;
      case 'spiky':
        h.add(mesh(GEO.sphere, hair, R * 1.03, R * 0.6, R * 1.03, 0, 0.12, 0.04));
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const c = mesh(GEO.cone, hair, 0.1, 0.26, 0.1, Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2 + 0.04);
          c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          h.add(c);
        }
        break;
      case 'messy':
        h.add(mesh(GEO.sphere, hair, R * 1.08, R * 0.75, R * 1.08, 0, 0.12, 0.04));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          h.add(mesh(GEO.sphere, hair, 0.13, 0.11, 0.13, Math.cos(a) * 0.26, 0.24 + (i % 2) * 0.05, Math.sin(a) * 0.26 + 0.05));
        }
        break;
      case 'ponytail':
        h.add(mesh(GEO.sphere, hair, R * 1.05, R * 0.75, R * 1.05, 0, 0.1, 0.03));
        h.add(mesh(GEO.sphere, hair, 0.13, 0.13, 0.13, 0, 0.18, R + 0.02));
        h.add(mesh(GEO.capsule, hair, 0.1, 0.22, 0.1, 0, -0.05, R + 0.1));
        h.add(mesh(GEO.sphere, toon(0xff4f9a), 0.06, 0.06, 0.06, 0, 0.2, R * 0.95));
        break;
      case 'long':
        h.add(mesh(GEO.sphere, hair, R * 1.07, R * 0.8, R * 1.07, 0, 0.1, 0.04));
        h.add(mesh(GEO.box, hair, R * 1.9, 0.5, 0.25, 0, -0.18, R * 0.55));
        for (const s of [-1, 1]) h.add(mesh(GEO.capsule, hair, 0.1, 0.3, 0.1, s * R * 0.92, -0.12, 0.05));
        break;
      case 'buns':
        h.add(mesh(GEO.sphere, hair, R * 1.04, R * 0.72, R * 1.04, 0, 0.1, 0.03));
        for (const s of [-1, 1]) h.add(mesh(GEO.sphere, hair, 0.14, 0.14, 0.14, s * 0.24, 0.32, 0.05));
        break;
      case 'bob':
        h.add(mesh(GEO.sphere, hair, R * 1.1, R * 0.9, R * 1.1, 0, 0.04, 0.05));
        break;
      default:
        break;
    }
    // Чёлка — закрывает «шов» шапки волос спереди
    if (d.hair !== 'none' && d.hat !== 'ninja' && d.hat !== 'helmet') {
      h.add(mesh(GEO.sphere, hair, R * 0.8, R * 0.25, R * 0.5, 0, 0.25, -R * 0.55));
    }

    // Головные уборы
    const hc = toon(d.hatColor);
    switch (d.hat) {
      case 'cap': {
        h.add(mesh(GEO.sphere, hc, R * 1.06, R * 0.62, R * 1.06, 0, 0.14, 0));
        const visor = mesh(GEO.cyl, hc, 0.24, 0.03, 0.2, 0, 0.17, 0.4);
        h.add(visor); // козырёк назад, как у референса
        h.add(mesh(GEO.sphere, toon(0xffffff), 0.04, 0.04, 0.04, 0, 0.36, 0));
        break;
      }
      case 'helmet':
        h.add(mesh(GEO.sphere, hc, R * 1.22, R * 1.18, R * 1.22, 0, 0.02, 0.02));
        h.add(mesh(GEO.sphere, new THREE.MeshToonMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.55, gradientMap: (hc as THREE.MeshToonMaterial).gradientMap }), R * 0.9, R * 0.7, R * 0.4, 0, 0.0, -R * 0.85));
        break;
      case 'ninja': {
        h.add(mesh(GEO.sphere, toon(0x26262e), R * 1.05, R * 1.0, R * 1.05, 0, 0.02, 0.02));
        // вырез для глаз — полоса кожи
        h.add(mesh(GEO.box, toon(this.def.skin), 0.42, 0.14, 0.06, 0, 0.04, -R * 0.94));
        const band = mesh(GEO.cyl, hc, R * 1.08, 0.08, R * 1.08, 0, 0.17, 0);
        h.add(band);
        for (const s of [-1, 1]) {
          const tail = mesh(GEO.box, hc, 0.06, 0.05, 0.3, s * 0.06, 0.15, R + 0.15);
          tail.rotation.set(-0.5, s * 0.3, 0);
          h.add(tail);
        }
        break;
      }
      case 'crown':
        h.add(mesh(GEO.cyl, hc, 0.2, 0.12, 0.2, 0, 0.36, 0));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          h.add(mesh(GEO.cone, hc, 0.05, 0.12, 0.05, Math.cos(a) * 0.17, 0.48, Math.sin(a) * 0.17));
        }
        h.add(mesh(GEO.sphere, glow(0xff4081), 0.04, 0.04, 0.04, 0, 0.38, -0.2));
        break;
      case 'catears':
        for (const s of [-1, 1]) {
          const e = mesh(GEO.cone, hc, 0.11, 0.2, 0.06, s * 0.2, 0.36, 0);
          e.rotation.z = -s * 0.35;
          h.add(e);
          const inner = mesh(GEO.cone, toon(0xffffff), 0.06, 0.12, 0.03, s * 0.2, 0.35, -0.03);
          inner.rotation.z = -s * 0.35;
          h.add(inner);
        }
        break;
      case 'pirate': {
        const brim = mesh(GEO.cyl, hc, 0.48, 0.05, 0.3, 0, 0.3, 0);
        h.add(brim);
        h.add(mesh(GEO.sphere, hc, 0.3, 0.2, 0.25, 0, 0.36, 0));
        h.add(mesh(GEO.sphere, toon(0xffffff), 0.06, 0.06, 0.02, 0, 0.4, -0.25));
        break;
      }
      case 'horn': {
        const horn = mesh(GEO.cone, glow(0xffd54f), 0.07, 0.32, 0.07, 0, 0.42, -0.18);
        horn.rotation.x = -0.4;
        h.add(horn);
        for (const s of [-1, 1]) {
          const e = mesh(GEO.cone, toon(0xffffff), 0.07, 0.16, 0.05, s * 0.24, 0.3, 0.05);
          e.rotation.z = -s * 0.5;
          h.add(e);
        }
        break;
      }
      case 'antenna':
        h.add(mesh(GEO.cylLow, toon(0x90a4ae), 0.015, 0.25, 0.015, 0, 0.45, 0));
        h.add(mesh(GEO.sphere, glow(0xff5252), 0.06, 0.06, 0.06, 0, 0.6, 0));
        for (const s of [-1, 1]) h.add(mesh(GEO.cyl, toon(0x90a4ae), 0.08, 0.06, 0.08, s * R, 0, 0).rotateZ(Math.PI / 2));
        break;
      case 'beanie':
        h.add(mesh(GEO.sphere, hc, R * 1.08, R * 0.75, R * 1.08, 0, 0.13, 0));
        h.add(mesh(GEO.cyl, hc, R * 1.1, 0.1, R * 1.1, 0, 0.04, 0));
        h.add(mesh(GEO.sphere, toon(0xffffff), 0.08, 0.08, 0.08, 0, 0.42, 0));
        break;
      default:
        break;
    }
  }

  /** Двухзвенная IK ноги в плоскости «вперёд/вниз». f — вперёд, dn — вниз от бедра. */
  setLeg(leg: Limb, f: number, dn: number, splay = 0): void {
    const L1 = LEG_UPPER, L2 = LEG_LOWER + 0.04;
    let D = Math.hypot(f, dn);
    D = Math.min(Math.max(D, 0.15), L1 + L2 - 0.001);
    const phi = Math.atan2(f, dn);
    const alpha = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
    const beta = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))));
    leg.pivot.rotation.set(phi + alpha, 0, splay);
    leg.knee!.rotation.x = -(Math.PI - beta);
  }

  /** Направить руку в точку (в координатах торса). */
  pointArm(arm: THREE.Group, target: THREE.Vector3): void {
    const dir = target.clone().sub(arm.position).normalize();
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }

  update(dt: number, t: number, speed: number): void {
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = blink ? 0.15 : 1;
    if (this.cape) this.cape.rotation.x = -0.25 - Math.min(1.1, speed * 0.07) - Math.sin(t * 14) * 0.06 * Math.min(1, speed / 5);
  }
}
