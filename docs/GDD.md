# Crater Expectations — Game Design Document

**Version:** 0.4 (draft, open to change) · **Updated:** 2026-11-13 · [Features](#feature-index) · [Decisions](#decisions) · [Change log](#change-log) · [Architecture](ARCHITECTURE.md)

## Summary
You are the mission planner for a small lander going to the Moon's south pole. You choose where and when to land, plan the work around when the Sun and Earth are up, then watch the mission play out on real terrain while the battery drains in every shadow. A launch delay can change the sky and force you to replan. A mission ends when you survive the full window (stars for science collected compared with the best possible plan) or when the battery hits zero.

| | |
|---|---|
| Genre and camera | Planning and survival sim. Three.js 3D terrain drawn through a coloured ASCII shader; top-down camera by default, hero camera on `V` |
| Audience | Public, students and hackathon judges; casual. Also a "planner view" with raw numbers for experts |
| Platforms and input | Desktop browser, mouse and keyboard [ASSUMPTION: no mobile] |
| Session | One mission in 3 to 5 min; 3 missions about 15 min |
| Engine | Vite 8 + React 19 (UI) + three.js 0.187 (scene); see [Architecture](ARCHITECTURE.md) |
| Scope | Hackathon build, NASA Space Apps Cairo, 14-15 Nov 2026 |
| References | *FTL* (plan, then live with the consequences), *Mini Metro* (a clean, readable map), *Frostpunk* (a resource that drains when the environment turns) |

## Pillars
1. **Real sky, real stakes.** Every Sun and Earth position comes from NASA data (SPICE DE440, checked against JPL Horizons) and every horizon from LOLA terrain. Day and night are never made up for drama; anything illustrative is labelled "Illustrative".
2. **Decide, then live with it.** The plan is the game. Once you land, play is mostly watching and reacting, not twitch skill. That rules out combat and precision driving.
3. **Readable in 3 seconds.** Anyone looking at the screen can tell lit, dark and in-contact at a glance. Colour carries state (amber = sunlit, teal = Earth link, red = in shadow). The ASCII style is never allowed to hide that.
4. **Every phase playable before any polish.** Plan → Survive → Slip → Debrief works end to end with plain visuals before the shader, sound or extra missions get time.

## Core loop
```
Brief → Plan site + date → (Schedule tasks) → Survive the window → Debrief
              ▲                                      │
              └──────────── LAUNCH SLIP ◄────────────┘
```
- **Seconds:** watch the [surface view](features/surface-view/design.md); shadows sweep, the battery bar moves, countdowns tick; toggle the camera; pause or fast-forward.
- **Minutes:** a [survival](features/survival-sim/design.md) run of one mission; react to events (sunset, Earthset, low battery); possibly a launch slip that sends you back to the [planner](features/site-planner/design.md).
- **Session:** clear 3 missions, each teaching one new idea; replay for stars.

## Feature index

| Feature | Status | Scope | Summary | Docs |
|---|---|---|---|---|
| Site planner | built | MVP | Pick site + landing date; preview sun hours, Earth hours, longest dark; compare 3 side by side | [design](features/site-planner/design.md) |
| Survival sim | built | MVP | Hour-by-hour battery and comms from the real sun/Earth series; win by surviving, score by science | [design](features/survival-sim/design.md) |
| Surface view | built (top-down only) | MVP | Three.js LOLA terrain, Sun as shadow-casting light, ASCII shader, Sun/Earth compass; no hero camera | [design](features/surface-view/design.md) |
| Launch slip | built (mission 3: 5 days) | MVP | A delay of 3 to 12 days moves the landing date; 60 s to re-pick site or date | — |
| Debrief | built | MVP | Survived or not, stars, your plan vs the best automatic plan; "How it works" and "Data and credits" with the Horizons check | — |
| Data pipeline | built | MVP | Offline Python: LOLA crop → wide-DEM horizon mask → SPICE Sun/Earth series → Horizons check → site JSON | [pipeline](../pipeline/README.md) |
| Missions | built | MVP | M1 First Light (1 site, 7 days), M2 Call Home (2 sites, +schedule), M3 The Long Shadow (3 sites, +launch slip); unlocks and saved stars | — |
| Task schedule | built | should | Timeline of 6-hour blocks; paint Drill, Transmit, Sleep, Stay awake; live battery forecast | — |
| Solver | partly built | should | Searches all sites × landing days for the best automatic plan; gives stars and the debrief comparison. Does not search schedules | — |
| Rover trip | idea | should | Drive into a dark crater for ice, get back to light before the battery runs out | — |
| Audio | partly built | stretch | Event sounds synthesised in the browser, with volume and mute. No music loop | — |
| Planner mode | idea | stretch | No game wrapper: enter constraints and get the best site and date from the solver | — |

## Milestones
1. **M1, scene proof:** surface view with real terrain for 1 site, Sun light moving by the hour, plain shading · done when: the lander shows red in shadow at an hour where Horizons puts the Sun behind a ridge. *Built on the illustrative demo site 2026-11-13; the real-data half waits for the pipeline.*
1b. **M1b, ASCII look:** the coloured ASCII pass on the M1 scene · done when: the two M1 screenshots read as clearly in ASCII at 60 fps. *Done 2026-11-13: 144 fps with ASCII on, on the lead's laptop.*
2. **M2, the loop in grey:** site planner + survival sim + launch slip + debrief, 1 mission, 3 sites · done when: a teammate plays start to restart without help.
3. **M3, identity:** ASCII shader, colours, both cameras, missions 1 and 2 · done when: the M2 run looks like the target style at 60 fps on a team laptop.
4. **M4, ship:** Horizons check shown in the debrief, deployed public link, demo script · done when: the link works in a private window on another machine.

## Screens and flow
`Title → Mission select → Brief → Planner ⇄ (Slip) → Surface → Debrief → Mission select`. "How it works" can be opened from the Title and Debrief screens.

## Direction
- **Art:** coloured ASCII over lit 3D terrain. Palette navy `#0B1026` (space and shadow), amber `#F5A524` (sunlit, warnings), teal `#3FB6A8` (Earth, comms), grey `#C9CED6` (terrain, text). No NASA logos or insignia.
- **Feel:** calm and tense rather than loud. The big moments are sunrise over the ridge, losing Earth, and a low-battery alarm. Juice tiers follow the `game-feel` skill: small for ticks, medium for sunrise/Earthset, large for slip and power-down.
- **Accessibility:** state is never shown by colour alone (icons + text too); a reduce-flashing option; shake can be turned off.

## Decisions

| ID | Date | Decision | Alternatives considered | Why | Affects |
|---|---|---|---|---|---|
| D-001 | 2026-11-13 | Core = planning (Slip) + scheduling (Window) + survival (Ice Run) as phases of one mission, with missions as levels | Rover-only game; pure planning tool; fixed puzzle levels | Scores high on all five judging criteria; puts every challenge objective in the loop | All |
| D-002 | 2026-11-13 | Surface view is 3D three.js with detailed coloured ASCII; must ship | 2D sky strip only | Team wants it; it is the project's visual identity | Surface view |
| D-003 | 2026-11-13 | Two cameras: top-down default, hero on `V` | Top-down only; hero only | Top-down reads shadows and routes; hero shows Sun and Earth against the horizon | Surface view |
| D-004 | 2026-11-13 | ASCII pass moves from M3 to right after M1 (M1b) | Keep it in M3 after the grey loop | The team wants the ASCII look as the game's identity from the start; it is also the biggest frame-rate risk, so find out early | Milestones, surface view |
| D-005 | 2026-11-13 | SPICE (DE440) computes the Sun and Earth series; JPL Horizons only verifies them | Download the series from Horizons | One reproducible source for shipped numbers plus an independent check (0.00007° at every site) | Data pipeline, credits |
| D-006 | 2026-11-13 | The horizon mask comes from a wide LOLA DEM (to 250 km), the mesh from a 10 km crop | Mask from the mesh crop | At these sites the horizon is set by terrain up to 190 km away | Data pipeline, surface view |
| D-007 | 2026-11-13 | Proposed, needs the lead: sites are four high points found by searching LOLA (`ridge`, `spur`, `knoll`, `hollow`), window 60 days from 2026-12-01 | Cited candidate regions from the literature | Lets the game run on real data now; clearly labelled as the team's own picks | Missions, planner |
| D-008 | 2026-11-13 | Proposed, needs the lead: top-down view only; the hero camera (D-003) is dropped | Keep two cameras | The newer game spec asks for a strict top-down strategy map; a compass now shows Sun and Earth directions | Surface view |

## Open questions
- **Assumptions to confirm:** desktop only; all `[ASSUMPTION]` values in the feature notes; the sites and window in D-007; dropping the hero camera in D-008.
- **Known gaps:** no human playtest yet; no public deployment; no music; the Sun is a point (no partial disc); stars are measured against the automatic plan only.
- **Risks:**
  - *Tech:* ASCII shader + shadows at 60 fps: 144 fps on the lead's laptop (M1b); confirm on the slowest team laptop at M3.
  - *Data:* the Horizons series for a surface site, and the LOLA horizon, must match (the M1 done-when test).
  - *Design:* is watching the survival phase fun, or dead time? (playtest at M2; fallback: faster time, more events).
  - *Scope:* local event end time not known yet; see `JAM.md`.

## Change log
**0.1 (2026-11-13):** first draft from the planning chat; site planner, survival sim and surface view designed; D-001 to D-003 logged.
**0.2 (2026-11-13):** M1 scene proof built ([surface view](features/surface-view/implementation.md)); [Architecture](ARCHITECTURE.md) added with the site data format; M1b added and D-004 logged.
**0.4 (2026-11-13):** the loop is playable end to end on real data: planner, schedule, survival, launch slip, debrief, three missions, settings and sound; data pipeline built (LOLA terrain, SPICE sky, Horizons check); D-005 to D-008 logged. Not yet merged to `main`.
**0.3 (2026-11-13):** M1b ASCII pass built ([surface view](features/surface-view/design.md), ramp and cell size changed); 144 fps measured in a real browser, M1b done.
