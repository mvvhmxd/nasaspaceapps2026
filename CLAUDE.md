# Crater Expectations – Team Guide

NASA Space Apps "Lunar Landing Site Navigator". Browser game: 2D top-down lunar
mission strategy with a mandatory coloured ASCII terrain map. Vite + React,
pure JS simulation, no backend, no AI in the product.
Loop: Plan → Survive → Slip → Debrief.

## ROLE SWITCH (check every message)
If a message starts with `dev1`, `dev2`, `dev3` or `dev4` (any case, optionally followed
by `:`), switch to that role for the rest of the session:
1. Show the role card below in one short block.
2. Apply that role's owned files, skills and checks from then on.
3. `dev4`: ask "Supporting Dev 1, 2 or 3 today?", then also apply that role's area.
4. Then do the rest of the message, if any.
If no role is set yet and the user asks for work, ask: "Which developer are you? dev1, dev2, dev3 or dev4?"
Suggest `/start` at the beginning of work and `/finish` at the end.

## Role cards

### dev1 – Lead / Integrator / Game Director (Mahmoud)
- Owns: `docs/` (GAME_SPEC, TECHNICAL_PLAN, DECISIONS, BUILD_STATUS, ASSETS_AND_LICENSES),
  `CLAUDE.md`, `.claude/`, `package.json`, `package-lock.json`,
  `src/game/config/campaign.js`, `src/game/config/missions.js`, PR review and merging.
- Does: milestone approval (one at a time), decisions in `docs/DECISIONS.md`, site and date picks,
  campaign/mission design, README/slides/video, AI-use disclosure, organizer questions.
- Skills: `game-director`, `asset-license-audit`, `qa-playtest`.
- Judging focus: Presentation, Relevance.

### dev2 – Frontend / Renderer
- Owns: `src/app/`, `src/screens/`, `src/components/`, `src/styles/`, `src/game/engine/`
  (2D map viewport, ASCII compositor), `public/assets/` (with licenses recorded), and the old
  `src/render/` until it is retired.
- Does: game shell and screens, planner and schedule UI, mission HUD, pause, debrief,
  settings, 2D map and ASCII compositor (quality presets + Off), accessibility, reduced motion.
  Playback dispatches one-hour sim steps only, never skipping hours.
- Skills: `ui-polish`, `ascii-rendering`, `asset-license-audit`.
- Judging focus: Impact, Creativity, UX.

### dev3 – Data + Simulation (Anas)
- Owns: `pipeline/`, `src/sim/` (except where shared below), `src/data/validateSite.js`,
  `src/game/state/`, `src/game/config/operations.js`, `src/game/config/balance.js`,
  `public/sites/`, `tests/sim/`, `tests/data/`.
- Does: LOLA DEM → local east/north frame → horizon mask (+ DEM shadow method or labelled schematic);
  SPICE ephemeris; Horizons validation; site JSON with provenance; deterministic `stepMission`,
  power, battery, operations, communications, scoring.
- Skills: `simulation-engine`, `nasa-data-integrity`.
- Judging focus: Validity (never cut).
- Rule: SPICE computes, Horizons verifies. Never invent a value.

### dev4 – Supporter (switches roles)
- Owns: nothing permanently. Each session, supports one of dev1/dev2/dev3 and follows that card.
- Before starting: tells the owner which task they're taking.
- Good tasks: turning `.todo` tests into real ones, QA playtests and bug reports, asset license
  checks, accessibility passes, Horizons spot checks, docs and screenshots, profiling on the slowest laptop.
- Skills: `qa-playtest`, `asset-license-audit`, plus the supported role's skills.
- Branches: `<type>/dev4-as-devN-<short-name>`. PR review by that role's owner **and** dev1.

## Shared files (change only when the owner + dev1 agree)
`CLAUDE.md`, `docs/GAME_SPEC.md`, `docs/TECHNICAL_PLAN.md`, `src/data/loadSite.js`,
`src/app/App.jsx` (or `src/App.jsx` until moved), `src/game/state/gameReducer.js`,
`src/sim/horizon.js`, `src/sim/visibility.js`, `tests/visibility.test.js`,
`package.json`, `package-lock.json`.
Dev 3 records open data/schema questions in `pipeline/NOTES_FOR_TEAM.md`.

## Sim ↔ UI contract (dev2 ↔ dev3)
- `createInitialState(site, missionConfig)` → `MissionState`
- `stepMission(state, input, site, missionConfig)` → next `MissionState` (exactly one hour)
- `previewStats(site, startIndex, durationHours)` → planner metrics
  (`sunlitPct`, `earthPct`, `longestDarkH`, `sunElAtLandingDeg`, `hoursToFirstSunset`,
  `hoursToFirstEarthset`)
- State fields follow `docs/TECHNICAL_PLAN.md` §4. Renderers read state, never compute truth.
Contract changes need dev2, dev3 and dev1 to agree.

## Project rules (from the kit; full text in docs/)
0. Art direction: 2D top-down with high-quality coloured ASCII terrain. The 3D hero camera is
   superseded. ASCII is mandatory, never a scope cut.
1. Read `docs/GAME_SPEC.md` and `docs/TECHNICAL_PLAN.md` before implementation.
2. Audit before editing. Never delete or replace working code without a written reason and a Git checkpoint.
3. Simulation and data processing stay pure, deterministic, tested, and separate from rendering/UI.
4. Real-data claims need source metadata and reproducible validation. Synthetic data is labelled
   `ILLUSTRATIVE` everywhere it appears.
5. Viewport is strictly 2D. The ASCII compositor is GPU-friendly 2D, not the old 3D post-process.
6. Never fabricate LOLA terrain, Horizons ephemerides, coordinates or NASA provenance.
7. No dead buttons, placeholder screens, broken routes or fake interactions in an accepted milestone.
8. One milestone at a time: finish, test, build, report, then wait for dev1's approval.
9. No dependency or architecture change without benefit, migration cost and fallback.
10. Every external asset and its license goes in `docs/ASSETS_AND_LICENSES.md` and
    `public/assets/credits/ASSET_CREDITS.md`.
11. Accessible without colour alone; respect reduced motion.
12. "Done" needs a production build **and** a browser playthrough, not just `npm run build`.

Working protocol, milestones (M0–M5) and current status: `docs/TECHNICAL_PLAN.md` §9 and
`docs/BUILD_STATUS.md`. Keep BUILD_STATUS and DECISIONS current; don't paste logs here.

## Git rules for Claude
- Never edit outside the current role's area without warning and naming the owner.
- Never commit kernels (`*.bsp`, `*.tpc`, `*.tls`, `*.bpc`, `*.tf`), DEMs, `data/raw/`, `.venv/`.
- Never commit, push or merge without the user's OK. Only dev1 merges.
- Branches: `<type>/devN-<short-name>`. Commits: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Commits use the developer's own git identity, with no AI co-author lines.
- Log AI use: `pipeline/AI_USE_LOG.md` (dev3) or `AI_USE_LOG.md` (everyone else). This is
  required for the submission's AI-use disclosure.
- Windows: if git isn't on PATH, use `& "C:\Program Files\Git\cmd\git.exe"`. If PowerShell blocks
  `npm`, use `npm.cmd`. Never work from `C:\Windows\System32`.
