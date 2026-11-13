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
