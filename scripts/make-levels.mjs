// Rebuilds every level file from scripts/levels/. Run: npm run gen:levels
// A level edited by hand in Tiled should have its script deleted, or this will overwrite the edits.
import { readdirSync } from 'node:fs';

const dir = new URL('./levels/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
  await import(new URL(file, dir).href);
}
