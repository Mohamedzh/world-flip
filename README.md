# World Flip

A side-scrolling browser platformer where the world's rules flip every 10 seconds.
The full design is in the game design spec; this repo builds it milestone by milestone.

**Status:** milestone 5, the whole game. Main menu, five worlds on the world map (Meadow, Lake, Mountain, Sky, and
Crown Castle with the Shifting King), all four powers and their combos, music and sound, and an ending screen.
Made by Mohamed Samir and Mariam Mohamed Samir.

## Play it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. In development, http://localhost:5173/?level=test-level opens a short
test level with every flip, creature and power puzzle close together (press P there for every power).

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, W or Up (hold for a higher jump) |
| Attack | J (Ranger: hold 0.8 s for a charged shot) |
| Use power | Tap K |
| Power up the weapon | Hold K and press J |
| Switch power | L, or 1-4 (fire, water, snow, wind) |
| Double jump and glide | Jump again in mid-air while Wind is the active power; hold jump to glide |
| Pause | Esc (then Q to go back to the map) |
| Music on/off | M, or the speaker-with-note button (top right) |
| Sound effects on/off | X, or the speaker-with-waves button (top right) |
| World map, hero select | Arrow keys, Enter; Esc on hero select goes back to the map |

Debug keys, only in `npm run dev`:

| Key | Does |
| --- | --- |
| F | Flip the world now |
| G | Show or hide physics outlines |
| N | Jump to the next checkpoint (then near the crown) |
| H | Hurt yourself by one heart |
| P | Get every power |
| U (world map) | Unlock every world and get every power |
| T (world map) | Play the test level |

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

Every 10 seconds the world's rules flip, with a 3-second warning (chime, screen shimmer, next flip's icon in the top bar).
(The spec said 50 s; play-testing showed quicker flips are more fun. Change `FLIPS.intervalMs` in `src/config.ts`.)
Each world opens with its new flip, then also cycles every flip from the worlds before it; `npm test` checks this.

| Flip | What changes |
| --- | --- |
| Low gravity | Gravity drops to 30%: jumps go about 3x higher |
| Color swap | Blue blocks (dots) turn solid, orange blocks (stripes) turn into ghosts |
| Friend/foe swap | Bounce mushrooms bite; enemies turn harmless and can be bounced on (from World 2) |
| Upside-down | Gravity reverses: walk on the ceiling (from World 3; those levels always have a ceiling) |

Worlds 1-3 flip in a fixed order; World 4 (Sky) flips in random order, still announced 3 seconds ahead.
| Normal | Everything back to normal |

## Powers, stars and saving

Each world's guardian drops one power; powers are kept forever once earned. Charging the weapon
(hold K, press J) uses the same cooldown as casting.

| Power | From | Tap K | Knight's powered swing | Ranger's powered arrow | Cooldown |
| --- | --- | --- | --- | --- | --- |
| Fire | Ember Beetle (World 1) | Bouncing fireball, 3 damage, burns crates | Flaming swing, +1 damage | Fire arrow lights crates | 3 s |
| Water | Tide Frog (World 2) | Wave pushes enemies 3 tiles, grows seed pods, puts out fire walls | Wave slash pushes | Water arrow grows pods from afar | 4 s |
| Snow | Frost Owl (World 3) | Snowball freezes an enemy (4 s, stand on it) or water (8 s ice bridge) | Frost swing slows | Ice arrow freezes | 5 s |
| Wind | Storm Hawk (World 4) | Gust knocks enemies off ledges; also double jump and 2 s glide | Spin attack hits both sides | Wind arrow passes through every enemy | 4 s |

Combos: **Water then Snow** (a wave leaves water across a gap; freeze it into an ice bridge),
**Fire plus Wind** (gust a fireball to split it into three), **Snow then Fire** (fire shatters a frozen enemy for double damage).

From World 3, some enemies throw slow pellets; the Knight's swing knocks them back at their thrower.
- **Stars:** 1 for reaching the crown, 2 under the level's par time, 3 under par with no hearts lost.
- **Saving:** powers, best stars and times, unlocked levels and the chosen hero are kept in the browser's localStorage.

## The final boss

Crown Castle opens on the world map once Sky is finished and all four powers are earned; its door shows four slots that
fill as powers are earned, and opens only with all four. The Shifting King wears a shield of four pieces, and each breaks
only with its own element (any fire, water, snow or wind attack, cast or weapon-powered). Every flip regrows the whole
shield, so all four must break within one flip window; the castle flips every 20 s instead of 10 to make that fair.
With the shield down, weapons hurt him: 10 Knight hits or 20 arrows. His attack changes with the flip: a hop normally,
a ground slam with shockwaves in low gravity (jump them; the Knight can't deflect these), a ceiling dive upside-down, and
two summoned mushrooms in the friend/foe swap. Beat him and the crown floats down; take it for the ending and your total stars.

## How it's organized

- `src/config.ts`: **every tuning number** (gravity, speeds, jump, hearts, lives, timings, damage, cooldowns). Tweak the game here.
- `src/systems/`: game rules with no Phaser code, covered by tests in `tests/`: flip timer (`FlipManager`), world rules per flip,
  push-out from blocks that turn solid, combat rules, powers and cooldowns, stars and save data, hearts and lives, checkpoints.
- `src/level/`: reads and checks Tiled level files; `levels.ts` lists the levels in play order.
- `src/hero/`: hero movement (shared) and the Knight and Ranger, which differ only in weapon.
- `src/weapons/`: Sword, Bow, and the projectiles (arrows, fireballs, water waves, snowballs, pellets).
- `src/actors/`: enemies (Walker, Thrower), the four guardians, the Shifting King and his door, the bounce Mushroom friend,
  fire walls and power orbs.
- `src/world/`: color blocks, burnable crates, water and ice, seed pods.
- `src/scenes/`: Boot (loading), Menu (main menu, controls, about), Map (world map), Select (hero select), Game (the level),
  Hud (top bar, messages, results), Ending.
- `src/audio/`: synthesized sound effects (`sfx.ts`), the music player (`music.ts`, one track per world) and the on/off settings.
- `src/gfx/`: Kenney sprite sheet frames and animations, plus a few textures drawn in code.
- `public/assets/levels/*.tmj`: levels, editable in the [Tiled](https://www.mapeditor.org/) map editor.

## Making levels

Levels are drawn on a character grid in `scripts/levels/*.mjs` and turned into Tiled files with `npm run gen:levels`.
They can then be opened in Tiled. Each level needs:

- Tile layers `ground`, `orange`, `blue`, `burnable` (wooden crates) and `water` (deadly; Snow freezes it). Orange blocks are
  solid and blue blocks are ghosts in the Normal state. An optional `decor` layer holds plants.
- An `objects` layer with point objects whose **Class** is `spawn` (exactly one), `checkpoint` (2-3), `crown` (exactly one),
  `enemy`, `thrower`, `mushroom`, `seedPod` (optional int property `height`, default 3), `fireWall` (reaches up to the ceiling),
  a guardian (`emberBeetle`, `tideFrog`, `frostOwl`, `stormHawk`), or for the castle `shiftingKing` and `bossDoor`
  (in the castle the crown stays hidden until the King is beaten). Place each point on the floor where the thing should stand.
- Map properties (Map > Map Properties): `name`, `theme` (`meadow`, `lake`, `mountain` or `sky`), `parTimeSec`,
  `flipOrder` (comma separated, from `lowGravity`, `colorSwap`, `friendFoe`, `upsideDown`, `normal`), and optionally
  `flipMode` (`fixed` or `random`), `flipIntervalSec` (seconds between flips, default 10), and `enemyHealth` and
  `enemySpeed` for tougher worlds. Themes also include `castle`.
- A level that has `upsideDown` in its flips needs a ceiling wherever the hero can be.

If you edit a level by hand in Tiled, delete its script in `scripts/levels/` so `npm run gen:levels` can't overwrite it.
`npm test` checks every level file for these rules.

## Credits

Art: [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) by Kenney (kenney.nl), CC0. See `public/assets/kenney/License.txt`.
The Knight and Ranger sprites (`public/assets/heroes/`) were drawn by Mariam Mohamed Samir; their walk,
jump, fall and attack frames are built from that art.

Music: tracks by Juhani Junkala, CC0, from OpenGameArt.org ("4 Chiptunes (Adventure)" and "JRPG Music Pack #1 [Exploration]").
See `public/assets/music/CREDITS.txt` for which track plays where. Sound effects are synthesized in the browser (`src/audio/sfx.ts`).
