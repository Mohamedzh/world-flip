// Whether music and sound effects are on. Remembered in the browser between visits.

const KEY = 'world-flip-sound';

function load(): { music: boolean; sfx: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Record<'music' | 'sfx', unknown>>;
    return { music: raw.music !== false, sfx: raw.sfx !== false };
  } catch {
    return { music: true, sfx: true };
  }
}

class SoundSettings {
  private state = load();

  get music(): boolean {
    return this.state.music;
  }

  get sfx(): boolean {
    return this.state.sfx;
  }

  setMusic(on: boolean): void {
    this.state = { ...this.state, music: on };
    this.store();
  }

  setSfx(on: boolean): void {
    this.state = { ...this.state, sfx: on };
    this.store();
  }

  private store(): void {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // Storage blocked: the setting lasts until the tab closes.
    }
  }
}

export const soundSettings = new SoundSettings();
