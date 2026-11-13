# Decisions Dev 3 needs from the team

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Add `maskSource: "local" \| "wide"` to site JSON; strict mask tests only for `local` | Dev 1 | open |
| 2 | Add `schemaVersion` + range checks (NaN, az 0–360, stepHours) in `loadSite.js` | Dev 1 | open |
| 3 | Partial Sun disc (~0.53°) → partial charge? Design says no for MVP | Dev 1 | open |
| 4 | Which 3 sites (cited coordinates: Artemis III regions / CLPS) | Dev 1 | open |
| 5 | Mission window dates | Dev 1 | open |
| 6 | Playback 4×/16× must call `advance(site, state, N)` (now in `src/sim/survival.js`) | Dev 2 | ready to use |
| 7 | GDD says positions come *from* Horizons; change to "SPICE computes, Horizons verifies" | Dev 1 | open |

## 2026-11-13: ephemeris is real and validated
- SPICE (DE440) Sun/Earth az/el matches JPL Horizons to 0.00007 deg at two test points (`pipeline/validation/`).
- Blocking the first real site file: (a) Dev 1's 3 site coordinates with citations and the start date; (b) LOLA terrain download source (Moon Trek / PDS product ID and URL) for the horizon mask; (c) site JSON needs provenance fields (`schemaVersion`, `maskSource`, kernel list, validation result).
- Frame note: site coordinates are read as planetocentric, east-positive, in the Moon mean-Earth/polar-axis frame (`MOON_ME`), the same convention as LOLA products.

## 2026-11-13 (later): terrain is real too
- All seven stages run. `public/sites/ridge.json`, `spur.json`, `knoll.json`, `hollow.json` are real LOLA terrain + real horizon + SPICE sky validated against Horizons, with `illustrative: false`.
- **Dev 1 decides:** (a) keep these four sites or replace them (they are our own picks from `scripts/candidates.py`, window 60 days from 2026-12-01); (b) accept the new site JSON fields `schemaVersion`, `maskSource`, `blurb`, `terrain`, `sky` and document them in `docs/ARCHITECTURE.md`; (c) whether to model the Sun's 0.5 deg disc as partial light.
- **Dev 2:** the on-map 3D shadows only know the 10 km crop, so they can disagree with the sim when a ridge farther away blocks the Sun. The sim's SUNLIT / IN SHADOW is authoritative. The render check moved behind `?debug`.
- `public/sites/demo.json` is still used by `tests/visibility.test.js` but no mission uses it.
