// Весёлая музыка: секвенсор с барабанами, басом, арпеджио и мелодией. Всё синтезируется.
import { audio, noteFreq } from './engine';

interface Track {
  bpm: number;
  chords: string[][]; // аккорд на такт (ноты без октавы — октава добавляется)
  bass: string[]; // корень на такт, напр. 'C2'
  melody: string[]; // по строке на такт: 16 токенов (нота, '.', '-')
  kick: string;
  snare: string;
  hat: string;
  lead: OscillatorType;
  swing?: number;
  arpOct: number;
}

const TRACKS: Record<string, Track> = {
  menu: {
    bpm: 112,
    chords: [['C', 'E', 'G'], ['A', 'C', 'E'], ['F', 'A', 'C'], ['G', 'B', 'D']],
    bass: ['C2', 'A1', 'F1', 'G1'],
    melody: [
      'E5 . G5 . C6 . G5 . E5 . G5 . A5 . G5 .',
      'C5 . E5 . A5 . E5 . C5 . E5 . G5 - - .',
      'F5 . A5 . C6 . A5 . F5 . A5 . C6 . D6 .',
      'B5 . G5 . D5 . G5 . B5 - A5 - G5 - - .',
      'C6 - B5 . A5 . G5 . E5 - G5 . C6 - - .',
      'A5 - G5 . E5 . C5 . E5 - A5 . C6 - - .',
      'A5 . C6 . F6 - E6 . D6 . C6 . A5 . C6 .',
      'D6 - - . B5 . G5 . A5 . B5 . C6 - - .',
    ],
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    lead: 'square',
    swing: 0.08,
    arpOct: 4,
  },
  game: {
    bpm: 132,
    chords: [['G', 'B', 'D'], ['D', 'F#', 'A'], ['E', 'G', 'B'], ['C', 'E', 'G']],
    bass: ['G1', 'D2', 'E2', 'C2'],
    melody: [
      'G5 . B5 . D6 . B5 . G5 . A5 . B5 . D6 .',
      'F#5 . A5 . D6 . A5 . F#5 . A5 . D6 - - .',
      'E5 . G5 . B5 . G5 . E6 - D6 . B5 . G5 .',
      'C6 . B5 . A5 . G5 . E5 . G5 . A5 - - .',
      'D6 - B5 . D6 - B5 . G6 - - . F#6 . E6 .',
      'D6 - A5 . D6 - A5 . F#6 - - . E6 . D6 .',
      'E6 . D6 . B5 . G5 . B5 . D6 . E6 . G6 .',
      'E6 - D6 . C6 . A5 . B5 . A5 . G5 - - .',
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'x.x.x.x.x.x.x.x.',
    lead: 'square',
    arpOct: 4,
  },
  game2: {
    bpm: 140,
    chords: [['F', 'A', 'C'], ['C', 'E', 'G'], ['D', 'F', 'A'], ['A#', 'D', 'F']],
    bass: ['F1', 'C2', 'D2', 'A#1'],
    melody: [
      'C6 . A5 . C6 . F6 - - . E6 . C6 . A5 .',
      'G5 - - . C6 . E6 . G6 - E6 . C6 - - .',
      'D6 . F6 . A6 - F6 . D6 . A5 . D6 . F6 .',
      'F6 - D6 . A#5 - D6 . F6 - G6 . F6 - - .',
      'A5 . C6 . F6 . C6 . A5 . C6 . A6 - - .',
      'G6 - E6 . C6 - E6 . G6 . A6 . G6 - - .',
      'F6 . D6 . A5 . D6 . F6 . A6 . F6 . D6 .',
      'D6 . F6 . A#6 - - . A6 - G6 . F6 - - .',
    ],
    kick: 'x...x...x...x.x.',
    snare: '....x.......x...',
    hat: '..x.x.x...x.x.x.',
    lead: 'sawtooth',
    arpOct: 4,
  },
};

class Music {
  private track: Track | null = null;
  private name = '';
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private parsed: string[][] = [];

  play(name: keyof typeof TRACKS | string): void {
    if (this.name === name && this.track) return;
    this.name = name;
    this.track = TRACKS[name] ?? null;
    if (!this.track) return;
    this.parsed = this.track.melody.map((bar) => {
      const t = bar.trim().split(/\s+/);
      while (t.length < 16) t.push('.');
      return t.slice(0, 16);
    });
    this.step = 0;
    this.nextTime = audio.now + 0.1;
    if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    this.name = '';
    this.track = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
  }

  get current(): string {
    return this.name;
  }

  private schedule(): void {
    const tr = this.track;
    if (!tr || !audio.ctx) return;
    if (audio.ctx.state !== 'running') {
      this.nextTime = audio.now + 0.05;
      return;
    }
    const stepDur = 60 / tr.bpm / 4;
    if (this.nextTime < audio.now - 0.2) this.nextTime = audio.now + 0.05;
    while (this.nextTime < audio.now + 0.12) {
      this.playStep(tr, this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % (16 * this.parsed.length);
      const swing = tr.swing && this.step % 2 === 1 ? stepDur * tr.swing : tr.swing && this.step % 2 === 0 ? -stepDur * tr.swing : 0;
      this.nextTime += stepDur + swing;
    }
  }

  private playStep(tr: Track, step: number, t: number, sd: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chordIdx = bar % tr.chords.length;
    // Барабаны
    if (tr.kick[s] === 'x') {
      audio.tone(150, 0.12, t, { type: 'sine', vol: 0.55, slideTo: 40, release: 0.08, bus: 'music' });
    }
    if (tr.snare[s] === 'x') {
      audio.noise(0.14, t, { vol: 0.22, filter: 3500, type: 'bandpass', q: 0.7, bus: 'music' });
      audio.tone(220, 0.06, t, { type: 'triangle', vol: 0.12, slideTo: 120, bus: 'music' });
    }
    if (tr.hat[s] === 'x') audio.noise(0.04, t, { vol: 0.07, filter: 8000, type: 'highpass', bus: 'music' });

    // Бас: корень и октава
    if (s % 2 === 0) {
      const root = tr.bass[chordIdx];
      const f = noteFreq(root) * (s % 4 === 2 ? 2 : 1);
      audio.pluck(f, sd * 1.8, t, { type: 'square', vol: 0.16, filter: 900, bus: 'music' });
    }
    // Арпеджио
    if (s % 2 === 1 || bar % 2 === 1) {
      const ch = tr.chords[chordIdx];
      const n = ch[(s >> 1) % ch.length] + (tr.arpOct + (s >= 8 && bar % 2 ? 1 : 0));
      audio.pluck(noteFreq(n), sd * 1.5, t, { type: 'triangle', vol: 0.07, bus: 'music' });
    }
    // Мелодия
    const tokens = this.parsed[bar % this.parsed.length];
    const tok = tokens[s];
    if (tok !== '.' && tok !== '-') {
      let len = 1;
      while (s + len < 16 && tokens[s + len] === '-') len++;
      const f = noteFreq(tok);
      audio.tone(f, sd * len * 0.9, t, { type: tr.lead, vol: 0.075, attack: 0.01, release: 0.06, filter: 3200, vibrato: len > 2 ? 0.006 : 0, bus: 'music' });
      audio.tone(f * 2, sd * len * 0.6, t, { type: 'sine', vol: 0.025, release: 0.05, bus: 'music' });
    }
  }
}

export const music = new Music();
