// Placeholder sound effects synthesized with WebAudio, so no sound files are needed yet.
// Milestone 5 replaces these with jsfxr sounds and music. The warning chime must stay distinct (spec).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // No audio available; the game works silently.
  }
}

function tone(freq: number, startS: number, durS: number, type: OscillatorType, volume: number, endFreq = freq): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + startS;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durS);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durS);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + durS + 0.02);
}

export const sfx = {
  /** Flip warning: three bright bell notes going up. */
  warningChime(): void {
    tone(988, 0, 0.35, 'sine', 0.18);
    tone(1319, 0.14, 0.35, 'sine', 0.16);
    tone(1760, 0.28, 0.5, 'sine', 0.14);
  },
  /** The flip itself: a rising whoosh. */
  flip(): void {
    tone(220, 0, 0.35, 'triangle', 0.2, 880);
  },
  swing(): void {
    tone(600, 0, 0.08, 'square', 0.04, 200);
  },
  shoot(): void {
    tone(900, 0, 0.07, 'triangle', 0.07, 500);
  },
  hit(): void {
    tone(180, 0, 0.1, 'square', 0.08, 90);
  },
  hurt(): void {
    tone(300, 0, 0.2, 'sawtooth', 0.08, 120);
  },
  bounce(): void {
    tone(330, 0, 0.18, 'sine', 0.15, 990);
  },
};
