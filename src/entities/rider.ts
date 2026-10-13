// Персонаж + транспорт: сборка, позы и анимации (педали, наклон, приземление).
import * as THREE from 'three';
import type { CharacterDef, PaintDef, VehicleDef } from '../economy/catalog';
import { Character } from './character';
import { buildVehicle, type VehicleModel } from './vehicles';
import { GEO, glow, mesh } from './materials';

const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();

export class Rider {
  root = new THREE.Group(); // позиция/курс — от физики
  tilt = new THREE.Group(); // наклон/тангаж/сжатие
  vehicle: VehicleModel;
  character: Character;
  private wheelAngle = 0;
  private crankAngle = 0;
  private squash = 0;
  private lean = 0;
  private pitch = 0;
  private steerVis = 0;
  private time = 0;
  private rainbow: boolean;
  shield: THREE.Mesh;

  constructor(public vdef: VehicleDef, public cdef: CharacterDef, paint: PaintDef) {
    this.root.add(this.tilt);
    this.vehicle = buildVehicle(vdef);
    this.tilt.add(this.vehicle.group);
    this.character = new Character(cdef);
    this.vehicle.body.add(this.character.root);
    this.character.root.position.copy(this.vehicle.seat);
    if (paint.color >= 0) this.vehicle.paint.color.setHex(paint.color);
    this.rainbow = !!paint.rainbow;

    this.shield = mesh(GEO.sphere, glow(0x7fe3ff, 0.28), 1.25, 1.25, 1.25, 0, 0.95, 0);
    this.shield.castShadow = false;
    this.shield.visible = false;
    this.root.add(this.shield);

    this.applyPose(0);
  }

  /** Поза персонажа под тип транспорта. */
  private applyPose(crank: number): void {
    const v = this.vehicle;
    const c = this.character;
    c.hips.rotation.x = 0;
    c.torso.rotation.x = -v.lean;
    const pose = this.vdef.pose;
    const seat = v.seat;
    if (pose === 'pedal') {
      for (const [i, leg] of [c.legL, c.legR].entries()) {
        const a = crank + (i === 0 ? 0 : Math.PI);
        const fy = v.crankPos.y + Math.sin(a) * v.crankR;
        const fz = v.crankPos.z - Math.cos(a) * v.crankR;
        this.character.setLeg(leg, -(fz - seat.z), seat.y - fy);
      }
    } else {
      for (const [i, leg] of [c.legL, c.legR].entries()) {
        const f = v.feet[i];
        const splay = pose === 'sit' || pose === 'kart' ? (i === 0 ? -1 : 1) * 0.15 : 0;
        this.character.setLeg(leg, -(f.z - seat.z), seat.y - f.y, splay);
      }
    }
    // Руки к рулю
    c.torso.updateWorldMatrix(true, true);
    for (const [i, arm] of [c.armL, c.armR].entries()) {
      tmpW.copy(v.hands[i]);
      v.body.localToWorld(tmpW);
      c.torso.worldToLocal(tmpW);
      c.pointArm(arm, tmpW);
    }
  }

  setShield(on: boolean): void {
    this.shield.visible = on;
  }

  /** Анимация: speed — скорость вперёд, steer -1..1, grounded, vy — вертикальная скорость. */
  update(dt: number, speed: number, steer: number, grounded: boolean, vy: number, pedaling: boolean): void {
    this.time += dt;
    const v = this.vehicle;
    this.wheelAngle -= (speed * dt) / 0.35;
    for (const w of v.wheels) w.obj.rotation.x = (this.wheelAngle * 0.35) / w.r;
    if (pedaling || speed > 0.5) this.crankAngle += dt * (pedaling ? 7 + speed * 0.4 : speed * 0.6);
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 10);
    if (v.steer) v.steer.rotation.y = -this.steerVis * 0.35;

    const targetLean = -this.steerVis * Math.min(1, Math.abs(speed) / 8) * 0.28;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 8);
    const targetPitch = grounded ? 0 : Math.max(-0.35, Math.min(0.35, vy * 0.03));
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 6);
    this.squash *= Math.exp(-dt * 9);
    this.tilt.rotation.set(this.pitch, 0, this.lean);
    const sq = this.squash;
    this.tilt.scale.set(1 + sq * 0.12, 1 - sq * 0.18, 1 + sq * 0.12);
    this.tilt.position.y = v.hover ? v.hover + Math.sin(this.time * 4) * 0.05 : 0;

    if (this.vdef.pose === 'pedal') this.applyPose(this.crankAngle);
    else {
      // лёгкое покачивание
      this.character.root.position.y = v.seat.y + Math.sin(this.time * 9) * 0.015 * Math.min(1, speed / 6) - sq * 0.08;
      if (this.time < 0.1 || sq > 0.01) this.applyPose(0);
    }
    this.character.update(dt, this.time, speed);
    if (this.rainbow) v.paint.color.setHSL((this.time * 0.25) % 1, 0.85, 0.55);
    for (const g of v.glowMats) {
      const k = 0.85 + Math.sin(this.time * 18) * 0.15;
      g.opacity = v.fireWheels ? 1 : 0.6 + 0.25 * k;
    }
    if (this.shield.visible) {
      this.shield.rotation.y += dt;
      const s = 1.25 + Math.sin(this.time * 5) * 0.04;
      this.shield.scale.set(s, s, s);
    }
  }

  landed(impact: number): void {
    this.squash = Math.min(1, impact / 14);
  }

  /** Мировые точки, откуда идёт след (колёса/выхлоп). */
  trailPoints(out: THREE.Vector3[]): number {
    const v = this.vehicle;
    let n = 0;
    if (v.exhaust.length && (this.vdef.id === 'rocket' || this.vdef.id === 'hover')) {
      for (const e of v.exhaust) out[n++].copy(e).applyMatrix4(v.body.matrixWorld);
      return n;
    }
    for (const w of v.wheels) {
      w.obj.getWorldPosition(tmpV);
      tmpV.y -= w.r * 0.85;
      out[n++].copy(tmpV);
      if (n >= out.length) break;
    }
    return n;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.vehicle.paint.dispose();
  }
}
