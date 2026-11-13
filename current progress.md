# Crater Expectations: handover notes

## Context

- Event: NASA Space Apps Challenge 2026, Cairo. Challenge resources open Fri 13 Nov 2026; the hackathon runs the weekend after.
- Challenge: Lunar Landing Site Navigator.
- Project: **Crater Expectations**, a browser game where you pick a Moon south pole landing site and date, watch the Sun and Earth move above the real horizon, and replan when the launch slips.
- Team: Mahmoud (lead) plus teammates including Ayman.
- Submitted form text (keep wording consistent everywhere):
  > 1) Problem: landing near the Moon's south pole depends on sunlight for power and a view of Earth for contact, but NASA's planning tools are hard for non-experts to use. 2) Idea: Crater Expectations, a browser game where you pick a landing site and date, watch the Sun and Earth move above the real horizon, and replan when your launch is delayed. 3) Build: we compute each site's horizon from real terrain, then make the game in React and three.js. 4) NASA data and tools: LOLA terrain, SPICE positions, JPL Horizons to check our results, and Moon Trek.

## Open questions (resolve before building on assumptions)

1. 2026 rules on NASA data: past years required *some* NASA data, not NASA-only. Get the organizers' answer in writing.
2. Is precomputing horizon masks and ephemeris before the event allowed? Ask organizers.
3. Scoring rules and win condition are NOT written yet. Draft them first (see Game design, "Scoring").
4. Launch and transit scenes are a proposal, not locked.

## Game design

### Core loop
1. Pick a site (south pole candidates) and a launch date.
2. Sky view: Sun and Earth move above a horizon computed from real LOLA terrain, with lunar curvature (R = 1737.4 km).
3. Manage power (needs Sun above local horizon) and comms (needs Earth above local horizon).
4. Curveballs force replanning: launch delay shifts the sky geometry.

### Events
Launch delay, low battery, comms lost, sunrise, sun behind ridge, mission success, power down. Each has a sound (see Audio).

### Modes
- Single player: mission planner.
- Two player: scientist (science value of site) vs engineer (power and comms margins). They must agree on a site and date.

### Scene flow (proposed, confirm with team)
1. **Start:** slow pan over a low-sun crater field, Earth a small dot on the horizon, amber title, menu for site, date, mode.
2. **Launch (~5 s):** dark screen, countdown with chosen date, rocket climbs through ASCII exhaust. Delayed date flashes HOLD and ticks forward.
3. **Transit:** starfield, Moon grows, time fast-forwards, status strip with battery and comms; a curveball can fire here.
4. **Descent:** camera drops over the ridge, grazing Sun, shadow sweeps the crater floor. First moment the horizon physics is visible.
5. **Surface (main screen):** lander on terrain, Sun arc and Earth dot above the horizon, lander turns red in shadow, time scrubber along the bottom, event cards pop with sound, pause to replan.
6. **End:** success summary with power and comms margins, or power-down screen.

### Scoring (draft, needs approval)
- Score = sunlit hours + Earth-visible hours over the first N days, minus penalties for battery depletion and comms gaps longer than a threshold.
- Win: survive the mission window with battery never at zero.
- Two-player: both roles see their own metric; the round ends when they lock the same site and date.

## Visual direction

- Target look: MMORPG-like 3D scene rendered as **coloured ASCII**, isometric camera (cube-diagonal view, not top-down). Reference was a "Hair Physics Test" reel by ansenjeo.
- Palette: navy `#0B1026`, amber `#F5A524`, teal `#3FB6A8`, grey `#C9CED6`.
- No NASA logo or meatball insignia; nothing implying NASA endorsement. Label any illustrative sky or sunlight visual "Illustrative".

### Selective GPU ASCII shader (core technique, already prototyped in chat)
- three.js r160, `WebGLRenderer`, `PCFSoftShadowMap`, `DirectionalLight` as the Sun.
- Two render targets per frame:
  - `rtS`: normal scene render.
  - `rtM`: mask pass. Swap materials: white `MeshBasicMaterial` for objects in `asciiObjs`, black for everything else. Restore after.
- Full-screen `ShaderMaterial` with uniforms `tScene`, `tMask`, `tGlyph`, `res`, `cell`.
  - Divide the screen into `cell`-sized blocks; sample scene colour at the block centre.
  - Luminance picks a glyph from the atlas; ramp `' .:-=+*#%@'`.
  - Where mask is white, output glyph tinted by scene colour; else output the plain scene pixel.
- Glyph atlas: draw the ramp into a 2D canvas, wrap as `CanvasTexture`, `NearestFilter`.
- Lander shadow test: `Raycaster` from lander toward Sun direction; if it hits terrain, tint lander red.
- Fallback if shader breaks: three.js `AsciiEffect` add-on with colour on (slower, full-screen only).

## Data pipeline (Python, offline, outputs JSON for the browser)

```
pipeline/
  01_fetch_lola.py        # LOLA south pole DEM tiles from NASA PGDA (pgda.gsfc.nasa.gov)
  02_crop_sites.py        # crop a window around each candidate site
  03_horizon_masks.py     # per site: max elevation angle per azimuth (e.g. 1 deg bins), with curvature drop d^2/(2R)
  04_ephemeris.py         # spiceypy + DE440 + moon_pa frame kernels: hourly Sun and Earth az/el per site
  05_visibility.py        # sunlit = sun_el > mask(az); earth_visible = earth_el > mask(az)
  06_validate.py          # compare against JPL Horizons for one site and date; report max error
  07_export_web.py        # public/sites/<id>.json: heightmap (downsampled), mask, hourly series
```

- Reference for south pole illumination: Mazarico et al. 2011.
- Moon Trek for site context and screenshots.
- Never let an agent read raw DEM or kernel files into context. Scripts only; inspect summaries.

## Web app

- Vite + React + three.js r160. Deploy as a static build on Vercel (`npm run build`, output `dist/`).
- Site JSON lives in `public/sites/`. Keep each file small (downsample heightmaps).
- Suggested layout:
```
src/
  main.jsx
  game/state.js          # phase machine: start, launch, transit, descent, surface, end
  game/events.js         # curveball scheduler
  render/scene.js        # terrain mesh from heightmap, lander, sun light, earth sprite
  render/ascii.js        # selective ASCII pass (above)
  render/camera.js       # isometric orthographic camera
  audio/audio.js         # Web Audio loader, state-triggered SFX
  ui/                    # menu, status strip, event cards, scrubber
pipeline/                # Python (above)
public/sites/  public/audio/
```

## Audio

Ready files (generated by `audio/make.py`, numpy synthesis, MP3 via ffmpeg):
`music_loop` (16 bars, 92 bpm, Am-F-C-G), `sfx_sunrise`, `sfx_sun_behind_ridge`, `sfx_low_battery`, `sfx_comms_lost`, `sfx_curveball_alarm`, `sfx_mission_success`, `sfx_power_down`.
- Put MP3s in `public/audio/`. Play through Web Audio; resume `AudioContext` on first user click.
- NASA audio (mission comms, countdowns) must be downloaded by a teammate; the sandbox could not reach nasa.gov. Radio filter for comms clips:
  `ffmpeg -i in.mp3 -af "highpass=f=300,lowpass=f=3000,acompressor,volume=1.5" out.mp3`
- Alternatives for more SFX: jsfxr, ZzFX, BeepBox, Tone.js.

## Existing assets (in the handover bundle)

- `deck/Crater_Expectations_Proposal.pptx` and `.pdf`: 12-slide proposal, built by `deck/build.js` (pptxgenjs). Team slide and names still missing. Figures from `deck/figs.py` are labelled illustrative.
- `audio/`: all generated sounds plus `make.py`.
- Promo video brief exists (max 90 s, palette above, no NASA logo, 1920x1080 MP4 + .srt). Not confirmed whether it was made.

## Build order

1. Scaffold Vite repo, port the selective ASCII shader on procedural terrain. Deploy to Vercel once to prove the pipeline.
2. Pipeline steps 01 to 05 for ONE site. Validate (06) before adding more sites.
3. Load real site JSON into the scene. Sun light direction from the hourly series.
4. Surface screen + time scrubber + event cards + audio.
5. Start, descent, end screens. Launch and transit last; cut them first if time runs short.
6. Two-player mode.

Cut list if behind: transit scene, launch scene, second and third sites, two-player mode. Never cut validation; a correct horizon is the pitch.

## Conventions

- Writing (deck, README, submission text): no em dashes, no AI-tell words, plain English.
- Commits: small, one feature each.
- Anything shown as sky or sunlight before real data is wired gets the "Illustrative" label.
