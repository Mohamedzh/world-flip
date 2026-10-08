# World Flip

A side-scrolling browser platformer where the world's rules flip every 50 seconds.
The full design is in the game design spec; this repo builds it milestone by milestone.

**Status:** milestone 1 (core movement, placeholder shapes).

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
| Pause | Esc |
| Play again after the crown | Enter |

Debug keys, only in `npm run dev`:

| Key | Does |
| --- | --- |
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

## How it's organized

- `src/config.ts`: **every tuning number** (gravity, speeds, jump, hearts, lives, timings). Tweak the game here.
- `src/systems/`: game rules with no Phaser code (hearts and lives, checkpoints), covered by tests in `tests/`.
- `src/level/LevelData.ts`: reads and checks Tiled level files.
- `src/hero/Hero.ts`: hero movement (shared by the Knight and Ranger).
- `src/scenes/`: Boot (loading), Game (the level), Hud (hearts, lives, time, messages).
- `public/assets/levels/*.tmj`: levels, editable in the [Tiled](https://www.mapeditor.org/) map editor.

## Editing a level in Tiled

Open `public/assets/levels/test-level.tmj` in Tiled. Keep these layer names:

- `ground`, `orange`, `blue`: tile layers. Orange blocks are solid and blue blocks are ghosts in the Normal state.
- `objects`: an object layer with point objects whose **Class** is `spawn` (exactly one), `checkpoint` (2-3) or `crown` (exactly one). Place each point on the floor where the thing should stand.

`npm test` checks every level file for these rules.
