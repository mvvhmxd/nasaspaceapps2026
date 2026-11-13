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
| Tests | Vitest 4.1.12 (`npm test`); the terrain and sim modules run in Node with no WebGL |
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
`App.jsx` owns the mission hour (slider, play, speed). Each change of hour calls `stateAt` and pushes the Sun direction and the lander colour into the scene. The render loop (`renderer.setAnimationLoop`) only draws and counts fps.

## 3. Module map
| Module / folder | Responsibility | Used by features |
|---|---|---|
| `src/sim/horizon.js` | `computeMask(heightmap)`: horizon elevation per 1° azimuth with lunar curvature (`MOON_RADIUS_M`); `heightAt` bilinear sampling; `observerEyeHeight` | surface view, site planner, data pipeline |
| `src/sim/visibility.js` | `maskAt`, `isAboveHorizon`, `stateAt(site, hour)` → sunlit / earthVisible for one hour | survival sim, site planner, surface view |
| `src/data/loadSite.js` | `loadSite(id)`, `decodeSite`, `decodeHeightmap` (base64 Uint16 → Float32 metres) | all |
| `src/render/terrain.js` | `buildTerrain(hm)`: chunked meshes (32×32 cells) with curvature baked in and seamless normals; `landerEye`; `blockedToward` raycast | surface view, tests |
| `src/render/sun.js` | `directionFromAzEl(az, el)` → world unit vector | surface view, tests |
| `src/render/camera.js` | top-down orthographic camera, `fitTopDown` covers the screen | surface view |
| `src/render/scene.js` | `createSurfaceScene(canvas, site)`: renderer, PCFSoft shadows, Sun light, lander, controls, fps | surface view |
| `src/theme.js` | `PALETTE` (navy, amber, teal, grey, red) | all UI and scene colours |
| `src/App.jsx`, `src/styles.css` | hour control, HUD, Illustrative badge | debug HUD for M1; survival HUD later |
| `scripts/make-demo-site.mjs` | writes the illustrative `public/sites/demo.json` | development |

## 4. Cross-cutting conventions
- **World axes:** x = east, y = up, z = south (metres), origin at the landing site's ground point. North is −z. The top-down camera shows north at the top of the screen.
- **Angles:** azimuth clockwise from north in degrees; elevation in degrees above the local horizontal. `horizonMask[i]` is the terrain elevation at azimuth `i`°.
- **Curvature:** both the mask and the terrain mesh drop the surface by `d² / 2R` with R = 1,737,400 m, so a ray from the lander and the mask agree.
- **Config and tuning:** survival numbers will live in one `src/sim/config.js` (not yet written); render constants are at the top of `scene.js` (`SUN_DISTANCE`).
- **Data / content:** see "Site data" below.
- **Randomness:** none in the game; the demo generator uses a seeded RNG (`mulberry32(2026)`) so the file is identical on every machine.
- **Rendering / UI layering:** one full-screen `<canvas>`, HUD as DOM elements on top. HUD text is never run through the ASCII pass.
- **Illustrative data:** a site with `illustrative: true` always shows the "Illustrative" badge.

### Site data (`public/sites/<id>.json`)
The contract between the Python pipeline and the game. `loadSite.js` validates the lengths.
```jsonc
{
  "id": "demo",
  "name": "Demo crater (illustrative)",
  "lat": -89.5, "lon": 0,                 // degrees, lunar
  "illustrative": true,                   // false only for real LOLA + Horizons data
  "source": "free text: where the data came from",
  "heightmap": {
    "size": 257,                          // grid points per side (square)
    "spacingM": 40,                       // metres between grid points
    "minM": 1119, "maxM": 1932,           // height range (metres)
    "data": "<base64>"                    // size*size Uint16 little-endian, row 0 = north edge,
                                          // col 0 = west edge; height = minM + v * (maxM - minM) / 65535
  },
  "horizonMask": [ /* 360 numbers */ ],   // elevation (deg) of the terrain horizon at azimuth 0..359,
                                          // curvature included, observer 2 m above the centre point
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
public/sites/    site JSON files (demo.json is generated, illustrative)
scripts/         make-demo-site.mjs (node, writes demo.json)
src/
  sim/           horizon.js, visibility.js   (pure, no three.js)
  data/          loadSite.js
  render/        terrain.js, sun.js, camera.js, scene.js
  App.jsx, main.jsx, styles.css, theme.js
tests/           vitest specs (visibility.test.js)
```

## 6. Performance budget
- Target 60 fps, floor 30 fps, on the slowest team laptop (to be measured; headless screenshots use a software renderer and say nothing about this).
- Terrain: 257² grid = 66k vertices in 64 chunks; shadow map 4096². Below 30 fps, the first cuts are shadow map 2048² and a 129² grid.
- Site JSON under 500 KB each.

## 7. Testing and tooling
- `npm test` runs `tests/**/*.test.js` in Node. `tests/visibility.test.js` checks axis conventions, mask interpolation, that `demo.json`'s stored mask matches `computeMask`, and that the render raycast agrees with the sim mask on ≥ 95% of hours.
- `npm run demo-site` regenerates `public/sites/demo.json`.
- Debug: `?h=<hour>` opens the app at a given mission hour; the HUD's "render check" line compares the raycast with the sim every hour.

## 8. Build and release
- `npm run dev` (port 5173), `npm run build` → `dist/`, `npm run preview`.
- Deploy: static hosting, not set up yet.

## 9. Open questions and tech risks
- The ASCII pass (two render targets plus a full-screen shader) is the main frame-rate risk; measure before and after on a real GPU.
- Real sites: whether a 10 km crop is enough for the far ridges that set the horizon at the south pole. The pipeline may need a wider, coarser crop for the mask than for the mesh.
