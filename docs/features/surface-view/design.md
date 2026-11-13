# Surface view

**Status:** in progress · **Updated:** 2026-11-13 · [GDD](../../GDD.md) · [Implementation](implementation.md) · [Testing](testing.md)

The main screen. The real terrain around the landing site, built from LOLA, is lit by a single low Sun whose direction comes from the hourly Horizons series, so shadows sweep across craters as time runs. It is drawn through a coloured ASCII shader for the game's look. Top-down shows the terrain, shadows and lander as a map; the hero camera drops low behind the lander to show the Sun and Earth sitting on the real horizon. Pillars: *Real sky, real stakes* and *Readable in 3 seconds*.

## Rules
1. Terrain is a mesh from the site's heightmap (downsampled LOLA crop), centred on the landing site, with true vertical scale (no exaggeration by default; a 2× toggle in planner view, labelled).
2. The Sun is a directional light set each hour from the series' Sun azimuth and elevation, casting real shadows. Earth is a small teal sprite placed at its azimuth and elevation on the sky dome.
3. The lander turns red when the sim says it is in shadow. The sim (horizon mask) is the source of truth, not the render; if the two disagree, that is a bug to log.
4. **Top-down camera** (default): orthographic, looking straight down, north up, with a compass ring at the screen edge marking the directions of the Sun (amber) and Earth (teal).
5. **Hero camera** (`V` toggles): perspective, low behind the lander, facing the Sun's azimuth; drag to orbit. The horizon, the Sun and Earth are visible directly.
6. **ASCII pass:** the screen is split into cells. Each cell's brightness picks a glyph from the ramp `' .:-=+*#%@'` and is tinted by the scene colour. HUD and UI text are drawn on top in normal type and are never ASCII-filtered.
7. Colour holds the state: sunlit terrain in amber–grey, shadow in navy, Earth and comms in teal, the lander red when in shadow. Every state also has an icon or label on the HUD (accessibility).
8. Camera switches use a short eased transition (about 0.4 s), never a cut, so the player keeps track of where the lander is.

## Numbers
| Name | Value | Unit | What to watch in playtests |
|---|---|---|---|
| Terrain crop | 10 × 10 [ASSUMPTION] | km | Includes the ridges that cast the shadows? |
| Mesh resolution | 256 × 256 [ASSUMPTION] | vertices | Detail vs frame rate |
| ASCII cell size | 8 [ASSUMPTION] | px | Detailed but readable |
| Target frame rate | 60 | fps | On the slowest team laptop |
| Camera transition | 0.4 | s | — |

## Edge cases
- The horizon in the hero view includes distant terrain beyond the crop; the far horizon comes from the mask and is drawn as a silhouette ring on the sky dome so it matches the sim.
- If the ASCII shader fails or runs slow, fall back to plain shaded 3D with the same colours (a setting, also used automatically below 30 fps).
- Window resize rebuilds the ASCII render targets.

## Open questions
- [ASSUMPTION] Selective ASCII (only terrain, with the lander and Earth drawn sharp) vs full-screen ASCII: decide at M3 by looking at both.
- Does the hero view need a time-lapse trail of the Sun's path across the sky? Probably yes; cheap, and very readable.

## History
- 2026-11-13: designed.
- 2026-11-13: M1 scene proof built (terrain, Sun shadows, lander shadow state, top-down camera); see implementation.md for what is still missing.
