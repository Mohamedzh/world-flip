# World Flip

A side-scrolling browser platformer where the world's rules flip every 50 seconds.
The full design is in the game design spec; this repo builds it milestone by milestone.

**Status:** milestone 2 (world flips, weapons, hero select, first enemy and friend; placeholder shapes).

## Play it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, W or Up (hold for a higher jump) |
| Attack | J (Ranger: hold 0.8 s for a charged shot) |
| Pause | Esc |
| Choose hero / continue after the crown | Left, Right, Enter |

Debug keys, only in `npm run dev`:

| Key | Does |
| --- | --- |
| F | Flip the world now |
| G | Show or hide physics outlines |
| N | Jump to the next checkpoint (then near the crown) |
| H | Hurt yourself by one heart |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the game with live reload |
| `npm test` | Run the unit tests (game rules and level checks) |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run gen:tiles` | Redraw the placeholder tile image |
| `npm run gen:level` | Rebuild the test level (overwrites edits made in Tiled) |

## World flips

Every 50 seconds the world's rules flip, with a 3-second warning (chime, screen shimmer, next flip's icon in the top bar).
Each level lists its flips in order; the list loops after the Normal start.

| Flip | What changes |
| --- | --- |
| Low gravity | Gravity drops to 30%: jumps go about 3x higher |
| Color swap | Blue blocks (dots) turn solid, orange blocks (stripes) turn into ghosts |
| Friend/foe swap | Bounce mushrooms bite; enemies turn harmless and can be bounced on |
| Normal | Everything back to normal |

## How it's organized

- `src/config.ts`: **every tuning number** (gravity, speeds, jump, hearts, lives, timings). Tweak the game here.
- `src/systems/`: game rules with no Phaser code, covered by tests in `tests/`: flip timer (`FlipManager`), world rules per flip, push-out from blocks that turn solid, combat rules, cooldowns, hearts and lives, checkpoints.
- `src/level/LevelData.ts`: reads and checks Tiled level files.
- `src/hero/`: hero movement (shared) and the Knight and Ranger, which differ only in weapon.
- `src/weapons/`: Sword, Bow and Arrow.
- `src/actors/`: the Walker enemy and the bounce Mushroom friend.
- `src/world/ColorBlocks.ts`: switches which block color is solid.
- `src/scenes/`: Boot (loading), Select (hero select), Game (the level), Hud (hearts, lives, flip bar, time, messages).
- `public/assets/levels/*.tmj`: levels, editable in the [Tiled](https://www.mapeditor.org/) map editor.

## Editing a level in Tiled

Open `public/assets/levels/test-level.tmj` in Tiled. Keep these layer names:

- `ground`, `orange`, `blue`: tile layers. Orange blocks are solid and blue blocks are ghosts in the Normal state.
- `objects`: an object layer with point objects whose **Class** is `spawn` (exactly one), `checkpoint` (2-3), `crown` (exactly one), `enemy` or `mushroom`. Place each point on the floor where the thing should stand.
- Map property `flipOrder` (Map > Map Properties): the flips in order, comma separated, from `lowGravity`, `colorSwap`, `friendFoe`, `normal`.

`npm test` checks every level file for these rules.
