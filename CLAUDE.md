# Crater Expectations: team guide for Claude

Browser game for the NASA Space Apps "Lunar Landing Site Navigator" challenge.
Static site (Vite + React + three.js). **No backend server, no AI in the product.**
Loop: Plan → Survive → Slip → Debrief. Read docs/ARCHITECTURE.md for the site JSON contract.

## First thing every session
If the user hasn't said who they are, ask: **"Which developer are you: 1, 2 or 3?"**
Show their role card below, then suggest running `/start`.

## Role cards

### Dev 1: Lead / Integrator (Mahmoud)
- **Owns:** `docs/`, `tests/visibility.test.js`, `package.json`, PR review and merging
- **Does:** shared contract decisions, picks sites and dates, README/slides/video, AI-use disclosure, organizer questions
- **Judging focus:** Presentation, Relevance

### Dev 2: Frontend
- **Owns:** `src/render/`, `src/ui/`, `src/App.jsx`, `src/styles.css`, `src/theme.js`
- **Does:** planner screen, survival HUD, playback (must call `advance(site, state, N)`, never skip hours), debrief, accessibility
- **Judging focus:** Impact, Creativity, UX

### Dev 3: Data + Sim (Anas)
- **Owns:** `pipeline/`, `src/sim/config.js`, `survival.js`, `planner.js`, `solver.js`, `tests/sim/`
- **Does:** LOLA DEM → local east/north frame → horizon mask; SPICE ephemeris; Horizons validation; export `public/sites/<id>.json`; game logic
- **Judging focus:** Validity (never cut). **SPICE computes, Horizons verifies.**

## Shared files (change only after the owner and Dev 1 agree)
`docs/ARCHITECTURE.md`, `src/data/loadSite.js`, `tests/visibility.test.js`, `package.json`, `package-lock.json`, `src/App.jsx`, `src/sim/horizon.js`, `src/sim/visibility.js`.
Open decisions live in `pipeline/NOTES_FOR_TEAM.md`.

## Sim API (Dev 2 ↔ Dev 3 contract)
```js
previewStats(site, startHour, lengthH) → { sunlitPct, earthPct, longestDarkH, sunElAtLanding,
  hoursToFirstSunset, hoursToFirstEarthset, exceedsSleepBudget }
initialState(config?, startHour?) → SimState
advance(site, state, hours, plan?) → { state, events: [{hour, type}] }
// event types: sunrise, sunset, earthrise, earthset, battery25, battery10, powerDown, success
```

## Rules for Claude
- Don't edit files outside the current developer's area. If a change is needed there, say so and name the owner.
- Never commit kernels, DEMs or `data/raw/`.
- Never commit, push or merge without the user's OK. Only Dev 1 merges to `main`.
- Branches: `feat/devN-<short-name>`. Commits: conventional (`feat:`, `fix:`, `chore:`, `docs:`).
- Log AI use: `pipeline/AI_USE_LOG.md`.
- On Windows, if git isn't on PATH use `& "C:\Program Files\Git\cmd\git.exe"`.
