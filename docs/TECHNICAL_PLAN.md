# Crater Expectations: Technical Plan

## 1. Technology direction

Target: desktop browser, 2D top-down gameplay, existing Vite + React project.

Preferred direction, subject to audit:
- Vite for the build and development server.
- React for title/menu/briefing/planner/schedule/HUD/pause/debrief/settings/help/credits and accessible DOM controls.
- Phaser 4.2.1 for the 2D map viewport, map interaction, camera pan/zoom, sprites, terrain overlays, effects, and transitions inside the viewport, if the repository audit supports migration.
- A required GPU-friendly 2D ASCII compositor for terrain / hillshade / contour imagery. Verify the exact custom-pipeline or render-texture API for the chosen engine version before implementation; do not assume API compatibility.
- Pure JavaScript simulation modules, independent of Phaser and React.
- Vitest for deterministic unit tests.

Do not migrate to Phaser just because this document recommends it. Audit the current implementation first. If retaining Three.js as a strict 2D orthographic renderer is materially safer and faster, explain why and keep it strictly 2D. Do not have Three.js and Phaser simultaneously render the same gameplay scene.

## 2. Core architectural boundary

```text
Site JSON + mission config + player commands
                   |
                   v
       Pure simulation / game rules
       - horizon / visibility
       - ephemeris time lookup
       - power / battery
       - operation scheduler
       - science buffer / transmission
       - mission state / scoring
                   |
          immutable game state
             /           \
            v             v
      React UI          2D map renderer
      menus / HUD       terrain / shadows
      schedule          ASCII compositor
      debrief           crisp markers / sprites
```

The renderer does not calculate truth. It receives state such as `sunVisible`, `earthVisible`, `batteryWh`, `solarPowerW`, `activeOperation`, and `missionPhase` from the simulation.

## 3. Proposed folder layout

Adjust to the actual repository rather than duplicating existing modules.

```text
src/
  app/
    App.jsx
    appReducer.js
    screenRegistry.js
  components/
    shared/
    hud/
    map/
  screens/
    TitleScreen.jsx
    MissionSelectScreen.jsx
    BriefingScreen.jsx
    PlannerScreen.jsx
    ScheduleScreen.jsx
    GameplayScreen.jsx
    DebriefScreen.jsx
    SettingsScreen.jsx
    HelpScreen.jsx
    CreditsScreen.jsx
  game/
    config/
      campaign.js
      missions.js
      operations.js
      balance.js
    engine/
      createGame.js
      scenes/
      map/
      effects/
      assetManifest.js
    state/
      createInitialState.js
      gameReducer.js
      saveGame.js
  sim/
    horizon.js
    visibility.js
    solarPower.js
    battery.js
    operations.js
    communications.js
    mission.js
    interpolate.js
  data/
    loadSite.js
    validateSite.js
  styles/
    tokens.css
    layout.css
    components.css
public/
  sites/
  assets/
    sprites/
    ui/
    audio/
    fonts/
    credits/
  data/
tests/
  sim/
  game/
  data/
scripts/
  data-pipeline/
docs/
  BUILD_STATUS.md
  DECISIONS.md
  GAME_SPEC.md
  TECHNICAL_PLAN.md
  ASSETS_AND_LICENSES.md
```

## 4. State model

Use one canonical game state. Suggested top-level fields:

```js
{
  version: 1,
  screen: 'title',
  campaign: { unlockedMissionIds: ['first-light'], completed: {} },
  settings: { masterVolume: 1, musicVolume: 0.5, sfxVolume: 0.8, reducedMotion: false },
  planner: { selectedSiteId: null, selectedStartIndex: null, pinnedChoices: [] },
  schedule: { operations: [] },
  mission: null
}
```

Mission runtime state should include:
- `missionId`, `siteId`, `startIndex`, `elapsedHours`, `durationHours`.
- `batteryWh`, `batteryCapacityWh`, `solarPowerW`, `baseLoadW`.
- current `sunAz`, `sunEl`, `earthAz`, `earthEl`.
- `sunVisible`, `earthVisible`.
- active / queued / completed / blocked operations.
- `scienceCollected`, `scienceBuffered`, `scienceReturned`.
- event log and deterministic run inputs.
- status: `running`, `paused`, `won`, `lost`.

Do not allow React components or Phaser scenes to mutate this state directly. Use explicit reducer actions / controller functions.

## 5. Tick model

Implement a deterministic `stepMission(state, input, site, missionConfig)` function that advances exactly one simulation hour. Use an outer real-time clock only to decide when to dispatch a simulation step.

- Paused means no step.
- 1x, 2x, 4x, 8x change real-time delay between steps, not the physics formula.
- Each step reads validated Sun/Earth sample(s), computes horizon visibility, operation progress, power balance, battery, communication, and mission terminal state.
- If any required sample is absent, stop with an explicit data-range error. Do not invent a value.
- UI can dispatch pause, resume, setSpeed, stepHour, addOperation, moveOperation, removeOperation, and acknowledgeAlert.

If interpolation is used between hourly samples for display, make it visual-only unless the simulation is explicitly upgraded to a validated sub-hourly series.

## 6. Map rendering

### Required visual layers
1. Terrain elevation / hillshade.
2. Contour lines and crater rim emphasis.
3. Terrain-derived sunlight / shadow overlay.
4. Site markers and selected-site ring.
5. Lander icon and heading marker.
6. Sun direction and Earth direction indicators.
7. Objective / drill target / operation markers.
8. Optional rover route only after the stretch feature is approved.

### Terrain data
- Read the site's explicit grid dimensions, spacing, min/max, encoding, row direction, and coordinate convention.
- Convert map coordinates consistently to screen coordinates.
- North is always the top of the map.
- Never infer missing map metadata.
- If no valid DEM exists, use a clearly labelled illustrative synthetic terrain texture.

### Shadow calculation
The current center-point horizon mask tells whether the Sun or Earth is visible from the lander's observer position. It does not automatically provide a physically correct shadow for every pixel in a large top-down map.

For a credible 2D shadow overlay, either:
- implement and test a DEM-based directional shadow calculation across the heightmap, including the documented curvature assumptions; or
- use a clearly labelled schematic / illustrative shadow overlay for the broad map while keeping the actual lander visibility calculation exact to the supplied horizon mask.

Do not paint visually convincing but scientifically false shadows and label them real. Cache shadow masks by site and ephemeris hour. Recompute only when the simulated Sun sample changes.

### 6.1 2D ASCII rendering pipeline (mandatory)

Implement this as a presentation layer over the ordinary 2D map. Keep all simulation calculations and source DEM arrays untouched.

1. **Base map pass:** draw terrain elevation, hillshade, contours, and only scientifically valid / explicitly labelled shadow imagery into a low-cost offscreen texture or equivalent render target.
2. **Glyph atlas:** create a texture atlas once from a bundled, license-checked monospace font. Include roughly 24 to 32 candidate glyphs. Measure/visually sort by ink coverage and validate at the target cell size. Cache the atlas; do not rasterize glyph strings every frame on the CPU.
3. **ASCII compositor:** use a fragment shader or comparable GPU path to sample the base map at a character-cell grid, compute luminance in a consistent colour space, select a glyph density tier, and tint the glyph using the source pixel's palette-mapped colour. Correct for glyph aspect ratio and device pixel ratio.
4. **Stable grid:** anchor the sampling pattern consistently to map/world coordinates where feasible. Camera pan must not cause random flicker, crawling, or unstable glyph substitution.
5. **Sharp overlay pass:** draw lander, site markers, objective markers, route/target icons, compass, labels, interactive hit targets, and all HUD / React DOM above the compositor. Do not ASCII-filter text or small iconography.
6. **Quality presets:** `High`, `Balanced`, `Performance`, and `Off`. Start near 8 / 10 / 12 CSS px cell sizes for the first three, but profile and tune. `Off` is a functional fallback, not a second simulation or alternate map.
7. **Lifecycle:** handle resize, DPR changes, WebGL context loss / restoration, texture disposal, and switching between planner and gameplay without leaks.
8. **Performance:** profile on the slowest actual team laptop. Prefer reducing offscreen resolution, shadow-map resolution, or ASCII detail before abandoning the core look. Keep a conventional 2D render fallback if WebGL features fail.

**Proof before full implementation:** create a small isolated test scene using a representative crater / ridge heightmap. Verify glyph coverage ordering, colour fidelity, stable panning, 1366×768 readability, and performance. Only then integrate it into the campaign map.

### 6.2 ASCII rendering tests
- Glyph atlas has a validated monotonically increasing ink-density order.
- Flat dark, flat bright, midtone, high-contrast ridge, and shadow-edge fixtures select expected density ranges.
- Screenshot output is deterministic for a fixed map and simulation state.
- Panning / zooming does not create distracting temporal shimmer.
- Resize and DPR changes rebuild render targets correctly and dispose old resources.
- Quality preset and Off toggle preserve map interactions and simulation state.
- HUD and all DOM text remain crisp and are not captured by the ASCII pass.
- Performance is recorded at each quality level on the nominated reference laptop.

## 7. Site data contract

Retain the existing schema if it validates correctly. Add `schemaVersion` and provenance as needed.

Required metadata:
- id, name, latitude, longitude.
- coordinate reference / convention and units.
- `illustrative` boolean.
- source names and exact source URLs.
- original data product / version or retrieval date.
- grid dimensions, spacing, row orientation, encoding, min/max and units.
- horizon observer height and curvature model.
- ephemeris start UTC, step interval, target, observer/location definition, and requested quantities.
- equal array lengths for all time-series fields.

For real sites, `illustrative: false` is permitted only when the input data provenance can be verified. A JSON file alone is not proof that its numbers are NASA data.

## 8. Suggested tests

### Simulation
- Azimuth normalization and 359° / 1° interpolation.
- Horizon-mask wraparound interpolation.
- Sun blocked by ridge even when elevation is above 0°.
- Earth blocked by ridge independently of Sun.
- No sun means zero solar generation.
- Sun above a clear horizon yields non-negative solar generation.
- Battery clamping at zero and capacity.
- Energy unit consistency in Wh.
- Transmission blocked without Earth visibility.
- Buffered science remains buffered when no link exists.
- Transmit moves data only when a link is valid.
- Operations respect duration, energy, prerequisites, and mission time.
- Mission win / loss and star scoring.
- Deterministic replay.

### UI / integration
- Screen route changes and back navigation.
- Planner selection changes mission inputs.
- Pinned comparisons add / remove correctly.
- Schedule changes actual mission operations.
- Pause freezes simulation time.
- Speed controls change real-time stepping correctly.
- Restart clears runtime state but preserves appropriate campaign unlocks.
- Save migration handles missing / old fields.
- No button without a real action.

## 9. Milestone plan

**Milestone 0: Repository recovery and audit**
- Inspect and document current state. No edits until approved.
- Run current test and build commands.
- Identify working pure simulation and data modules.

**Milestone 1: Stable game shell**
- Implement title, mission select, briefing, settings, how-to-play, credits, and navigation.
- Establish visual tokens and transitions.
- No fake buttons.
- App still builds and opens directly to title screen.

**Milestone 2: 2D top-down map and planner**
- Render one verified or clearly illustrative terrain map.
- Pan / zoom, select sites, choose dates, preview metrics, pin comparisons.
- Validate all previews with pure simulation tests.

**Milestone 3: Playable mission loop**
- Operation scheduler, battery simulation, Sun/Earth visibility, science buffer, transmission, pause, time speeds, event feed, debrief.
- Use one mission and synthetic fixture data first. Complete the full loop.

**Milestone 4: Data-integrated three-mission campaign**
- Integrate verified site data and ephemeris series.
- Add mission-specific configurations and launch slip.
- Add provenance and data explainer.

**Milestone 5: Production polish and QA**
- Audio, animations, accessibility, save/progression, performance, bug fixes, complete browser playthrough.
- Release candidate is a working browser build, not a store submission.

Do not start the next milestone until the current one meets its acceptance checks.
