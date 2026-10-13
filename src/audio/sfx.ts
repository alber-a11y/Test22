// Звуковые эффекты — синтез на лету.
import { audio, noteFreq } from './engine';

let coinCombo = 0;
let coinComboT = 0;

export const sfx = {
  click() {
    audio.tone(880, 0.05, 0, { type: 'square', vol: 0.12, slideTo: 1320 });
  },
  back() {
    audio.tone(660, 0.06, 0, { type: 'square', vol: 0.1, slideTo: 440 });
  },
  jump() {
    audio.tone(300, 0.16, 0, { type: 'square', vol: 0.13, slideTo: 720, filter: 2500 });
    audio.noise(0.08, 0, { vol: 0.06, filter: 1500 });
  },
  land(impact: number) {
    const v = Math.min(0.35, 0.08 + impact * 0.015);
    audio.tone(110, 0.1, 0, { type: 'sine', vol: v, slideTo: 50 });
    audio.noise(0.09, 0, { vol: v * 0.6, filter: 800 });
  },
  coin() {
    const now = performance.now() / 1000;
    coinCombo = now - coinComboT < 0.6 ? Math.min(coinCombo + 1, 12) : 0;
    coinComboT = now;
    const base = 988 * Math.pow(2, coinCombo / 24);
    const t = audio.now;
    audio.tone(base, 0.06, t, { type: 'square', vol: 0.09 });
    audio.tone(base * 1.335, 0.14, t + 0.06, { type: 'square', vol: 0.09, release: 0.08 });
  },
  boost() {
    audio.tone(200, 0.45, 0, { type: 'sawtooth', vol: 0.1, slideTo: 900, filter: 2200 });
    audio.noise(0.4, 0, { vol: 0.12, filter: 600, sweepTo: 5000, type: 'bandpass', q: 1.5 });
  },
  bounce() {
    audio.tone(180, 0.35, 0, { type: 'sine', vol: 0.3, slideTo: 700, vibrato: 0.03 });
    audio.tone(360, 0.3, 0, { type: 'triangle', vol: 0.1, slideTo: 1200 });
  },
  barrier() {
    audio.noise(0.2, 0, { vol: 0.3, filter: 1200 });
    audio.tone(160, 0.2, 0, { type: 'square', vol: 0.15, slideTo: 60, filter: 900 });
  },
  fall() {
    audio.tone(900, 0.8, 0, { type: 'triangle', vol: 0.16, slideTo: 120, vibrato: 0.02 });
  },
  checkpoint() {
    const t = audio.now;
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => audio.tone(noteFreq(n), 0.1, t + i * 0.07, { type: 'square', vol: 0.09 }));
  },
  vanish() {
    audio.noise(0.3, 0, { vol: 0.12, filter: 3000, sweepTo: 300, type: 'bandpass' });
  },
  nitro() {
    audio.noise(0.5, 0, { vol: 0.15, filter: 400, sweepTo: 3000, type: 'bandpass', q: 2 });
  },
  buy() {
    const t = audio.now;
    ['E6', 'G6', 'C7', 'E7'].forEach((n, i) => audio.tone(noteFreq(n), 0.12, t + i * 0.06, { type: 'square', vol: 0.08 }));
    audio.noise(0.4, t + 0.2, { vol: 0.05, filter: 9000, type: 'highpass' });
  },
  error() {
    audio.tone(200, 0.12, 0, { type: 'square', vol: 0.12 });
    audio.tone(150, 0.18, audio.now + 0.12, { type: 'square', vol: 0.12 });
  },
  win() {
    const t = audio.now;
    const seq = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
    seq.forEach((n, i) => audio.tone(noteFreq(n), 0.12, t + i * 0.08, { type: 'square', vol: 0.1 }));
    for (const n of ['C6', 'E6', 'G6', 'C7']) audio.tone(noteFreq(n), 0.7, t + 0.55, { type: 'square', vol: 0.06, vibrato: 0.01, release: 0.3, filter: 4000 });
    audio.noise(0.6, t + 0.55, { vol: 0.06, filter: 8000, type: 'highpass' });
  },
  gameOver() {
    const t = audio.now;
    ['G4', 'F#4', 'F4'].forEach((n, i) => audio.tone(noteFreq(n), 0.28, t + i * 0.3, { type: 'square', vol: 0.12, filter: 2000 }));
    audio.tone(noteFreq('E4'), 0.9, t + 0.9, { type: 'square', vol: 0.12, slideTo: noteFreq('C4'), vibrato: 0.02, filter: 2000 });
  },
  star(i: number) {
    audio.tone(noteFreq(['E6', 'G6', 'C7'][i] ?? 'C7'), 0.18, 0, { type: 'square', vol: 0.1 });
    audio.noise(0.2, 0, { vol: 0.04, filter: 9000, type: 'highpass' });
  },
  countdown(go: boolean) {
    audio.tone(go ? 1046 : 523, go ? 0.3 : 0.12, 0, { type: 'square', vol: 0.12 });
  },
  tick() {
    audio.tone(1500, 0.02, 0, { type: 'square', vol: 0.05 });
  },
  reward() {
    const t = audio.now;
    ['C6', 'G6', 'E6', 'C7'].forEach((n, i) => audio.tone(noteFreq(n), 0.15, t + i * 0.07, { type: 'triangle', vol: 0.14 }));
  },
};

/** Гул мотора (для мото-транспорта) и шорох колёс. */
export class EngineSound {
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  start(motor: boolean): void {
    this.stop();
    const ctx = audio.ctx;
    if (!ctx) return;
    this.osc = ctx.createOscillator();
    this.osc.type = motor ? 'sawtooth' : 'triangle';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = motor ? 500 : 300;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc.connect(this.filter);
    if (motor) this.osc2.connect(this.filter);
    this.filter.connect(this.gain).connect(audio.sfx);
    this.osc.start();
    this.osc2.start();
    this.motor = motor;
  }
  private motor = false;

  update(speed: number, gas: boolean, active: boolean): void {
    if (!this.osc || !this.gain || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const k = Math.min(1, speed / 18);
    if (this.motor) {
      this.osc.frequency.setTargetAtTime(45 + k * 110 + (gas ? 12 : 0), t, 0.08);
      this.osc2?.frequency.setTargetAtTime(22 + k * 55, t, 0.08);
      this.gain.gain.setTargetAtTime(active ? 0.05 + k * 0.05 : 0, t, 0.1);
    } else {
      this.osc.frequency.setTargetAtTime(60 + k * 60, t, 0.1);
      this.osc2?.frequency.setTargetAtTime(0, t, 0.1);
      this.gain.gain.setTargetAtTime(active && speed > 1 ? 0.012 + k * 0.02 : 0, t, 0.1);
    }
  }

  stop(): void {
    try {
      this.osc?.stop();
      this.osc2?.stop();
    } catch {
      /* already stopped */
    }
    this.gain?.disconnect();
    this.osc = this.osc2 = null;
    this.gain = null;
  }
}
