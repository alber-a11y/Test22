// Небо, облака, освещение и «море облаков» внизу.
import * as THREE from 'three';
import type { Theme } from '../world/themes';
import { Rng } from '../core/rng';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */ `
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
uniform float stars; uniform float time;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.6));
  float s = max(dot(vDir, sunDir), 0.0);
  col += sunColor * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.25);
  if (stars > 0.0 && h > 0.05) {
    vec3 q = floor(vDir * 220.0);
    float st = step(0.9965, hash(q));
    col += vec3(st) * stars * (0.6 + 0.4 * sin(time * 3.0 + hash(q + 1.0) * 30.0)) * smoothstep(0.05, 0.4, h);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Environment {
  group = new THREE.Group();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private clouds = new THREE.Group();
  private cloudMat: THREE.MeshLambertMaterial;
  private cloudGeo = new THREE.IcosahedronGeometry(1, 2);
  private sea: THREE.Mesh;
  private seaTex: THREE.CanvasTexture;
  private sunDir = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

  constructor(private scene: THREE.Scene, shadows: boolean) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() },
        sunDir: { value: this.sunDir },
        stars: { value: 0 },
        time: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.3);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera;
      c.left = -28;
      c.right = 28;
      c.top = 28;
      c.bottom = -28;
      c.near = 1;
      c.far = 120;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.03;
    }
    this.group.add(this.sun, this.sun.target);

    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: false });
    this.group.add(this.clouds);

    // Море облаков
    this.seaTex = this.makeSeaTexture();
    const seaMat = new THREE.MeshBasicMaterial({ map: this.seaTex, transparent: true, depthWrite: false, fog: true });
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), seaMat);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.renderOrder = -5;
    this.group.add(this.sea);

    scene.add(this.group);
  }

  private makeSeaTexture(): THREE.CanvasTexture {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const r = new Rng(42);
    for (let i = 0; i < 70; i++) {
      const x = r.range(0, S), y = r.range(0, S), rad = r.range(14, 46);
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.75)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 14);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  setTheme(theme: Theme): void {
    const u = this.skyMat.uniforms;
    (u.top.value as THREE.Color).setHex(theme.skyTop);
    (u.horizon.value as THREE.Color).setHex(theme.skyHorizon);
    (u.bottom.value as THREE.Color).setHex(theme.skyBottom);
    (u.sunColor.value as THREE.Color).setHex(theme.sun);
    u.stars.value = theme.night ? 1 : 0;
    this.scene.fog = new THREE.Fog(theme.fog, 70, 260);
    this.hemi.color.setHex(theme.night ? 0x9a86ff : 0xffffff);
    this.hemi.groundColor.setHex(theme.night ? 0x221144 : theme.skyHorizon);
    this.hemi.intensity = theme.night ? 1.1 : 1.35;
    this.sun.color.setHex(theme.night ? 0xc8b8ff : 0xfff3e0);
    this.sun.intensity = theme.night ? 1.2 : 2.1;
    this.cloudMat.color.setHex(theme.cloud);
    this.cloudMat.emissive.setHex(theme.night ? 0x1a0f40 : 0x334455);
    this.cloudMat.emissiveIntensity = theme.night ? 1 : 0.18;
    const seaMat = this.sea.material as THREE.MeshBasicMaterial;
    seaMat.color.setHex(theme.cloud);
    seaMat.opacity = theme.night ? 0.5 : 0.95;
  }

  /** Облака вдоль пути уровня. */
  populateClouds(path: [number, number, number][], seed: number, seaY: number): void {
    this.clouds.clear();
    const r = new Rng(seed);
    this.sea.position.y = seaY;
    const addCluster = (x: number, y: number, z: number, scale: number) => {
      const cl = new THREE.Group();
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(this.cloudGeo, this.cloudMat);
        const s = r.range(0.6, 1.2) * scale;
        m.scale.set(s * 1.3, s * 0.85, s);
        m.position.set((i - n / 2) * scale * 0.9 + r.range(-0.4, 0.4) * scale, r.range(-0.2, 0.4) * scale, r.range(-0.6, 0.6) * scale);
        cl.add(m);
      }
      cl.position.set(x, y, z);
      cl.userData.drift = r.range(0.2, 0.6);
      this.clouds.add(cl);
    };
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay, az] = path[i - 1];
      const [bx, , bz] = path[i];
      acc += Math.hypot(bx - ax, bz - az);
      if (acc < 22) continue;
      acc = 0;
      for (let k = 0; k < 2; k++) {
        const side = r.sign();
        addCluster(ax + side * r.range(22, 70), ay + r.range(-26, 6), az + r.range(-10, 10), r.range(2.5, 6));
      }
    }
    // дальний пояс
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const [cx, , cz] = path[Math.floor(path.length / 2)];
      addCluster(cx + Math.cos(a) * r.range(160, 230), r.range(-30, 25), cz + Math.sin(a) * r.range(160, 230), r.range(9, 16));
    }
  }

  update(target: THREE.Vector3, t: number, dt: number): void {
    this.sky.position.copy(target);
    this.skyMat.uniforms.time.value = t;
    this.sun.position.copy(target).addScaledVector(this.sunDir, 50);
    this.sun.target.position.copy(target);
    this.sea.position.x = target.x;
    this.sea.position.z = target.z;
    this.seaTex.offset.set((target.x / 100) + t * 0.004, (-target.z / 100) + t * 0.002);
    for (const c of this.clouds.children) c.position.x += c.userData.drift * dt;
  }
}
