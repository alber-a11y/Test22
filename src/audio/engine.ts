// Аудио-движок на Web Audio API: шины громкости, синтез тонов и шума, пауза при рекламе.

export interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
  filter?: number;
  filterQ?: number;
  detune?: number;
  vibrato?: number;
  bus?: 'music' | 'sfx';
}

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteFreq(note: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!m) return 0;
  const n = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private suspendReasons = new Set<string>();
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private duck = 1;
  onReady: (() => void) | null = null;

  /** Создаёт/возобновляет контекст. Вызывать из обработчика жеста пользователя. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.onReady?.();
    }
    if (this.ctx.state === 'suspended' && this.suspendReasons.size === 0) this.ctx.resume().catch(() => {});
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  /** Приглушение музыки (пауза, экраны). */
  setDuck(k: number): void {
    this.duck = k;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.5 * this.duck, t, 0.08);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.8, t, 0.02);
  }

  /** Полная остановка звука (реклама, скрытая вкладка). */
  suspend(reason: string): void {
    this.suspendReasons.add(reason);
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume(reason: string): void {
    this.suspendReasons.delete(reason);
    if (this.ctx && this.suspendReasons.size === 0 && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(freq: number, dur: number, when = 0, o: ToneOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || freq <= 0) return;
    const t0 = Math.max(when || ctx.currentTime, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    let lfo: OscillatorNode | null = null;
    if (o.vibrato) {
      lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = freq * o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0 + 0.08);
      lfo.stop(t0 + dur + (o.release ?? 0.05) + 0.05);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const a = o.attack ?? 0.005;
    const r = o.release ?? 0.05;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.setValueAtTime(vol, t0 + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + r);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      f.Q.value = o.filterQ ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.bus === 'music' ? this.music : this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + r + 0.02);
  }

  /** Плакированная нота с затуханием (для арпеджио/баса). */
  pluck(freq: number, dur: number, when: number, o: ToneOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || freq <= 0) return;
    const t0 = Math.max(when, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'triangle';
    osc.frequency.value = freq;
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.filterQ ?? 2;
      f.frequency.setValueAtTime(o.filter, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, o.filter * 0.25), t0 + dur);
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.bus === 'sfx' ? this.sfx : this.music);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur: number, when = 0, o: { vol?: number; filter?: number; type?: BiquadFilterType; q?: number; sweepTo?: number; bus?: 'music' | 'sfx'; attack?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = Math.max(when || ctx.currentTime, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.filter ?? 2000, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.bus === 'music' ? this.music : this.sfx);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }
}

export const audio = new AudioEngine();
