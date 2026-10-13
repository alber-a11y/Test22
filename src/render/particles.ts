// Единая система частиц: один draw call на все эффекты (пыль, искры, звёзды, сердечки, конфетти).
import * as THREE from 'three';
import { particleAtlas } from './textures';

export const enum Shape {
  Circle = 0,
  Star = 1,
  Heart = 2,
  Spark = 3,
}

const vert = /* glsl */ `
attribute float size; attribute float alpha; attribute float shape; attribute vec3 color;
varying float vAlpha; varying float vShape; varying vec3 vColor;
uniform float scale;
void main() {
  vAlpha = alpha; vShape = shape; vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform sampler2D atlas;
varying float vAlpha; varying float vShape; varying vec3 vColor;
void main() {
  vec2 uv = vec2((gl_PointCoord.x + vShape) / 4.0, 1.0 - gl_PointCoord.y);
  vec4 t = texture2D(atlas, uv);
  if (t.a * vAlpha < 0.02) discard;
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  #include <colorspace_fragment>
}`;

export interface EmitOpts {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  spread?: number;
  life?: number;
  size?: number;
  color: THREE.Color | number;
  shape?: Shape;
  gravity?: number;
  drag?: number;
  grow?: number;
  count?: number;
}

export class Particles {
  readonly max: number;
  points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private size0: Float32Array;
  private alpha: Float32Array;
  private shape: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private grow: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private tmp = new THREE.Color();

  constructor(max = 1500) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.life = new Float32Array(max);
    this.life0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: { atlas: { value: particleAtlas() }, scale: { value: 400 } },
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setViewportHeight(h: number): void {
    this.mat.uniforms.scale.value = h * 0.9;
  }

  emit(o: EmitOpts): void {
    const n = o.count ?? 1;
    const c = typeof o.color === 'number' ? this.tmp.setHex(o.color) : o.color;
    const sp = o.spread ?? 0;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * sp * 0.3;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * sp * 0.3;
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * sp * 0.3;
      this.vel[i * 3] = (o.vx ?? 0) + (Math.random() - 0.5) * sp;
      this.vel[i * 3 + 1] = (o.vy ?? 0) + (Math.random() - 0.5) * sp;
      this.vel[i * 3 + 2] = (o.vz ?? 0) + (Math.random() - 0.5) * sp;
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      const life = (o.life ?? 0.8) * (0.75 + Math.random() * 0.5);
      this.life[i] = life;
      this.life0[i] = life;
      this.size0[i] = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      this.size[i] = this.size0[i];
      this.alpha[i] = 1;
      this.shape[i] = o.shape ?? Shape.Circle;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.grow[i] = o.grow ?? 0;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.life0[i]);
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - t));
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.size.needsUpdate = true;
    a.alpha.needsUpdate = true;
    a.shape.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
  }
}
