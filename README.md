# World Flip

A side-scrolling browser platformer where the world's rules flip every 50 seconds.
The full design is in the game design spec; this repo builds it milestone by milestone.

**Status:** milestone 4. Worlds 1-4 (Meadow, Lake, Mountain, Sky) are playable from the world map,
with all four powers, their combos, upside-down gravity and random flip order. The Crown Castle boss comes in milestone 5.

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
| World map, hero select | Arrow keys, Enter; Esc on hero select goes back to the map |

Debug keys, only in `npm run dev`:

| Key | Does |
| --- | --- |
| F | Flip the world now |
| G | Show or hide physics outlines |
| N | Jump to the next checkpoint (then near the crown) |
| H | Hurt yourself by one heart |
| P | Get every power |
| U (world map) | Unlock every world |
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

Every 50 seconds the world's rules flip, with a 3-second warning (chime, screen shimmer, next flip's icon in the top bar).
Each level lists its flips in order; the list loops after the Normal start.

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

## How it's organized

- `src/config.ts`: **every tuning number** (gravity, speeds, jump, hearts, lives, timings, damage, cooldowns). Tweak the game here.
- `src/systems/`: game rules with no Phaser code, covered by tests in `tests/`: flip timer (`FlipManager`), world rules per flip,
  push-out from blocks that turn solid, combat rules, powers and cooldowns, stars and save data, hearts and lives, checkpoints.
- `src/level/`: reads and checks Tiled level files; `levels.ts` lists the levels in play order.
- `src/hero/`: hero movement (shared) and the Knight and Ranger, which differ only in weapon.
- `src/weapons/`: Sword, Bow, and the projectiles (arrows, fireballs, water waves, snowballs, pellets).
- `src/actors/`: enemies (Walker, Thrower), the four guardians, the bounce Mushroom friend, fire walls and power orbs.
- `src/world/`: color blocks, burnable crates, water and ice, seed pods.
- `src/scenes/`: Boot (loading), Map (world map), Select (hero select), Game (the level), Hud (top bar, messages, results).
- `src/gfx/`: Kenney sprite sheet frames and animations, plus a few textures drawn in code.
- `public/assets/levels/*.tmj`: levels, editable in the [Tiled](https://www.mapeditor.org/) map editor.

## Making levels

Levels are drawn on a character grid in `scripts/levels/*.mjs` and turned into Tiled files with `npm run gen:levels`.
They can then be opened in Tiled. Each level needs:

- Tile layers `ground`, `orange`, `blue`, `burnable` (wooden crates) and `water` (deadly; Snow freezes it). Orange blocks are
  solid and blue blocks are ghosts in the Normal state. An optional `decor` layer holds plants.
- An `objects` layer with point objects whose **Class** is `spawn` (exactly one), `checkpoint` (2-3), `crown` (exactly one),
  `enemy`, `thrower`, `mushroom`, `seedPod` (optional int property `height`, default 3), `fireWall` (reaches up to the ceiling),
  or a guardian: `emberBeetle`, `tideFrog`, `frostOwl`, `stormHawk`. Place each point on the floor where the thing should stand.
- Map properties (Map > Map Properties): `name`, `theme` (`meadow`, `lake`, `mountain` or `sky`), `parTimeSec`,
  `flipOrder` (comma separated, from `lowGravity`, `colorSwap`, `friendFoe`, `upsideDown`, `normal`), and optionally
  `flipMode` (`fixed` or `random`), `enemyHealth` and `enemySpeed` for tougher worlds.
- A level that has `upsideDown` in its flips needs a ceiling wherever the hero can be.

If you edit a level by hand in Tiled, delete its script in `scripts/levels/` so `npm run gen:levels` can't overwrite it.
`npm test` checks every level file for these rules.

## Credits

Art: [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) by Kenney (kenney.nl), CC0. See `public/assets/kenney/License.txt`.
