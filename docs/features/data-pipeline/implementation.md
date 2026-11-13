# Data pipeline: implementation

**Updated:** 2026-11-13 · [Design](design.md) · [Testing](testing.md) · [Architecture](../../ARCHITECTURE.md)

## Approach
One script, `scripts/pipeline/make_site.py <site-id>`, run once per site; output goes to `public/sites/<id>.json`. Positions use LOLA's south polar stereographic grid (R = 1,737,400 m; `x = ρ sin λ`, `y = ρ cos λ`). The 240 m polar DEM's grid (`x = (col − 1905.5) · 240`, `y = (1905.5 − row) · 240`, height = DN × 0.5 m) was checked against the 5 m DEM where they overlap: 4.7 m RMS, 0.6 m median offset.

The crop's horizon is a Python port of the game's `computeMask`, run on the heights exactly as the game decodes them (after Uint16 quantisation). The far horizon starts where each azimuth's ray leaves the crop and uses 3D vectors, so curvature is exact at 100 km.

## Code map
| File / module | Role in this feature |
|---|---|
| `scripts/pipeline/make_site.py` | `SITES` table, downloads, `Terrain` (5 m + 240 m sampler), `build_heightmap`, `crop_mask` / `mesh_height` (ports of `computeMask` / `heightAt`), `far_mask`, `horizons_series`, summary |
| `scripts/pipeline/requirements.txt` | numpy 2.5.4, rasterio 1.5.2 |
| `src/data/loadSite.js` | adds `nearMask` (the crop's own horizon) at load |
| `src/sim/visibility.js` | `sunNearMask`, `sunBehindFarTerrain` in `stateAt` |
| `src/App.jsx` | `?site=`, real-data badge, "IN SHADOW (far terrain)", render check against the crop's horizon |

## Data and config
- **Sources:** `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif` (41 MB), `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG` (29 MB), `https://ssd.jpl.nasa.gov/api/horizons.api`.
- **Constants:** `SIZE` 257, `SPACING_M` 40, `OBSERVER_M` 2, `MAX_RANGE_M` 450,000; far march 2.5 m steps to 8 km, then 60 m.
- **Output rounding:** mask to 0.0001°, series to 0.001°.
- **Connecting Ridge result:** 216 KB; ground 1954.6 m; crop 740 to 1959 m; horizon −2.83° to 1.00°; terrain 27 to 99 km away sets the horizon at 58 azimuths; 1440 h from 2027-03-01, sunlit 27.6%, Earth in view 38.0%.

## Deviations from design
- None.

## History
- 2026-11-13: first version; Connecting Ridge built.
