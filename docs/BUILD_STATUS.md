# Build Status

**Updated:** 2026-11-13

## Current state
- **On `main` (merged 2026-11-13, PR #8):** the full game on real NASA data.
  - Dev 1's Connecting Ridge (5 m LOLA terrain, sky from JPL Horizons) is used in all three missions.
  - `pipeline/` sites (SPICE sky checked against Horizons at 0.00007°): Polar spur, Massif shoulder, Low rise. All sites share one window, 60 days from 2027-03-01.
  - Screens: title, mission select, briefing, planner, task schedule, survival with rover and surface view, debrief, settings, how it works, data and credits.
- **Renderer:** three.js kept (no Phaser). Map view is top-down with ASCII glyphs; the rover's surface view (V) uses halftone dots.
- **The M0 audit in `FIRST_SESSION_PROMPT.md` was not run as a separate step.**

## Pull requests
- Merged: #8 (contains #2, #4, #5, #6, #7, which were closed as included).
- This PR (#3): team onboarding and the game kit.

## Verified commands (on `main` after PR #8, 2026-11-13)
| Command | Result |
|---|---|
| `npm test` | 46 passed |
| `npm run build` | succeeds |
| `pytest pipeline/tests` | 12 passed |
| `pipeline/run_all.sh` | builds `spur`, `massif`, `hollow`; every Horizons check passes |
| Browser (Chromium, 1366×768) | missions 1 and 2 won, mission 3 played through a slip, no console errors; see PR #8 for what was not covered |

## Milestones
- [ ] M0 Repository recovery and audit: skipped as a formal step (see above)
- [x] M1 Stable game shell: in PR #6
- [~] M2 2D top-down ASCII map and planner: planner done; map is the existing three.js top-down ASCII view, not a new compositor; no isolated glyph-atlas proof was made
- [x] M3 Playable mission loop: in PR #6
- [x] M4 Data-integrated three-mission campaign: in PR #6, on sites the team picked from the terrain search
- [~] M5 Audio, accessibility, polish, and QA: event sounds, settings, keyboard controls and text-plus-icon states done; no music, no reduced-motion setting, no human playtest

## Blockers and decisions waiting on Dev 1
- Which pipeline the team keeps (D-006 in `docs/GDD.md`), and the three `pipeline/` sites (D-008).
- The rover's second camera (D-009) and the dot style in the surface view.
- D-008 to D-010 in `docs/DECISIONS.md`, and the open items in `pipeline/NOTES_FOR_TEAM.md`.

## Known gaps
- No human has played it start to finish; ASCII frame rate and the sounds are unchecked on real hardware.
- Not deployed; no slides or video.
- The Sun is treated as a point (no partial disc). Stars are measured against the best automatic plan only.
- `docs/ASSETS_AND_LICENSES.md` and `public/assets/credits/ASSET_CREDITS.md` are not filled in. The game currently ships no external art or audio files; data sources are credited in the README and the in-game credits screen.

## Next task
- A human playtest of all three missions on a team laptop with ASCII on, including a rover ice run.
- Public deployment, slides and demo video.
