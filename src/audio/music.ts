// Background music: a short looping tune per world, synthesized like the sound effects (no files).
// A tiny step sequencer schedules notes a moment ahead on the audio clock, so timing stays steady.
import { audioOut } from './sfx';

export type Tune = 'menu' | 'meadow' | 'lake' | 'mountain' | 'sky' | 'castle' | 'ending';

interface Song {
  bpm: number;
  /** One entry per eighth note: a MIDI note number, or null for a rest. */
  melody: (number | null)[];
  /** One entry per quarter note. */
  bass: (number | null)[];
  wave: OscillatorType;
  /** Optional: one chord per bar (8 eighth notes), played as a soft rising arpeggio. */
  chords?: number[][];
  /** Optional: a drum pattern per bar, one letter per eighth note: k kick, s snare, h hi-hat, x kick + hat. */
  drums?: string;
  /** Echo on the melody, for a fuller sound. */
  echo?: boolean;
}

const _ = null;
const SONGS: Record<Tune, Song> = {
  // The main menu and world map: a bright, bouncy 8-bar theme over C - Am - F - G, twice through
  // with a rising second half that resolves home.
  menu: {
    bpm: 126,
    melody: [
      72, _, 76, 79, 84, _, 83, 79, // C
      81, _, 79, 76, 72, _, 74, 76, // Am
      77, _, 76, 74, 72, _, 69, 72, // F
      74, _, _, 71, 67, _, _, _, //    G
      72, _, 76, 79, 84, _, 86, 84, // C
      81, _, 84, 81, 79, _, 76, 79, // Am
      77, 79, 81, _, 79, 77, 76, 74, // F
      72, _, 74, _, 71, _, 72, _, //   G, back home to C
    ],
    bass: [48, 60, 48, 55, 45, 57, 45, 52, 41, 53, 41, 48, 43, 55, 43, 50, 48, 60, 48, 55, 45, 57, 45, 52, 41, 53, 41, 48, 43, 55, 47, 50],
    chords: [
      [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
      [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
    ],
    drums: 'xhshkhsh',
    wave: 'square',
    echo: true,
  },
  meadow: {
    bpm: 120,
    melody: [67, _, 72, 74, 76, _, 74, 72, 69, _, 72, _, 74, _, _, _, 67, _, 72, 74, 76, _, 79, 76, 74, _, 72, _, 72, _, _, _],
    bass: [48, 55, 45, 52, 41, 48, 43, 55],
    wave: 'square',
  },
  lake: {
    bpm: 100,
    melody: [69, _, 72, _, 76, _, 74, 72, 71, _, 67, _, 69, _, _, _, 69, _, 72, _, 77, _, 76, 74, 72, _, 71, _, 69, _, _, _],
    bass: [45, 52, 41, 48, 43, 50, 40, 47],
    wave: 'triangle',
  },
  mountain: {
    bpm: 96,
    melody: [74, _, _, 76, 77, _, 76, _, 74, _, 72, _, 69, _, _, _, 74, _, _, 77, 79, _, 77, _, 76, _, 74, _, 74, _, _, _],
    bass: [50, 57, 46, 53, 48, 55, 45, 52],
    wave: 'triangle',
  },
  sky: {
    bpm: 132,
    melody: [76, 79, 84, _, 83, _, 79, _, 81, 79, 76, _, 74, _, _, _, 76, 79, 84, _, 86, _, 84, _, 83, 81, 79, _, 79, _, _, _],
    bass: [52, 59, 48, 55, 50, 57, 55, 59],
    wave: 'square',
  },
  castle: {
    bpm: 140,
    melody: [69, _, 69, 72, 71, _, 69, _, 68, _, 69, 71, 64, _, _, _, 69, _, 69, 72, 74, _, 72, _, 71, _, 68, _, 69, _, _, _],
    bass: [45, 45, 44, 44, 45, 45, 40, 40],
    wave: 'sawtooth',
  },
  ending: {
    bpm: 108,
    melody: [72, _, 76, _, 79, _, 84, _, 83, _, 79, _, 81, _, _, _, 77, _, 81, _, 84, _, 81, _, 79, _, 76, _, 72, _, _, _],
    bass: [48, 55, 53, 55, 50, 57, 55, 48],
    wave: 'square',
  },
};

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Arpeggio order through a chord's three notes, one per eighth note. */
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];

class MusicPlayer {
  private current: Tune | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bus: GainNode | null = null;
  /** Where the melody goes: straight to the bus, or through the echo first. */
  private melodyIn: AudioNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Starts a tune (keeps playing if it's already the one playing). */
  play(tune: Tune): void {
    if (tune === this.current) return;
    this.stop();
    const out = audioOut();
    if (!out) return;
    this.current = tune;
    this.bus = out.ctx.createGain();
    this.bus.gain.value = 0.32; // music sits under the sound effects
    this.bus.connect(out.master);
    this.melodyIn = SONGS[tune].echo ? this.makeEcho(out.ctx, this.bus) : this.bus;
    this.step = 0;
    this.nextTime = out.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.bus) {
      const bus = this.bus;
      const out = audioOut();
      if (out) bus.gain.setTargetAtTime(0, out.ctx.currentTime, 0.05);
      window.setTimeout(() => bus.disconnect(), 300);
    }
    this.bus = null;
    this.melodyIn = null;
    this.current = null;
  }

  /** A short echo: the melody, plus a quieter copy a dotted eighth later that fades away. */
  private makeEcho(ctx: AudioContext, bus: GainNode): AudioNode {
    const input = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = 0.28;
    feedback.gain.value = 0.3;
    wet.gain.value = 0.35;
    input.connect(bus);
    input.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(bus);
    return input;
  }

  /** Schedules every eighth note that starts in the next 150 ms. */
  private schedule(): void {
    const out = audioOut();
    if (!out || !this.current || !this.bus) return;
    const song = SONGS[this.current];
    const eighth = 60 / song.bpm / 2;
    // After a long pause (a hidden tab), skip ahead instead of playing a burst of old notes.
    if (this.nextTime < out.ctx.currentTime - 0.5) this.nextTime = out.ctx.currentTime + 0.05;
    while (this.nextTime < out.ctx.currentTime + 0.15) {
      const m = song.melody[this.step % song.melody.length];
      if (m !== null) this.note(out.ctx, freq(m), this.nextTime, eighth * 0.9, song.wave, 0.08, this.melodyIn!);
      if (this.step % 2 === 0) {
        const b = song.bass[(this.step / 2) % song.bass.length];
        if (b !== null) this.note(out.ctx, freq(b), this.nextTime, eighth * 1.8, 'triangle', 0.16);
      }
      if (song.chords) {
        const chord = song.chords[Math.floor(this.step / 8) % song.chords.length];
        const n = chord[ARP[this.step % 8] % chord.length] + 12;
        this.note(out.ctx, freq(n), this.nextTime, eighth * 0.6, 'square', 0.025);
      }
      if (song.drums) this.drum(out.ctx, song.drums[this.step % song.drums.length], this.nextTime);
      this.step++;
      this.nextTime += eighth;
    }
  }

  /** k kick, s snare, h hi-hat, x kick and hat together. */
  private drum(ctx: AudioContext, hit: string, t: number): void {
    if (hit === 'k' || hit === 'x') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain).connect(this.bus!);
      osc.start(t);
      osc.stop(t + 0.16);
    }
    if (hit === 's') this.noiseHit(ctx, t, 0.12, 0.16, 'bandpass', 1800);
    if (hit === 'h' || hit === 'x') this.noiseHit(ctx, t, 0.03, 0.05, 'highpass', 8000);
  }

  private noiseHit(ctx: AudioContext, t: number, dur: number, vol: number, type: BiquadFilterType, hz: number): void {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.bus!);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  private note(ctx: AudioContext, f: number, t: number, dur: number, type: OscillatorType, vol: number, to?: AudioNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(to ?? this.bus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const music = new MusicPlayer();
