// Рендерер, сцена, камера, окружение, частицы и «витрина» персонажа для меню/магазина.
import * as THREE from 'three';
import { save } from '../core/save';
import { input } from '../core/input';
import { Environment } from '../render/environment';
import { Particles } from '../render/particles';
import { Rider } from '../entities/rider';
import { characterById, paintById, vehicleById, type CharacterDef, type PaintDef, type VehicleDef } from '../economy/catalog';
import { checkerTexture } from '../render/textures';
import { THEMES, type Theme } from '../world/themes';
import { GEO, mesh, toon } from '../entities/materials';
import { buildVehicle } from '../entities/vehicles';
import { Character } from '../entities/character';

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  env: Environment;
  particles: Particles;
  shadows: boolean;
  width = 1;
  height = 1;
  private pixelRatio = 1;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private lowered = false;

  // витрина
  showcase = new THREE.Group();
  private podium: THREE.Group;
  showRider: Rider | null = null;
  private focusX = 0.5;
  private focusY = 0.5;
  private showTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    const q = save.settings.quality;
    const mobile = input.isTouch && Math.min(screen.width, screen.height) < 900;
    this.shadows = q === 'high' || (q === 'auto' && true);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.shadows && q !== 'low';
    this.shadows = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, mobile ? 1.5 : 1.75);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
    this.env = new Environment(this.scene, this.shadows);
    if (this.shadows && mobile) this.env.sun.shadow.mapSize.set(1024, 1024);
    this.particles = new Particles(1600);
    this.scene.add(this.particles.points);

    // Подиум витрины
    this.podium = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 40), [
      new THREE.MeshLambertMaterial({ color: THEMES[0].side }),
      new THREE.MeshLambertMaterial({ map: checkerTexture(THEMES[0].tileA, THEMES[0].tileB) }),
      new THREE.MeshLambertMaterial({ color: THEMES[0].sideDark }),
    ]);
    top.position.y = -0.25;
    top.receiveShadow = true;
    this.podium.add(top);
    const rim = mesh(GEO.torus, toon(0xffd54f), 2.2, 2.2, 1.2, 0, 0, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(2.22, 2.22, 0.5);
    this.podium.add(rim);
    this.showcase.add(this.podium);
    this.scene.add(this.showcase);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.particles.setViewportHeight(h * this.pixelRatio);
  }

  private applyViewOffset(): void {
    const w = this.width, h = this.height;
    if (this.showcase.visible && (this.focusX !== 0.5 || this.focusY !== 0.5)) {
      this.camera.setViewOffset(w, h, (0.5 - this.focusX) * w, (0.5 - this.focusY) * h, w, h);
    } else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Автоподстройка качества по FPS. */
  trackFps(dt: number): void {
    if (save.settings.quality !== 'auto' || this.lowered) return;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 4) {
      const fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (fps < 40 && this.pixelRatio > 1) {
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.5);
        this.resize();
      } else if (fps < 32 && this.renderer.shadowMap.enabled) {
        this.lowered = true;
        this.env.sun.castShadow = false;
      }
    }
  }

  setTheme(theme: Theme): void {
    this.env.setTheme(theme);
  }

  // ------------------------------------------------------------ витрина

  showShowcase(on: boolean): void {
    this.showcase.visible = on;
    if (on) {
      this.setTheme(THEMES[0]);
      this.env.populateClouds(
        Array.from({ length: 12 }, (_, i) => [0, 0, 30 - i * 10] as [number, number, number]),
        7,
        -30,
      );
      this.particles.clear();
    }
    this.applyViewOffset();
  }

  setShowcaseFocus(x: number, y = 0.5): void {
    this.focusX = x;
    this.focusY = y;
    this.applyViewOffset();
  }

  setShowcaseRider(v?: VehicleDef, c?: CharacterDef, p?: PaintDef): void {
    const vd = v ?? vehicleById(save.vehicle);
    const cd = c ?? characterById(save.character);
    const pd = p ?? paintById(save.paint);
    if (this.showRider && this.showRider.vdef === vd && this.showRider.cdef === cd && this.showRider.vehicle.paint.userData.paint === pd.id) return;
    this.showRider?.dispose();
    this.showRider = new Rider(vd, cd, pd);
    this.showRider.vehicle.paint.userData.paint = pd.id;
    this.showRider.root.rotation.y = this.showTime ? (this.showcase.userData.rot ?? 0.6) : 0.6;
    this.podium.add(this.showRider.root);
  }

  updateShowcase(dt: number): void {
    this.showTime += dt;
    const rot = (this.showcase.userData.rot = ((this.showcase.userData.rot as number) ?? 0.6) + dt * 0.45);
    if (this.showRider) {
      this.showRider.root.rotation.y = rot;
      this.showRider.update(dt, 2.5, Math.sin(this.showTime * 0.8) * 0.4, true, 0, true);
    }
    const target = new THREE.Vector3(0, 0.9, 0);
    this.camera.fov = this.camera.aspect < 1 ? 62 : 45;
    this.camera.position.set(0, 2.1, this.camera.aspect < 1 ? 7.4 : 5.6);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.env.update(target, this.showTime, dt);
    this.particles.update(dt);
    if (Math.random() < dt * 6) {
      const a = Math.random() * Math.PI * 2;
      this.particles.emit({ x: Math.cos(a) * 2.1, y: 0.1, z: Math.sin(a) * 2.1, vy: 1.2, color: 0xffe082, shape: 3, size: 0.25, life: 1.2, drag: 0.5 });
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------ миниатюры для магазина

  private thumbScene: THREE.Scene | null = null;
  private thumbCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private thumbRT: THREE.WebGLRenderTarget | null = null;
  private thumbCache = new Map<string, string>();

  private renderThumb(key: string, obj: THREE.Object3D, cam: THREE.Vector3, look: THREE.Vector3): string {
    const got = this.thumbCache.get(key);
    if (got) return got;
    const S = 160;
    if (!this.thumbScene) {
      this.thumbScene = new THREE.Scene();
      this.thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 2.2));
      const d = new THREE.DirectionalLight(0xffffff, 2.2);
      d.position.set(-2, 4, -3);
      this.thumbScene.add(d);
      this.thumbRT = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
      this.thumbRT.texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.thumbScene.add(obj);
    this.thumbCam.position.copy(cam);
    this.thumbCam.lookAt(look);
    const r = this.renderer;
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.thumbRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.thumbScene, this.thumbCam);
    const px = new Uint8Array(S * S * 4);
    r.readRenderTargetPixels(this.thumbRT!, 0, 0, S, S, px);
    r.setRenderTarget(null);
    r.setClearColor(prevClear, prevAlpha);
    this.thumbScene.remove(obj);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    g.putImageData(img, 0, 0);
    const url = c.toDataURL();
    this.thumbCache.set(key, url);
    return url;
  }

  vehicleThumb(v: VehicleDef): string {
    if (this.thumbCache.has('v' + v.id)) return this.thumbCache.get('v' + v.id)!;
    const m = buildVehicle(v);
    m.group.position.y = m.hover;
    return this.renderThumb('v' + v.id, m.group, new THREE.Vector3(2.3, 1.5, -1.9), new THREE.Vector3(0, 0.5, 0));
  }

  characterThumb(c: CharacterDef): string {
    if (this.thumbCache.has('c' + c.id)) return this.thumbCache.get('c' + c.id)!;
    const ch = new Character(c);
    ch.armL.rotation.z = -0.3;
    ch.armR.rotation.z = 0.3;
    return this.renderThumb('c' + c.id, ch.root, new THREE.Vector3(0.9, 0.95, -2.3), new THREE.Vector3(0, 0.5, 0));
  }
}
