# Build Status

**Updated:** 2026-11-13

## Current state
- **On `main`:** the original single-screen surface view (illustrative demo site). Nothing below is merged yet.
- **In open draft PRs:** a three-mission campaign that runs on real NASA data.
  - Terrain and horizons: NASA LOLA (`LDEM_85S_40M`, `LDEM_80S_80M`).
  - Sun and Earth: SPICE DE440, checked against JPL Horizons (largest difference 0.00007° at every site).
  - Screens: title, mission select, briefing, planner, task schedule, survival, debrief, settings, how it works, data and credits.
- **Renderer decision:** not formally approved. The existing three.js view is already top-down with the coloured ASCII pass, so the work so far kept it and did not migrate to Phaser. Dev 1 to confirm (see D-008 in `docs/GDD.md` on the campaign branch).
- **The M0 audit in `FIRST_SESSION_PROMPT.md` was not run as a separate step.** Work went ahead on stacked branches instead; treat the PR review as the checkpoint.

## Open pull requests and merge order
1. #2 `feat/dev3-setup`: pipeline scaffold and the working sim.
2. #6 `feat/dev4-full-campaign`: the campaign on real data. Contains everything in #4 and #5, which can then be closed.
3. #3 `chore/team-onboarding`: this kit and the team guide. Needs a conflict fix on `CLAUDE.md` and the two commands after #2 merges.

## Verified commands (on `feat/dev4-full-campaign`, 2026-11-13)
| Command | Result |
|---|---|
| `npm test` | 32 passed |
| `npm run build` | succeeds |
| `pytest pipeline/tests` | 12 passed |
| `pipeline/run_all.sh` | builds `ridge`, `spur`, `knoll`, `hollow`; every Horizons check passes |
| Browser (Chromium, 1366×768) | campaign flows played by an automated script with no console errors; see PR #6 for exactly what was and was not covered |

## Milestones
- [ ] M0 Repository recovery and audit: skipped as a formal step (see above)
- [x] M1 Stable game shell: in PR #6
- [~] M2 2D top-down ASCII map and planner: planner done; map is the existing three.js top-down ASCII view, not a new compositor; no isolated glyph-atlas proof was made
- [x] M3 Playable mission loop: in PR #6
- [x] M4 Data-integrated three-mission campaign: in PR #6, on sites the team picked from the terrain search
- [~] M5 Audio, accessibility, polish, and QA: event sounds, settings, keyboard controls and text-plus-icon states done; no music, no reduced-motion setting, no human playtest

## Blockers and decisions waiting on Dev 1
- Review and merge the PRs in the order above.
- Confirm or replace the four sites and the window (60 days from 2026-12-01). They are the team's own picks from `pipeline/scripts/candidates.py`, not official landing sites.
- Confirm the top-down-only view and no Phaser migration.
- D-008 to D-010 in `docs/DECISIONS.md`, and the open items in `pipeline/NOTES_FOR_TEAM.md`.

## Known gaps
- No human has played it start to finish; ASCII frame rate and the sounds are unchecked on real hardware.
- Not deployed; no slides or video.
- The Sun is treated as a point (no partial disc). Stars are measured against the best automatic plan only.
- `docs/ASSETS_AND_LICENSES.md` and `public/assets/credits/ASSET_CREDITS.md` are not filled in. The game currently ships no external art or audio files; data sources are credited in the README and the in-game credits screen.

## Next task
- Dev 1: review #2 and #6.
- Then: a human playtest of all three missions on a team laptop with ASCII on, and a public deployment.
