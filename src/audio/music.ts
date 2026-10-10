// Background music: one track per world, plus the menu and the ending.
// Tracks by Juhani Junkala, CC0 (see public/assets/music/CREDITS.txt).
// They stream from files (no long loading at the start) and loop; switching tracks fades.
// Each track is Ogg Vorbis, with an MP3 copy for Safari.
import { soundSettings } from './settings';

export type Tune = 'menu' | 'meadow' | 'lake' | 'mountain' | 'sky' | 'castle' | 'ending';

/** Ogg where the browser plays it (smaller files); MP3 copies for Safari, which doesn't. */
const FORMAT = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs=vorbis') ? 'ogg' : 'mp3';
const trackUrl = (tune: Tune) => `assets/music/${tune}.${FORMAT}`;

/** Music volume (0-1): under the sound effects. */
const VOLUME = 0.45;
const FADE_MS = 600;

class MusicPlayer {
  private wanted: Tune | null = null;
  private audio: HTMLAudioElement | null = null;
  private fadeTimer: number | null = null;

  constructor() {
    // Browsers only allow sound after the player has pressed a key or clicked, so try again then.
    const retry = () => this.resume();
    window.addEventListener('keydown', retry);
    window.addEventListener('pointerdown', retry);
  }

  get enabled(): boolean {
    return soundSettings.music;
  }

  /** Starts a track (keeps playing if it's already the one playing). */
  play(tune: Tune): void {
    if (tune === this.wanted && this.audio) return;
    this.wanted = tune;
    this.fadeOutCurrent();
    if (!this.enabled) return;
    this.start(tune);
  }

  stop(): void {
    this.wanted = null;
    this.fadeOutCurrent();
  }

  /** The music button / M key. */
  toggle(): boolean {
    soundSettings.setMusic(!soundSettings.music);
    if (soundSettings.music) {
      if (this.wanted) this.start(this.wanted);
    } else {
      this.fadeOutCurrent();
    }
    return soundSettings.music;
  }

  private start(tune: Tune): void {
    const a = new Audio(trackUrl(tune));
    a.loop = true;
    a.volume = 0;
    this.audio = a;
    this.resume();
    this.fadeTo(a, VOLUME);
  }

  private resume(): void {
    const a = this.audio;
    if (a && a.paused && this.enabled) a.play().catch(() => undefined);
  }

  private fadeOutCurrent(): void {
    const old = this.audio;
    this.audio = null;
    if (!old) return;
    const startVol = old.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      old.volume = startVol * (1 - k);
      if (k < 1) requestAnimationFrame(step);
      else {
        old.pause();
        old.src = '';
      }
    };
    // requestAnimationFrame doesn't run in background tabs; a timer makes sure the old track stops.
    window.setTimeout(() => {
      old.pause();
      old.src = '';
    }, FADE_MS + 100);
    requestAnimationFrame(step);
  }

  private fadeTo(a: HTMLAudioElement, target: number): void {
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    const t0 = performance.now();
    this.fadeTimer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      a.volume = target * k;
      if (k >= 1 && this.fadeTimer !== null) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 30);
  }
}

export const music = new MusicPlayer();
