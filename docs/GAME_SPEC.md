# Crater Expectations: Game Design and Product Specification

**Version:** 1.1 handoff draft  
**Target:** NASA Space Apps Cairo 2026 playable submission  
**Format:** Desktop browser game, 2D top-down strategy / survival simulation  
**Current priority:** One complete, polished campaign that can be played from title screen to final debrief.  
**Out of scope for this phase:** Steam release, monetization, multiplayer, mobile-first controls, 3D free-camera mode.

---

## 1. Product vision

**One-sentence pitch:** You are the mission planner for a lunar south-pole lander. Choose where and when to land, schedule science around real sunlight and Earth-contact windows, then keep the lander alive when the Moon's terrain cuts it off from power or mission control.

**Player fantasy:** I am responsible for a fragile mission in an unforgiving place. I study a map, make a plan, watch the environment change, and feel the consequences of my decisions.

**Design promise:** Every important gameplay condition has a visible scientific explanation. The Sun is not a random day/night cycle. Earth is not a generic radio icon. The local terrain controls both visibility and shadows.

**Important distinction:** This is an educational strategy game, not a flight-certified mission planning tool. Use real public datasets where available, expose assumptions, and never imply engineering certification.

## 2. Design pillars

1. **Science creates the challenge.** Real topography and ephemeris data drive visibility and lighting. Synthetic data is clearly labelled.
2. **Every choice has a consequence.** Site and landing time affect power, communication, task timing, and mission score.
3. **The player makes meaningful decisions.** Planning, scheduling, and reacting matter. Do not make the player merely watch a clock.
4. **Readable at a glance.** Battery, solar generation, Earth link, current task, and next environmental event are understandable within seconds.
5. **Complete before enormous.** A small campaign with real beginning, middle, and end is better than many disconnected half-built systems.
6. **Recognizable visual identity.** The lunar world uses a premium coloured ASCII treatment over a true 2D top-down map. It must look intentional, detailed, stable, and readable, not like a low-resolution terminal filter.

## 3. Audience and session

- Primary audience: general public, students, educators, hackathon judges, and space enthusiasts.
- Expected first playthrough: 10 to 15 minutes for the three-mission campaign.
- One mission: about 3 to 5 minutes including briefing and debrief.
- Desktop browser, keyboard and mouse. The interface should still resize gracefully to narrower screens, but mobile optimization is not required for the challenge build.
- The player should be able to understand the controls without reading a long manual.

## 4. Game loop

`Title → Campaign / Mission Select → Briefing → Site and Date Planner → Mission Schedule → Mission Simulation → Victory or Failure Debrief → Next Mission / Replay`

A launch delay is a mission event that returns the player to the planner with a changed earliest landing date. The player must decide whether to keep the site and change the date or move to a different candidate site.

### 4.1 Planning loop

1. Read the mission objective and constraints.
2. Inspect three candidate landing sites on a north-up lunar map.
3. Select a landing date from the mission's allowed window.
4. Compare predicted sunlight, Earth visibility, and longest continuous darkness.
5. Select a site and date.
6. Arrange science and communication operations in the mission schedule.
7. Start the mission.

### 4.2 Survival loop

1. The simulation advances through mission time using precomputed Sun and Earth positions.
2. The map updates terrain illumination and the lander's lighting state.
3. The player watches battery energy, solar input, Earth link, task state, and the next event.
4. The player can pause, change time speed, modify future operations, and respond to alerts.
5. Operations consume energy and produce science data. Data must be transmitted during a valid Earth link window to count as returned science.
6. The mission ends when the full mission duration is reached or the battery reaches zero.

## 5. Main screen flow and requirements

Every screen below must be reachable and functional. No fake buttons or placeholder cards are acceptable in the final milestone.

### 5.1 Boot / loading

- Show the game title and a short loading indicator.
- Load configuration, campaign progress, asset manifest, and selected site data.
- Display an understandable error screen if a required data file fails validation.
- Do not silently fall back from real data to illustrative data. Explicitly show the data mode.

### 5.2 Title screen

- Large title: **CRATER EXPECTATIONS**.
- Subtitle: **A lunar survival planning game**.
- Main actions: `Start Campaign`, `Continue`, `Mission Select`, `How to Play`, `Settings`, `Credits`.
- Continue is disabled only when no save exists.
- Background: stylized topographic south-pole map with slow, subtle lighting motion. No NASA insignia or copied NASA mission patches.
- Include a visible `DATA MODE` label when the build uses illustrative data.

### 5.3 Campaign / mission select

- Three missions shown as cards with title, one-sentence story, key challenge, completion state, and best rating.
- Missions unlock sequentially in campaign mode. A mission can be replayed after unlocking.
- A `Free Play / Sandbox` mode is optional and should only be added after the campaign works.
- The player can see which mission is next and return to the title screen.

### 5.4 Mission briefing

Show:
- Mission name and narrative briefing.
- Primary objective and optional bonus objective.
- Mission duration in simulated hours.
- Key constraint, such as low Sun angle, limited Earth contact, or long darkness.
- Candidate landing region and the reason it matters.
- Expected tutorial concept.
- `Proceed to Planner` and `Back` controls.

Keep the briefing short enough to scan in 15 to 25 seconds.

### 5.5 Site and date planner

This is a real decision screen, not a static illustration.

**Layout:**
- Main panel: north-up 2D lunar topographic map.
- Side panel: candidate site list, selected site details, date selector, metric preview.
- Bottom comparison tray: up to three pinned site/date choices.
- Clear legend for elevation, shadow, lander, sunlight direction, and Earth direction.

**Interactions:**
- Click a site marker to select it.
- Pan and zoom the map.
- Select a date from the mission's allowed landing window.
- Pin up to three site/date scenarios for comparison.
- Remove a pinned scenario.
- Select one scenario and continue.

**Preview metrics:**
- Sunlit duration and percentage during the mission.
- Earth-visible duration and percentage.
- Longest continuous darkness.
- Sun elevation at landing.
- Time to the next local sunset.
- Time to the next Earthset / loss of direct link.

**Comparison:** Highlight best values, but do not imply that one metric alone determines the best site. Show the assumptions and whether the data is real or illustrative.

**Date handling:** Disable dates whose complete mission window falls outside the supplied ephemeris series. Never extrapolate missing data without an explicitly documented method.

### 5.6 Mission schedule

The player arranges operations on a simple 24 to 48 hour timeline before launch. Keep drag-and-drop optional; keyboard-accessible buttons to add, move, and remove tasks are required.

Operation cards:

| Operation | Purpose | Conditions | Gameplay effect |
|---|---|---|---|
| Survey | Capture a terrain / horizon survey | Requires operational lander; sunlight increases science yield if configured | Adds science data to buffer |
| Drill Sample | Collect a subsurface sample | Requires energy reserve and available mission time | Adds high-value science data and consumes significant energy |
| Calibrate | Prepare instruments | Requires energy and a free time slot | Unlocks / improves later survey yield |
| Transmit | Send buffered science to mission control | Can complete only while Earth is above the local terrain horizon | Moves buffered data to returned data |
| Sleep / Low Power | Preserve energy | Always available | Reduces non-essential power draw |

Operations have duration, base power draw, science yield, and prerequisites stored in `src/game/config/operations.js`. Do not hardcode separate copies of these values in UI components.

The scheduler must detect overlapping operations, impossible operation windows, and transmissions outside predicted Earth-contact windows. Show a warning and a proposed next valid window rather than silently dropping a task.

### 5.7 Main gameplay screen

**This is the primary game screen. It must look and feel like a strategy game.**

**Map viewport:**
- 2D, north-up, top-down lunar terrain.
- The landing site and lander are always easy to locate.
- Use the LOLA-derived heightmap as the terrain source where available.
- Use hillshade / contours / elevation tint to make craters and ridges readable.
- Render the terrain through the high-quality coloured ASCII treatment specified in Section 8. This is a core visual identity, not an optional stretch feature.
- A Sun direction indicator and Earth direction indicator sit on the map edge or compass ring.
- Terrain shadow regions update when the simulated Sun changes.
- Task target, rover route, landing marker, and sites use separate iconography.
- Map pan and zoom must not move the HUD or make the lander impossible to find. Provide a `Center on Lander` action.

**HUD:**
- Mission clock: current mission elapsed time and total duration.
- Battery: current Wh and percentage, with a trend indicator.
- Power: current solar generation in W and current load in W.
- Sun: elevation, azimuth, and `SUNLIT` / `IN SHADOW` state.
- Earth: elevation, azimuth, and `LINK AVAILABLE` / `NO DIRECT LINK` state.
- Current operation and its progress.
- Science data: collected / buffered / returned.
- Next event countdown: sunset, Earthset, sunrise, Earthrise, low battery, or task completion.

**Player controls:**
- Pause / resume.
- Simulation speed: 1x, 2x, 4x, and 8x.
- Step one simulation hour while paused.
- Open operation schedule and adjust future commands.
- Open event log.
- Open help / scientific explanation panel.
- Open settings / pause menu.

**Alerts:**
- Sunrise / sunset.
- Earthrise / Earthset.
- Battery below 30%, 15%, and 5%.
- Operation blocked or completed.
- Transmission completed / link lost.
- Launch slip and replanning request.

Alerts should be informative, brief, and non-blocking except for decisions that genuinely require player input.

### 5.8 Pause menu

- Resume.
- Restart mission, with confirmation.
- Controls / help.
- Settings.
- Quit to mission select, with confirmation if progress will be lost.

Pause must freeze simulation time, not merely hide the overlay.

### 5.9 Victory / failure debrief

Show a mission story outcome, not only a raw score.

- `MISSION COMPLETE` or `MISSION LOST`.
- Time survived.
- Remaining battery.
- Total sunlight and Earth contact observed.
- Science collected, transmitted, and lost / still buffered.
- Objectives completed.
- Important decisions and key event timeline.
- 0 to 3 stars, with transparent rules.
- Compare actual result to a simple best-known or baseline strategy only if the solver has genuinely computed it. Otherwise do not claim it is optimal.
- Buttons: `Retry`, `Continue Campaign` when unlocked, `Mission Select`, `Main Menu`.

Suggested star logic:
- 1 star: survive the full mission duration.
- 2 stars: complete the primary objective and return at least the mission's stated fraction of science data.
- 3 stars: complete the bonus objective and finish above the mission's battery reserve threshold.

Tune the thresholds per mission. Display them in the briefing so the scoring is fair.

### 5.10 Settings

- Master volume, music volume, sound effects volume.
- Mute toggle.
- Reduced motion.
- Reduced flashes / no screen shake.
- Colour-safe status mode or high contrast mode.
- UI text scale.
- Keybind reference.
- Reset settings.

Persist settings locally. Do not start audio before a user gesture if the browser blocks autoplay.

### 5.11 How to play / science guide

Short interactive explanations:
- Why the lunar south pole has unusual low-angle sunlight.
- Why a ridge can hide the Sun even when the Sun is geometrically above the flat horizon.
- Why direct Earth communication can be blocked by local terrain.
- Why battery capacity and task scheduling matter.
- What the simulation simplifies.

Use plain language, diagrams, and one concrete example. Link data provenance and methods from the debrief / credits.

### 5.12 Credits and data provenance

- Game team credits.
- Engine and library credits.
- All external art / music / sound / font assets and licenses.
- NASA, JPL, LRO / LOLA and other data references that were actually used.
- AI assistance disclosure, completed by the team according to event rules.
- Never imply NASA endorsement.

---

## 6. Campaign design

The campaign has three short missions. It should teach one new strategic constraint at a time.

### Mission 1: FIRST LIGHT

**Teaching goal:** Sun angle, terrain horizon, and battery survival.

- Duration: 24 simulated hours.
- Start with a single candidate site and a narrow date choice to reduce cognitive load.
- Primary objective: complete instrument calibration and at least one survey.
- Bonus: finish with the configured reserve battery threshold.
- Introduce solar generation, local terrain shadow, pause, and time speed.
- Tutorial prompts can be dismissed and replayed.

### Mission 2: CALL HOME

**Teaching goal:** Earth visibility and communication windows.

- Duration: 36 simulated hours.
- The site/date introduces at least one Earth-contact window and one gap in direct communication.
- Primary objective: collect and transmit the required amount of science data.
- Bonus: transmit all buffered science before mission end.
- Explain that no direct link means data is queued, not magically transmitted.
- Introduce the mission event feed and schedule adjustment.

### Mission 3: THE LONG SHADOW

**Teaching goal:** Multi-constraint site/date planning and launch delay.

- Duration: 48 simulated hours, or shorter only if required by the available verified data series.
- Present three contrasting candidate scenarios: a promising ridge, a site with a communication trade-off, and a visually attractive but long-darkness trap. Names and coordinates must be based on selected sources, not invented as real targets.
- Player compares up to three site/date combinations.
- A scripted launch slip moves the earliest landing date by a documented number of days within the precomputed data window.
- Player gets a clear replan screen and must preserve the site or choose a new one.
- Primary objective: survive and return the required science data.
- Bonus: complete the drill sample while meeting the energy reserve.

**Stretch only after all three missions work:** a rover expedition to a permanently shadowed region, with explicit travel distance, rover power, route risk, and return-to-lander requirement. Do not let this delay the complete three-mission campaign.

---

## 7. Simulation rules and gameplay formulas

All values below are game tuning values unless explicitly sourced as physical data. Put tuning values in one configuration module. Never present them as real spacecraft hardware specifications.

### 7.1 Time

- Site ephemeris is sampled from the validated hourly series.
- The game clock can advance at 1x, 2x, 4x, and 8x.
- Pausing freezes all simulation effects.
- Step-forward advances one discrete simulation hour.
- Interpolate angles carefully across the 0° / 360° boundary. Do not linearly interpolate 359° to 1° through 180°.
- Do not advance beyond the validated time range.

### 7.2 Local horizon and visibility

For azimuth `az`, interpolate the local terrain horizon from the 360-element horizon mask.

- Sun is visible only if `sunElevation > terrainHorizonAt(sunAzimuth)`.
- Earth is visible only if `earthElevation > terrainHorizonAt(earthAzimuth)`.
- The Moon has no atmosphere for this simplified game model. Do not add terrestrial atmospheric refraction.
- Use the same azimuth convention everywhere: clockwise from lunar north, in degrees.
- `0°` is north, `90°` east, `180°` south, `270°` west.

### 7.3 Solar power

Use a transparent, simplified energy model:

`solarPowerW = panelRatedPowerW × max(0, dot(panelNormal, sunDirection)) × panelEfficiency × sunVisible`

For a fixed horizontal panel, the incidence term is `max(0, sin(sunElevation))`. If the terrain horizon blocks the Sun, `sunVisible = 0`.

`batteryNextWh = clamp(batteryWh + (solarPowerW - baseLoadW - activeOperationLoadW) × deltaHours, 0, batteryCapacityWh)`

- Unit-test the sign, units, clamp, zero-sun, and energy conservation cases.
- Show actual current solar generation and load in the HUD.
- Keep tuning values fictional and clearly labelled as gameplay parameters.

### 7.4 Communication and science data

- Earth contact is determined from the Earth elevation compared with the local terrain horizon at Earth azimuth.
- A transmit operation can make progress only during a valid direct Earth link.
- If Earth is hidden, science remains in a local buffer.
- Mission scoring distinguishes collected science from science returned to mission control.
- The model is direct-to-Earth only. Do not imply relay satellite coverage unless a relay system is implemented and documented.

### 7.5 Operations

Each operation has:
- ID and display name.
- Duration in simulation hours.
- Base power load in W.
- Prerequisites.
- Start conditions.
- Science yield or communication throughput.
- Failure / interruption behavior.
- Player-facing explanation.

An operation that is blocked must show why. Do not silently skip it.

### 7.6 Mission termination

- Mission succeeds if the mission duration ends and the primary objective is met.
- Mission fails if battery energy reaches zero before the mission ends, unless a mission-specific rescue rule is explicitly introduced.
- Mission debrief always runs after success or failure.
- The player can retry without losing campaign unlock progress.

### 7.7 Determinism

- No random changes to Sun, Earth, terrain, or mission physics.
- Any optional narrative variation must use a seeded RNG.
- Same site, date, schedule, and player commands should produce the same outcome.
- Save enough data to reproduce a mission result for debugging.

---

## 8. Art direction and presentation

**Style:** lunar cartography meets a premium mission-control interface. It should feel atmospheric, quiet, deliberate, and tense.

**Palette:**
- Deep navy background: `#0B1026`.
- Warm amber sunlight / warning: `#F5A524`.
- Teal Earth link / comms: `#3FB6A8`.
- Regolith / text neutral: `#C9CED6`.
- Shadow / inactive: dark blue-grey.
- Critical failure: restrained red, paired with a text label and icon.

**Terrain:**
- Use the actual DEM values for shape, slope, contours, and hillshade where available.
- Keep north at the top by default.
- Avoid stretching terrain vertically to make craters look dramatic. Any exaggeration must be a labelled optional visualization mode and must not alter simulation calculations.
- Use clear contour lines, crater rims, elevation tint, and subtle noise. Do not rely on a generic starfield to fill the map.

**Lander:** custom readable top-down vector sprite or a carefully adapted CC0 asset. The lander must remain visible against light and dark terrain.

**Map overlays:** distinct layers for sunlight, shadow, terrain, sites, objectives, routes, lander, Sun direction, and Earth direction. Each layer can be toggled where appropriate.

### 8.1 Signature 2D coloured ASCII rendering (mandatory)

The game is a **2D north-up top-down strategy game**, not a 3D scene. The lunar map itself must have a high-quality coloured ASCII look inspired by carefully art-directed terminal/cartographic imagery. The ASCII treatment is a core visual feature and must be present in the planner map, mission map, and title-screen map backdrop. It must not obscure the terrain, gameplay state, or scientific data.

**Rendering approach:**
- Render the 2D terrain, hillshade, contours, and scientifically supported shadow layer into an offscreen texture or equivalent render target.
- Run a GPU-friendly WebGL fragment/compositing pass that samples the terrain image by character cells, estimates luminance, selects a glyph from a prebuilt glyph atlas, and tints it using the underlying terrain colour and the game's navy / amber / teal palette.
- Build a glyph atlas from a bundled, license-checked monospace font. Use a curated set of approximately 24 to 32 glyphs ordered by measured ink density, from nearly empty to visually dense. Do not assume character order equals ink density; measure or visually validate it.
- Keep glyph cells aspect-correct. A glyph must not be stretched into a square if the source font is rectangular.
- The default target cell size is approximately 10 CSS px, with quality choices around 8 px (fine detail), 10 px (default), and 12 px (coarser / faster). Re-evaluate on the real target laptop and at device-pixel ratios other than 1.
- Use stable sampling / grid anchoring so glyphs do not shimmer or crawl when the map camera pans or the simulation advances. Avoid frame-to-frame dithering noise.
- Preserve ridge and crater readability with contour emphasis, local contrast, tone mapping, and carefully tuned glyph transitions. Avoid turning the entire scene into uniform speckle or a generic green terminal screen.
- The glyph choice comes from rendered visual intensity, while colour communicates game state: warm amber for lit terrain, deep navy for shadow, restrained grey for regolith, teal for Earth / comms overlays, and red only for critical lander state.
- The lander, selected site ring, mission markers, route/target icons, compass, labels, and all HUD / menu text render sharply above the ASCII terrain. They are not passed through the ASCII compositor.
- The Sun's terrain illumination and shadow layer update from simulation state. The ASCII compositor visualizes those layers; it never calculates whether the Sun or Earth is visible.
- Provide `High`, `Balanced`, and `Performance` ASCII quality presets and an `Off` accessibility/performance fallback. `Off` shows the same 2D terrain, palette, contours, and gameplay information with conventional shading. ASCII is on by default and is not removed from the intended art direction.
- The game must remain legible and functional when ASCII is disabled. Pair every colour-coded state with labels, shapes, or icons.

**Do not:**
- Build a 3D ASCII shader or restore the old Three.js hero camera.
- Perform per-pixel or per-character CPU processing every frame if a GPU path is available.
- Apply the ASCII pass to React menus, small text, accessibility labels, or the entire HUD.
- Generate unstable random glyph noise or use glyphs with unverified / inconsistent visual density.
- invent shadow detail: visual shadows must follow the documented DEM calculation or be labelled schematic / illustrative as described in the technical plan.

**Acceptance tests:**
- The same screenshot is visually stable across repeated renders with the same state.
- Camera panning does not cause distracting glyph shimmer.
- Ridges, crater rims, lander, site markers, Sun/Earth directions, and shadow boundaries remain identifiable at 1366×768.
- HUD, menus, and text remain crisp and screen-reader accessible.
- Toggle and quality controls work and persist.
- The map meets the game's performance floor on the slowest target laptop; otherwise reduce render-target scale / cell detail before removing the ASCII identity.
- The no-ASCII fallback preserves the exact simulation state and all interactions.


**Animation:**
- Soft panel transitions, map marker pulses, task progress, event notifications, battery warning pulse.
- Smooth camera pan and zoom.
- Subtle terrain illumination transition when simulation hour advances.
- No excessive screen shake, flicker, or constant particle noise.

**Typography:** use one display face and one highly readable UI face at most. Bundle font license files.

**Responsive behavior:** support 16:9 desktop first. At smaller sizes, preserve the map and place HUD panels in collapsible drawers rather than hiding key metrics.

---

## 9. Audio direction

The game should feel calm and isolated, with tension introduced by the mission systems.

**Music layers:**
1. Main menu: low, spacious ambient theme.
2. Planning: restrained atmospheric pulse, low volume.
3. Mission: evolving ambient bed, minimal percussion.
4. Low battery / critical warning: music becomes more tense but must not drown UI audio.
5. Debrief: short resolution cue.

**Sound effects:**
- UI hover / click / confirm / back.
- Site selection and date pin.
- Mission start.
- Lander system online.
- Sunrise / sunset alert.
- Earth link acquired / lost.
- Operation started / completed / blocked.
- Low battery warning.
- Mission success / failure.

**Implementation rules:**
- Use separate master, music, and SFX volume controls.
- Avoid autoplay until a user gesture.
- Music loops must have no obvious click at the loop point.
- Do not play an alert every simulation tick. Use cooldowns and event transitions.
- Keep sound optional and ensure the game is playable muted.
- Record asset source and license before shipping.

---

## 10. Accessibility and usability

- Every critical colour state also has a label, shape, or icon.
- Keyboard focus must be visible.
- All important controls have keyboard equivalents.
- Use semantic HTML controls for React HUD and menu elements.
- Pause and settings work with keyboard.
- Support reduced motion and reduced flashes.
- Keep important text legible over map imagery.
- Do not encode success, failure, or link state by colour alone.
- Tooltips must not be the only source of essential information.
- Provide a short first-run tutorial and a replayable help screen.

---

## 11. Save and progression

Persist locally:
- Campaign mission unlocks.
- Completed mission best rating.
- Best score and mission configuration.
- Audio and accessibility settings.

Do not persist a mission in a way that creates a corrupt or unrecoverable state. Use versioned save data with safe defaults and a reset option.

---

## 12. Definition of done

The game is accepted only when all of these are true:

### Product completeness
- [ ] A user can open the game and reach the title screen.
- [ ] All menu actions work.
- [ ] All three campaign missions are playable from briefing to debrief.
- [ ] Site/date selection and comparison affect the actual mission simulation.
- [ ] The schedule screen changes which operations execute and when.
- [ ] Sun visibility, Earth visibility, battery, operations, science buffer, and transmissions affect mission outcome.
- [ ] Pause truly freezes simulation time.
- [ ] Victory and failure debriefs work and offer retry / continue.
- [ ] Settings change and persist their values.
- [ ] Credits and data provenance screens are present.

### Science integrity
- [ ] Real and illustrative data are distinguishable in the UI.
- [ ] Every real dataset has source, product/version, units, coordinate convention, and generation steps recorded.
- [ ] Visibility uses local terrain horizon, not a flat zero-degree assumption.
- [ ] Earth visibility and Sun visibility are independently tested.
- [ ] Mission date cannot access missing ephemeris samples.
- [ ] The game explains simplifications and does not claim engineering certification.

### Engineering quality
- [ ] Unit tests cover horizon interpolation, azimuth wrap, visibility, solar power, battery update, task conditions, transmission queue, mission result, and save migration.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Browser console has no uncaught errors.
- [ ] No broken asset requests.
- [ ] Game can be played from a fresh private browser window.
- [ ] A full campaign has been manually played at least once.

### Presentation quality
- [ ] No placeholder screens or visible debug labels in normal play.
- [ ] Loading, empty, error, pause, success, and failure states are designed.
- [ ] Audio levels are balanced and settings work.
- [ ] Map, HUD, and typography are legible at 1366×768 and 1920×1080.
- [ ] The mandatory coloured 2D ASCII terrain treatment is enabled by default, with stable glyphs, readable crater detail, crisp non-ASCII HUD/markers, functioning quality controls, and a tested fallback.
- [ ] The first 30 seconds teach the player what to do.

---

## 13. Explicitly out of scope until MVP is accepted

- Steam, monetization, store pages, achievements, cloud saves, DRM, or publishing strategy.
- Multiplayer, leaderboards, live services, user accounts, backend servers.
- Fully free 3D camera, 3D lander movement, combat, crafting, base building. (The 2D coloured ASCII terrain treatment is required, not out of scope.)
- Procedural random lunar geography presented as scientific data.
- Multiple rover missions before the three core missions are complete.
- Voice acting or generated voiceovers.
- Large asset packs that are not used in the game.
