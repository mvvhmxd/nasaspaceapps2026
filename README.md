# Crater Expectations

A browser game for the NASA Space Apps Challenge 2026, "Lunar Landing Site Navigator".

You are the mission planner for a small solar lander going to the Moon's south pole. You choose where and when to land, plan the work around when the Sun and Earth are above the horizon, then watch the mission play out hour by hour. A launch delay can move the sky and force you to replan.

The Sun, the Earth and the terrain are real: NASA LOLA elevation data for the ground and its horizon, and NASA SPICE (DE440) for the Sun and Earth positions, checked against JPL Horizons.

## The challenge and how the game answers it
Missions to the lunar south pole depend on two things a planner cannot change: sunlight for power, and a line of sight to Earth for communication. Both are set by a Sun and Earth that stay within a few degrees of the horizon, and by the ridges around the site. Existing tools give this information but are slow to compare sites and dates with.

| Challenge asks for | In the game |
|---|---|
| Compare landing sites and dates quickly | The planner: one strip of landing days per site, a preview card, and up to 3 pinned choices side by side |
| Sun and Earth relative to the horizon | Hourly sunlit / Earth-in-view status from the real horizon, a north-up compass, time to the next sunset and Earthset |
| Power and direct-to-Earth communication windows | The schedule timeline (Sun row, Earth row, battery forecast) and the survival phase |
| Replanning when a launch slips | Mission 3: the launch slips 5 days and you get 60 seconds to pick a new site or day |

## How to play
1. **Pick a mission.** Three missions, each adding one idea: sunlight, Earth contact, launch slip.
2. **Plan.** Choose a site and a landing day. Amber bars show how sunlit the mission would be, teal shows Earth contact.
3. **Schedule** (missions 2 and 3). Paint Drill, Transmit and Sleep onto 6-hour blocks and watch the battery forecast.
4. **Survive and explore.** Time runs hour by hour while you drive a rover (W A S D or the arrow keys, at 1× speed) to ice prospects in the dark low ground, park to drill, and bring the ice back to the lander. In shadow the rover's battery only drains, so every trip is a bet on getting back to sunlight. Press V for the surface view: you stand at the rover and see the real horizon, with the Sun and Earth where SPICE puts them. Drag to look around. Space pauses, Z forces the lander to sleep, G toggles the ASCII look, 1×/4×/16× change speed.
5. **Debrief.** One star for surviving, two for returning 70% of the best automatic plan's science, three for 90%.

Science only counts once it is transmitted, and that needs Earth above the horizon. Data still on board when the battery dies is lost.

## Run it
Needs Node 22.
```bash
npm ci
npm run dev
```
Open the link it prints (normally http://localhost:5173). On Windows PowerShell, use `npm.cmd` if `npm` is blocked.

```bash
npm test          # game logic tests
npm run build     # production build in dist/
```

Useful URL options: `?replan=5` (short replan countdown for demos), `?ascii=force` (keep the ASCII look on a slow machine), `?ascii=0` (plain shading), `?debug` (frame rate and render check).

## Data and how it is checked
| What | Source | Used for |
|---|---|---|
| Terrain | NASA LOLA gridded elevation, PDS data set LRO-L-LOLA-4-GDR-V1.0 (product V2.0): `LDEM_85S_40M` and `LDEM_80S_80M` | The map, and the horizon in every direction out to 250 km |
| Sun and Earth positions | NASA NAIF SPICE with DE440 (`de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc`, `naif0012.tls`) | Hourly azimuth and elevation at each site |
| Independent check | JPL Horizons API | Verifies the SPICE results; never supplies game numbers |

Rule: **SPICE computes, Horizons verifies.**

- **Sun and Earth vs Horizons:** the largest difference is 0.00007° at every site, over 1,440 hours each. Reports are in `pipeline/validation/`.
- **Terrain reading:** known deep craters appear at the expected depth, and the two LOLA products agree to within a metre at the same points.
- **Horizon geometry:** unit tests check that a smooth sphere gives the textbook dip angle and that a wall is seen only in its own direction.
- **Game logic:** `npm test` (32 tests) covers visibility, the survival sim, the planner, the schedule forecast and saved progress. The forecast is tested to equal the hour-by-hour playback.

The offline pipeline that produces `public/sites/<id>.json` is in [`pipeline/`](pipeline/README.md). Raw kernels and elevation files are downloaded by it and are never committed.

## What is simplified
- **Battery numbers are game values,** balanced for play. They are not from a real lander or rover.
- **Ice prospects are chosen by rule:** the deepest reachable low ground in each 10 km map. They are prospects, not known ice deposits.
- **Rover lighting is approximate:** local terrain within the 10 km map plus the lander's far horizon.
- **Surface view:** the Sun and Earth are at their true positions but drawn larger than life (the Sun 4×, the Earth 8×). The camera rides about 220 m above and behind the rover, exposed like a camera (sunlit ground white, shadows black). Beyond the 10 km map the horizon is a silhouette built from the site's real horizon as seen from the lander. Earth's face is a drawing, not an image, and shows no phase.
- **The Sun is a point.** It counts as up when its centre clears the horizon; the real disc is about 0.5° wide, so real sunrise is gradual.
- **Terrain grid is 40 m** and the lander's eye is 2 m above it. Boulders and small bumps are not modelled.
- **On-map shadows are a visual aid.** They use only the 10 km around the site. The SUNLIT / IN SHADOW status is the calculated truth and uses the 250 km horizon.
- **The four sites are the team's own picks** from a search of the LOLA terrain for high points near the pole (`pipeline/scripts/candidates.py`). They are not official or proposed landing sites.
- **The window is 60 days from 2026-12-01.**

## How it is built
Static site: Vite + React for the screens, three.js for the top-down map with a coloured ASCII shader. No backend, no AI in the product.

```
pipeline/ (Python, offline)                       browser
LOLA + SPICE ──► public/sites/<id>.json ──► src/data/loadSite.js
Horizons verifies                                   │
                                                    ▼
                                   src/sim/   pure game rules (source of truth)
                                    ├──► src/ui/, src/game/   screens, schedule, progress
                                    └──► src/render/          map and ASCII pass (display only)
```
More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/GDD.md`](docs/GDD.md).

## Use of AI
An AI coding assistant was used during development for scaffolding, pipeline and game code, tests and documentation. The team's log is [`pipeline/AI_USE_LOG.md`](pipeline/AI_USE_LOG.md). The game itself contains no AI: every number comes from the data and the deterministic rules above.

## Credits
- Terrain: NASA Lunar Reconnaissance Orbiter, Lunar Orbiter Laser Altimeter (LOLA) team, via the PDS Geosciences Node.
- Ephemerides and toolkit: NASA JPL NAIF (SPICE, DE440). Check: JPL Solar System Dynamics, Horizons.
- Challenge resources also consulted: LROC QuickMap, NASA Moon Trek, Canadian Space Agency Moon exploration pages.
- Software: React, three.js, Vite, Vitest, SpiceyPy, NumPy.
- Sound: synthesised in the browser by the game's own code; no audio files.

Not affiliated with or endorsed by NASA. No NASA logos or insignia are used.
