# Crater Expectations — Architecture

**Updated:** 2026-11-13 · [GDD](GDD.md)

## 1. Stack
| | |
|---|---|
| Engine / framework | three.js 0.187.0 (scene), React 19.3.1 (UI overlay) |
| Language | JavaScript (ES modules), JSX |
| Build / bundler | Vite 8.3.8 |
| Target runtime | Desktop browsers with WebGL2 [ASSUMPTION: no mobile] |
| Key libraries | `three/addons/controls/MapControls.js` for pan and zoom |
| Tests | Vitest 4.1.12 (`npm test`); the sim, game and terrain modules run in Node with no WebGL. `pytest pipeline/tests` for the SPICE pipeline |
| Data pipelines | Two, both offline. `scripts/pipeline/` (Dev 1): Python 3.14 with numpy 2.5.4 and rasterio 1.5.2, 5 m LOLA site DEM, sky from JPL Horizons. `pipeline/` (Dev 3/4): Python 3.11+ with SpiceyPy, NumPy and requests, 40 m polar LOLA DEM, sky from SPICE checked against Horizons |
| Hosting | Static build (`dist/`), deploy target to be chosen (Vercel planned) |

## 2. Structure
The sim is the source of truth; the render only shows it.
```
public/sites/<id>.json ──loadSite──▶ site object
                                        │
            ┌───────────────────────────┼─────────────────────────┐
            ▼                           ▼                         ▼
   sim/visibility.stateAt(site, hour)   render/scene.setSun(az, el)   App.jsx HUD
   { sunlit, earthVisible, masks }      shadows + raycast "render check"
            │                           ▲
            └── setLanderInShadow(!sunlit) ──┘   (sim decides the colour)
```
`App.jsx` owns the screen flow (title, missions, brief, planner, schedule, surface, debrief) and the survival clock. Every 0.5 s tick calls `advance(site, state, speed, plan)`, which steps one hour at a time, so no hour or event is skipped at 4× or 16×. The hour shown on the map is the sim's hour while a mission runs and the planned landing hour otherwise. Each change of hour calls `stateAt` and pushes the Sun direction and the lander colour into the scene. The render loop (`renderer.setAnimationLoop`) only draws and counts fps.

```
planner ──► schedule ──► surface ──► debrief          (missions 2 and 3; mission 1 skips schedule)
   ▲            │ Land
   └── launch slip (mission 3): earlier days lock, 60 s countdown, then lands with the current schedule
```
The offline pipeline is separate: `pipeline/` turns LOLA and SPICE data into the site files and never runs in the browser.

## 3. Module map
| Module / folder | Responsibility | Used by features |
|---|---|---|
| `src/sim/horizon.js` | `computeMask(heightmap)`: exact horizon of the drawn mesh per 1° azimuth (checked at every mesh-edge crossing) with lunar curvature (`MOON_RADIUS_M`); `heightAt` on the mesh's own triangles; `observerEyeHeight` | surface view, site planner, data pipeline |
| `src/sim/visibility.js` | `maskAt`, `isAboveHorizon`, `stateAt(site, hour)` → sunlit / earthVisible / `sunBehindFarTerrain` for one hour | survival sim, site planner, surface view |
| `src/data/loadSite.js` | `loadSite(id)`, `decodeSite` (adds `nearMask` = `computeMask` of the crop), `decodeHeightmap` (base64 Uint16 → Float32 metres) | all |
| `src/render/terrain.js` | `buildTerrain(hm)`: chunked meshes (32×32 cells) with curvature baked in and seamless normals; `landerEye`; `blockedToward` raycast | surface view, tests |
| `src/render/sun.js` | `directionFromAzEl(az, el)` → world unit vector | surface view, tests |
| `src/render/camera.js` | top-down orthographic camera, `fitTopDown` covers the screen | surface view |
| `src/render/scene.js` | `createSurfaceScene(canvas, site)`: renderer, PCFSoft shadows, Sun light (off when far terrain hides the Sun), lander, rover, prospects, map and surface cameras, ASCII pass, fps | surface view |
| `src/render/ascii.js` | coloured ASCII pass (glyph atlas sorted by ink coverage, full-screen shader); pixels with no terrain stay plain | surface view |
| `src/sim/config.js` | `SIM_CONFIG`: game-balanced battery, drain, store and star thresholds | survival sim, planner |
| `src/sim/survival.js` | `initialState`, `advance(site, state, hours, plan?)` → `{ state, events }`; `MODES` | survival sim, schedule forecast, solver |
| `src/sim/planner.js` | `previewStats(site, startHour, lengthH, config)` for the preview card | site planner |
| `src/sim/rover.js` | rover rules: `stepRover`, `sunlitAt` (local terrain + far mask), `findIceTargets`, `ROVER` game values | rover, surface view |
| `src/sim/solver.js` | `bestStart(site, config, stride)`: best automatic-plan landing hour | debrief stars |
| `src/game/missions.js` | the three missions: sites, length, slip, briefing text | campaign |
| `src/game/schedule.js` | 6-hour blocks, `planFrom`, `blockSky`, `forecast` (runs `advance`) | task schedule |
| `src/game/progress.js`, `settings.js` | stars per mission and player settings in `localStorage`, with sanitising | campaign, settings |
| `src/ui/gameHelpers.js` | pure helpers: countdowns, valid days, slip, stars, `bestPlan` across sites | planner, debrief |
| `src/ui/Screens.jsx`, `Planner.jsx`, `Schedule.jsx`, `MissionHud.jsx`, `Compass.jsx` | the screens; display and input only | all |
| `src/ui/audio.js` | event sounds synthesised with Web Audio (no audio files) | survival, slip |
| `src/theme.js` | `PALETTE` (navy, amber, teal, grey, red) | all UI and scene colours |
| `src/App.jsx`, `src/styles.css` | screen flow, survival clock, launch slip, settings wiring | all |
| `scripts/make-demo-site.mjs` | writes the illustrative `public/sites/demo.json` (used by `tests/visibility.test.js` only) | development |
| `pipeline/scripts/01`–`07`, `common.py` | kernels, DEM, local crop, ephemeris, horizon mask, Horizons validation, export (see `pipeline/README.md`) | real site files |
| `scripts/pipeline/make_site.py` | Dev 1's pipeline: LOLA 5 m and 240 m DEMs + JPL Horizons → `public/sites/connecting-ridge.json` ([data pipeline](features/data-pipeline/design.md)) | data pipeline |

## 4. Cross-cutting conventions
- **World axes:** x = east, y = up, z = south (metres), origin at the landing site's ground point. North is −z. The top-down camera shows north at the top of the screen.
- **Angles:** azimuth clockwise from north in degrees; elevation in degrees above the local horizontal. `horizonMask[i]` is the terrain elevation at azimuth `i`°.
- **Curvature:** both the mask and the terrain mesh drop the surface by `d² / 2R` with R = 1,737,400 m, so a ray from the lander and the mask agree.
- **One surface:** inside the crop the sim's horizon is computed on the same triangles the mesh draws (`heightAt`, `computeMask`, and their Python ports in `make_site.py`), so the render and the sim agree to the ridge line. Only terrain beyond the crop can make `horizonMask` higher than the drawn crop.
- **Config and tuning:** survival numbers live in `src/sim/config.js`; each mission can override them in `src/game/missions.js`; render constants are at the top of `scene.js` (`SUN_DISTANCE`).
- **Mask vs mesh:** the stored `horizonMask` covers terrain far beyond the 10 km crop (450 km for Dev 1's site, 250 km for the `pipeline/` sites). `loadSite` also computes `nearMask` from the crop; `stateAt` reports `sunBehindFarTerrain` when only far terrain hides the Sun, and the scene then switches the Sun light off so the map matches the sim. The sim is authoritative.
- **Data / content:** see "Site data" below.
- **Randomness:** none in the game; the demo generator uses a seeded RNG (`mulberry32(2026)`) so the file is identical on every machine.
- **Rendering / UI layering:** one full-screen `<canvas>`, HUD as DOM elements on top. HUD text is never run through the ASCII pass.
- **Illustrative data:** a site with `illustrative: true` always shows the "Illustrative" badge; a real site shows a teal "Real data: LOLA terrain · JPL Horizons sky" badge with the `source` text as its tooltip.

### Site data (`public/sites/<id>.json`)
The contract between the Python pipeline and the game. `loadSite.js` validates the lengths.
```jsonc
{
  "id": "demo",
  "name": "Demo crater (illustrative)",
  "lat": -89.5, "lon": 0,                 // degrees, lunar
  "illustrative": true,                   // false only for real LOLA + Horizons data
  "source": "free text: where the data came from",
  // Fields added with schemaVersion 2 (real sites). All optional for loadSite.js, which passes them through.
  "schemaVersion": 2,
  "blurb": "one line shown in the planner",
  "maskSource": "lola-wide",              // where horizonMask came from; "lola-wide" = fine + wide LOLA DEM
  "terrain": { "real": true, "dataSet": "LRO-L-LOLA-4-GDR-V1.0", "productVersion": "V2.0",
               "meshProduct": "LDEM_85S_40M", "horizonProducts": ["LDEM_85S_40M", "LDEM_80S_80M"],
               "frame": "MEAN EARTH/POLAR AXIS OF DE421", "horizonRangeKm": 250, "eyeHeightM": 2 },
  "sky": { "real": true, "kernels": ["de440s.bsp", "..."], "frame": "MOON_ME", "aberration": "LT+S",
           "validation": { "against": "JPL Horizons API", "toleranceDeg": 0.02, "checkedUtc": "...",
                           "sunMaxSeparationDeg": 0.00007, "earthMaxSeparationDeg": 0.00007 } },
  "heightmap": {
    "size": 257,                          // grid points per side (square)
    "spacingM": 40,                       // metres between grid points
    "minM": 1119, "maxM": 1932,           // height range (metres)
    "data": "<base64>"                    // size*size Uint16 little-endian, row 0 = north edge,
                                          // col 0 = west edge; height = minM + v * (maxM - minM) / 65535
  },
  "horizonMask": [ /* 360 numbers */ ],   // elevation (deg) of the terrain horizon at azimuth 0..359,
                                          // curvature included, observer 2 m above the centre point;
                                          // max of the drawn crop's horizon and terrain beyond the crop
  "series": {
    "startUtc": "2027-03-01T00:00:00Z",
    "stepHours": 1,
    "sunAz": [], "sunEl": [],             // one value per hour, degrees
    "earthAz": [], "earthEl": []          // same length as sunAz
  }
}
```
Sizes: a 257² heightmap plus 1440 hours is about 210 KB. Keep each site under 500 KB.

## 5. File layout
```
docs/            GDD, ARCHITECTURE, features/<slug>/
pipeline/        offline Python (SPICE): scripts/01-07, common.py, config/sites.yaml, tests/, validation/ reports
public/sites/    site JSON: connecting-ridge (Dev 1's pipeline); spur, massif, hollow (pipeline/); demo.json (illustrative, tests only)
scripts/pipeline/ make_site.py, Dev 1's pipeline (5 m LOLA + Horizons)
scripts/         make-demo-site.mjs (node, writes demo.json)
  pipeline/      make_site.py, requirements.txt (Python, writes real sites)
data/raw/        downloaded DEMs and Horizons responses (git-ignored, re-fetched on demand)
src/
  sim/           horizon.js, visibility.js, config.js, survival.js, planner.js, solver.js   (pure, no three.js)
  game/          missions.js, schedule.js, progress.js, settings.js                           (pure, no React)
  ui/            Screens, Planner, Schedule, MissionHud, Compass (JSX); gameHelpers.js; audio.js
  data/          loadSite.js
  render/        terrain.js, sun.js, camera.js, scene.js, ascii.js
  App.jsx, main.jsx, styles.css, theme.js
tests/           vitest specs: visibility.test.js, sim/, ui/
```

## 6. Performance budget
- Target 60 fps, floor 30 fps, on the slowest team laptop. Measured 144 fps with the ASCII pass on the lead's laptop (M1b); headless screenshots use a software renderer and say nothing about this.
- Terrain: 257² grid = 66k vertices in 64 chunks; shadow map 4096². Below 30 fps, the first cuts are shadow map 2048² and a 129² grid.
- Site JSON under 500 KB each.

## 7. Testing and tooling
- `npm test` runs `tests/**/*.test.js` in Node (46 tests). `tests/visibility.test.js` checks axis conventions and mask interpolation, then for each site: the stored mask against `computeMask` (equal for the demo; never lower for real sites), and that the render raycast agrees with the crop's horizon on ≥ 95% of hours with any miss within 0.01° of the ridge line. `tests/sim/` covers the survival sim, planner and rover; `tests/ui/` covers the campaign (every mission site is real and winnable, and all sites in a mission share one window), the schedule (the forecast equals hour-by-hour playback), saved progress and settings. `pytest pipeline/tests` (12 tests) covers the SPICE pipeline's geometry.
- `npm run demo-site` regenerates `public/sites/demo.json`.
- Real sites: `python -m venv .venv`, `.venv/Scripts/python -m pip install -r scripts/pipeline/requirements.txt`, then `.venv/Scripts/python -I scripts/pipeline/make_site.py connecting-ridge` (downloads about 70 MB into `data/raw/` on the first run).
- SPICE sites: `cd pipeline`, set up `.venv` from `requirements.txt`, then `./run_all.sh` (see `pipeline/README.md`).
- URL options: `?debug` shows fps and the "render check" line (raycast vs the crop's horizon); `?ascii=0` plain shading; `?ascii=force` never auto-switch ASCII off; `?replan=<s>` shortens the launch-slip countdown; `?debug&rover=x,z` starts the rover elsewhere.

## 8. Build and release
- `npm run dev` (port 5173), `npm run build` → `dist/`, `npm run preview`.
- Deploy: static hosting, not set up yet.

## 9. Open questions and tech risks
- The ASCII pass (two render targets plus a full-screen shader) is the main frame-rate risk; measure before and after on a real GPU.
- Far terrain: at Connecting Ridge, terrain 27 to 99 km away sets the horizon at 58 of 360 azimuths, beyond the 10 km crop. The mask covers it; the 3D view cannot cast those shadows, so the Sun light is switched off at those hours. The rover's surface view draws a far-horizon silhouette ring built from the site's mask.
- The Sun is treated as a point; a partial-disc model would make sunrise and sunset gradual.
- Stars compare against the best automatic plan; the solver does not search hand-made schedules.
