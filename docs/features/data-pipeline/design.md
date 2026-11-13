# Data pipeline

**Status:** in progress · **Updated:** 2026-11-13 · [GDD](../../GDD.md) · [Implementation](implementation.md) · [Testing](testing.md)

An offline Python script that turns NASA data into one site file the game loads ([site data format](../../ARCHITECTURE.md#site-data-publicsitesidjson)): LOLA terrain around a landing site, the horizon seen from the lander, and the hourly Sun and Earth positions from JPL Horizons. It is what makes pillar 1, *Real sky, real stakes*, true: no day, night or Earth contact in a real site is made up.

## Rules
1. **Terrain:** a 10.24 km square around the site, 257 × 257 points at 40 m, sampled from the 5 m LOLA site DEM (NASA GSFC PGDA, Barker et al. 2021) and rotated so north is up.
2. **Horizon, inside the crop:** computed on the same 40 m triangles the game draws, so the render and the sim agree. Detail finer than 40 m near the lander is left out on purpose: a few metres of 5 m DEM relief within 100 m sets the horizon at more than half the azimuths, and that is below the DEM's vertical accuracy (about 1 m).
3. **Horizon, beyond the crop:** the 5 m DEM, then the LOLA 240 m polar DEM out to 450 km, marched along great circles with exact curvature. The stored mask is the higher of the two.
4. **Sky:** JPL Horizons, observer on the Moon at the site (`coord@301`, geodetic, ground altitude), apparent azimuth and elevation of the Sun (10) and Earth (399), airless, hourly.
5. Real sites have `illustrative: false` and a `source` line naming every dataset; the HUD shows it.
6. The script never prints raw data, only a summary (size, height range, horizon range, far-terrain azimuths, sunlit and Earth-in-view percentages).

## Numbers
| Name | Value | Unit | What to watch |
|---|---|---|---|
| Crop | 10.24 × 10.24 at 40 | km, m | Frame rate vs local detail |
| Far-horizon range | 450 [ASSUMPTION] | km | Nothing at Connecting Ridge beyond 99 km sets the horizon |
| Observer height | 2 | m | Same as the sim |
| Series | 60 days from 2027-03-01 [ASSUMPTION] | h | The planner will need about a year (≈ 400 KB per site) |
| Sites built | 1 of 3 | — | Connecting Ridge (89.45° S, 222.69° E) |

## Edge cases
- The site must sit at least 7.3 km from the edge of its 5 m DEM tile (half the crop's diagonal), or the script stops.
- Horizons responses and DEMs are cached in `data/raw/` (git-ignored); delete a file to re-fetch it.
- Season matters a lot: Connecting Ridge is sunlit 53% of 2027 overall, but 16 to 28% from March to June and up to 82% in October and November. The longest dark stretch in 2027 is 24.5 days.

## Open questions
- Which two other sites? The PGDA 5 m set also covers Shackleton rim, Peak near Shackleton, de Gerlache rim, Leibnitz beta plateau, Malapert massif, Nobile rim, Haworth and Shoemaker.
- Cross-check the illumination against the published PGDA illumination maps for the same site, for the debrief's "How it works" panel.

## History
- 2026-11-13: designed and first built for Connecting Ridge.
