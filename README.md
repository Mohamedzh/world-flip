# World Flip

A side-scrolling browser platformer where the world's rules flip every 50 seconds.
The full design is in the game design spec; this repo builds it milestone by milestone.

**Status:** milestone 3. Level 1 (Meadow) is complete: the Ember Beetle guardian, the Fire power,
star ratings, saving, and Kenney art.

## Play it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. In development, http://localhost:5173/?level=test-level opens a short
test level with every flip, creature and the guardian close together.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, W or Up (hold for a higher jump) |
| Attack | J (Ranger: hold 0.8 s for a charged shot) |
| Use power | Tap K (Fire: throw a fireball) |
| Power up the weapon | Hold K and press J (Knight: flaming swing; Ranger: fire arrow) |
| Switch power | L, or 1-4 |
| Pause | Esc |
| Choose hero / continue after the crown | Left, Right, Enter |

Debug keys, only in `npm run dev`:

| Key | Does |
| --- | --- |
| F | Flip the world now |
| G | Show or hide physics outlines |
| N | Jump to the next checkpoint (then near the crown) |
| H | Hurt yourself by one heart |
| P | Get the Fire power |

To start over, clear the save in the browser console: `localStorage.removeItem('world-flip-save-v1')`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the game with live reload |
| `npm test` | Run the unit tests (game rules and level checks) |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run gen:tiles` | Redraw the orange/blue block tiles |
| `npm run gen:levels` | Rebuild every level from `scripts/levels/` (overwrites edits made in Tiled) |

## World flips

Every 50 seconds the world's rules flip, with a 3-second warning (chime, screen shimmer, next flip's icon in the top bar).
Each level lists its flips in order; the list loops after the Normal start.

| Flip | What changes |
| --- | --- |
| Low gravity | Gravity drops to 30%: jumps go about 3x higher |
| Color swap | Blue blocks (dots) turn solid, orange blocks (stripes) turn into ghosts |
| Friend/foe swap | Bounce mushrooms bite; enemies turn harmless and can be bounced on (from World 2) |
| Normal | Everything back to normal |

## Powers, stars and saving

- **Fire** (World 1, from the Ember Beetle): fireball does 3 damage and burns wooden crates; 3 s cooldown.
  Charging the weapon uses the same cooldown. Powers are kept forever once earned.
- **Stars:** 1 for reaching the crown, 2 under the level's par time, 3 under par with no hearts lost.
- **Saving:** powers, best stars and times, unlocked levels and the chosen hero are kept in the browser's localStorage.

## How it's organized

- `src/config.ts`: **every tuning number** (gravity, speeds, jump, hearts, lives, timings, damage, cooldowns). Tweak the game here.
- `src/systems/`: game rules with no Phaser code, covered by tests in `tests/`: flip timer (`FlipManager`), world rules per flip,
  push-out from blocks that turn solid, combat rules, powers and cooldowns, stars and save data, hearts and lives, checkpoints.
- `src/level/`: reads and checks Tiled level files; `levels.ts` lists the levels in play order.
- `src/hero/`: hero movement (shared) and the Knight and Ranger, which differ only in weapon.
- `src/weapons/`: Sword, Bow, Arrow and Fireball.
- `src/actors/`: the Walker enemy, the Ember Beetle guardian, the bounce Mushroom friend and power orbs.
- `src/world/`: color blocks and burnable crates.
- `src/scenes/`: Boot (loading), Select (hero select), Game (the level), Hud (top bar, messages, results).
- `src/gfx/`: Kenney sprite sheet frames and animations, plus a few textures drawn in code.
- `public/assets/levels/*.tmj`: levels, editable in the [Tiled](https://www.mapeditor.org/) map editor.

## Making levels

Levels are drawn on a character grid in `scripts/levels/*.mjs` and turned into Tiled files with `npm run gen:levels`.
They can then be opened in Tiled. Each level needs:

- Tile layers `ground`, `orange`, `blue` and `burnable` (wooden crates). Orange blocks are solid and blue blocks are
  ghosts in the Normal state. An optional `decor` layer holds plants.
- An `objects` layer with point objects whose **Class** is `spawn` (exactly one), `checkpoint` (2-3), `crown` (exactly one),
  `enemy`, `mushroom` or `emberBeetle`. Place each point on the floor where the thing should stand.
- Map properties (Map > Map Properties): `name`, `parTimeSec` (par time in seconds), and `flipOrder`: the flips in order,
  comma separated, from `lowGravity`, `colorSwap`, `friendFoe`, `normal`.

If you edit a level by hand in Tiled, delete its script in `scripts/levels/` so `npm run gen:levels` can't overwrite it.
`npm test` checks every level file for these rules.

## Credits

Art: [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) by Kenney (kenney.nl), CC0. See `public/assets/kenney/License.txt`.
