// Sound effects synthesized with WebAudio, so the game needs no sound files.
// Tones make the musical sounds (fanfares, chimes); filtered noise makes whooshes, splashes and crackles.
// The flip warning chime stays clearly different from everything else (spec).

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // No audio available; the game works silently.
  }
}

/** One second of white noise, made once and reused. */
function noiseBuffer(a: AudioContext): AudioBuffer {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A quick fade in, then a fade out over `durS`. */
function envelope(a: AudioContext, t0: number, durS: number, volume: number): GainNode {
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durS);
  gain.connect(master!);
  return gain;
}

function tone(freq: number, startS: number, durS: number, type: OscillatorType, volume: number, endFreq = freq): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + startS;
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durS);
  osc.connect(envelope(a, t0, durS, volume));
  osc.start(t0);
  osc.stop(t0 + durS + 0.02);
}

/** Filtered noise; the filter sweeps from `fromHz` to `toHz`. */
function hiss(startS: number, durS: number, volume: number, fromHz: number, toHz: number, filter: BiquadFilterType = 'bandpass'): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + startS;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(fromHz, t0);
  f.frequency.exponentialRampToValueAtTime(toHz, t0 + durS);
  src.connect(f).connect(envelope(a, t0, durS, volume));
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + durS + 0.02);
}

/** A short melody: [frequency, start, duration] notes. */
function melody(notes: [number, number, number][], type: OscillatorType, volume: number): void {
  for (const [f, s, d] of notes) tone(f, s, d, type, volume);
}

// Note frequencies (Hz) for the tunes.
const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, C6: 1047 };

export const sfx = {
  /** Level start: a bright rising "let's go". */
  levelStart(): void {
    melody([[N.C5, 0, 0.12], [N.E5, 0.1, 0.12], [N.G5, 0.2, 0.25]], 'square', 0.06);
  },
  /** Reaching the crown: a little victory fanfare. */
  crown(): void {
    melody(
      [[N.C5, 0, 0.14], [N.E5, 0.14, 0.14], [N.G5, 0.28, 0.14], [N.C6, 0.42, 0.5]],
      'square',
      0.07,
    );
    melody([[N.C4, 0, 0.4], [N.G4, 0.42, 0.5]], 'triangle', 0.1);
  },
  /** One star appearing on the results panel; each star a step higher. */
  star(index: number): void {
    tone([N.E5, N.G5, N.C6][index] ?? N.C6, 0, 0.25, 'triangle', 0.12);
  },
  /** The hero loses a life: a sad falling tune. */
  death(): void {
    melody([[N.G4, 0, 0.18], [N.E4, 0.18, 0.18], [N.C4, 0.36, 0.45]], 'triangle', 0.14);
    tone(300, 0, 0.6, 'sawtooth', 0.03, 80);
  },
  /** Out of lives: a longer version. */
  gameOver(): void {
    melody([[N.A4, 0, 0.2], [N.G4, 0.2, 0.2], [N.E4, 0.4, 0.2], [N.C4, 0.6, 0.7]], 'triangle', 0.14);
  },
  checkpoint(): void {
    melody([[N.A5, 0, 0.12], [N.E5 * 2, 0.1, 0.3]], 'sine', 0.12);
  },
  /** A guardian's power is collected: a sparkly run up. */
  powerUp(): void {
    melody(
      [[N.C5, 0, 0.1], [N.E5, 0.07, 0.1], [N.G5, 0.14, 0.1], [N.C6, 0.21, 0.1], [N.E5 * 2, 0.28, 0.4]],
      'square',
      0.06,
    );
    hiss(0, 0.6, 0.05, 6000, 12000, 'highpass');
  },
  /** Flip warning: three bright bell notes going up. Kept unlike any other sound (spec). */
  warningChime(): void {
    tone(988, 0, 0.35, 'sine', 0.18);
    tone(1319, 0.14, 0.35, 'sine', 0.16);
    tone(1760, 0.28, 0.5, 'sine', 0.14);
  },
  /** The flip itself: a rising whoosh. */
  flip(): void {
    tone(220, 0, 0.35, 'triangle', 0.18, 880);
    hiss(0, 0.35, 0.06, 400, 3000);
  },
  jump(): void {
    tone(280, 0, 0.1, 'square', 0.035, 520);
  },
  doubleJump(): void {
    tone(420, 0, 0.12, 'square', 0.035, 900);
    hiss(0, 0.2, 0.04, 2000, 5000);
  },
  swing(): void {
    hiss(0, 0.09, 0.08, 3000, 900);
  },
  shoot(): void {
    tone(900, 0, 0.07, 'triangle', 0.07, 500);
  },
  fireball(): void {
    hiss(0, 0.25, 0.1, 900, 300, 'lowpass');
    tone(160, 0, 0.2, 'sawtooth', 0.04, 90);
  },
  /** Crates catching fire: a crackling burn. */
  crateBurn(): void {
    hiss(0, 0.7, 0.14, 1800, 500);
    for (let i = 0; i < 6; i++) hiss(0.05 + i * 0.09 + Math.random() * 0.04, 0.04, 0.12, 3000, 2500, 'highpass');
  },
  splash(): void {
    hiss(0, 0.4, 0.12, 1500, 300, 'lowpass');
  },
  /** Fire wall put out by water: a hiss of steam. */
  steam(): void {
    hiss(0, 0.6, 0.1, 5000, 2500, 'highpass');
  },
  /** Something frozen: a glassy shimmer. */
  freeze(): void {
    melody([[N.A5 * 2, 0, 0.15], [N.E5 * 2, 0.05, 0.2], [N.C6 * 2, 0.1, 0.3]], 'sine', 0.06);
  },
  /** A frozen enemy smashed by fire. */
  shatter(): void {
    hiss(0, 0.25, 0.14, 7000, 3000, 'highpass');
    tone(1200, 0, 0.2, 'triangle', 0.06, 400);
  },
  gust(): void {
    hiss(0, 0.45, 0.12, 300, 2500);
  },
  /** A seed pod sprouting into a leaf platform. */
  grow(): void {
    melody([[N.C5, 0, 0.08], [N.D5, 0.08, 0.08], [N.E5, 0.16, 0.08], [N.G5, 0.24, 0.2]], 'sine', 0.1);
  },
  hit(): void {
    tone(180, 0, 0.1, 'square', 0.08, 90);
  },
  /** An enemy defeated: a soft pop. */
  defeat(): void {
    tone(600, 0, 0.12, 'square', 0.06, 1200);
    hiss(0, 0.1, 0.05, 4000, 2000);
  },
  /** A guardian defeated: a big boom and a rising cheer. */
  guardianDefeat(): void {
    tone(120, 0, 0.6, 'sawtooth', 0.12, 40);
    hiss(0, 0.6, 0.12, 800, 150, 'lowpass');
    melody([[N.G4, 0.4, 0.15], [N.C5, 0.55, 0.15], [N.E5, 0.7, 0.15], [N.G5, 0.85, 0.4]], 'square', 0.06);
  },
  /** A pellet knocked back by the Knight's swing. */
  deflect(): void {
    tone(1500, 0, 0.08, 'square', 0.05, 2400);
  },
  hurt(): void {
    tone(300, 0, 0.2, 'sawtooth', 0.08, 120);
  },
  bounce(): void {
    tone(330, 0, 0.18, 'sine', 0.15, 990);
  },
  /** Menus: moving the cursor, and choosing. */
  menuMove(): void {
    tone(660, 0, 0.05, 'square', 0.04);
  },
  menuSelect(): void {
    melody([[N.E5, 0, 0.07], [N.A5, 0.06, 0.12]], 'square', 0.05);
  },
  /** Trying to pick a locked world. */
  locked(): void {
    tone(150, 0, 0.18, 'square', 0.06, 110);
  },
};
