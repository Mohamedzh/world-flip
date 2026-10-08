// The one saved game, kept in the browser's localStorage (spec).
import { SAVE } from './config';
import { FIRST_LEVEL } from './level/levels';
import { SaveStore, type KeyValueStore } from './systems/progress';

function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // Storage blocked (e.g. some private windows): progress lasts until the tab closes.
  }
}

export const saveGame = new SaveStore(browserStorage(), SAVE.storageKey, FIRST_LEVEL);
