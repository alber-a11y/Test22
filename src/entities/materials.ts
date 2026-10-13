// Общие мультяшные материалы с кешем по цвету.
import * as THREE from 'three';
import { toonGradient } from '../render/textures';

const toonCache = new Map<string, THREE.MeshToonMaterial>();

export function toon(color: number, emissive = 0, emissiveIntensity = 1): THREE.MeshToonMaterial {
  const key = `${color}-${emissive}-${emissiveIntensity}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive, emissiveIntensity });
    toonCache.set(key, m);
  }
  return m;
}

/** Уникальный (не кешированный) материал — для перекраски. */
export function toonUnique(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
}

export function glow(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });
}

// Общие геометрии
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLow: new THREE.SphereGeometry(1, 12, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 12),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  torus: new THREE.TorusGeometry(1, 0.22, 10, 24),
};

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Цилиндр-трубка между двумя точками. */
export function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(GEO.cylLow, mat);
  m.scale.set(r, d.length(), r);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}
