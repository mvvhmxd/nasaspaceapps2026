// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is racing a sky that the terrain hides tense and readable, and does scouting from orbit make the landing choice feel like yours?
// Date: 2026-11-13
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
// The terrain comes from NASA LRO LOLA heights, smoothed for play by terrain_smooth (0 = the raw data); the
// Sun and Earth are JPL Horizons positions. Both are baked into assets/data/lola-site.js. The rover, power, science and score numbers below are a game model.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },
  music_volume: { value: 0.55, min: 0, max: 1, step: 0.05 }, // share of master volume for music
  voice: { value: 1, min: 0, max: 1, step: 1 },                     // 1: CAPCOM, CDR and LMP speak their radio lines (baked clips, assets/data/voice.js)
  voice_volume: { value: 0.8, min: 0, max: 1, step: 0.05 },        // speech loudness, share of master volume
  voice_static: { value: 0.05, min: 0, max: 0.3, step: 0.01 },     // open-channel hiss under a call
  voice_backlog: { value: 3, min: 1, max: 8, step: 1 },              // calls waiting before the oldest drop to text only
  launch_confirm: { value: 8, min: 2, max: 20, step: 1 },         // s: after the first ENTER at the lander, how long a second ENTER launches
  voice_crackle: { value: 6, min: 0, max: 30, step: 1 },           // crackle pops per second while a call is open

  // ---- time on the surface: the clock runs while you drive ----
  time_scale: { value: 0.15, min: 0.02, max: 1, step: 0.01 },     // mission hours per real second on the surface
  // ---- time costs (mission hours) ----
  survey_hours: { value: 2, min: 0.5, max: 6, step: 0.5 },        // one survey at an outcrop
  drill_hours: { value: 3, min: 1, max: 8, step: 0.5 },           // one drill core
  transmit_hours: { value: 1, min: 0.5, max: 4, step: 0.5 },      // one transmit burst at the dish
  wait_hours: { value: 1, min: 0.5, max: 4, step: 0.5 },          // Z: wait anywhere
  rest_hours: { value: 3, min: 1, max: 8, step: 0.5 },            // low-power wait at the array
  calibrate_hours: { value: 1, min: 0.5, max: 4, step: 0.5 },     // calibrate at the hab

  // ---- power (% of battery) ----
  battery_start: { value: 100, min: 20, max: 100, step: 5 },
  drain_base: { value: 1.0, min: 0, max: 5, step: 0.1 },          // %/h always
  drain_cold: { value: 1.3, min: 0, max: 5, step: 0.1 },          // %/h extra while you stand in shadow
  drain_drive: { value: 0.7, min: 0, max: 5, step: 0.05 },        // % per km driven
  rest_factor: { value: 0.3, min: 0, max: 1, step: 0.05 },        // drain multiplier during low-power wait
  charge_rate: { value: 3.2, min: 0, max: 10, step: 0.1 },        // %/h while the Sun clears the horizon at the lander array
  survey_cost: { value: 2, min: 0, max: 10, step: 0.5 },          // % per survey
  drill_cost: { value: 6, min: 0, max: 20, step: 0.5 },           // % per drill core
  drill_reserve: { value: 25, min: 0, max: 60, step: 5 },         // % needed before the drill will run
  transmit_cost: { value: 2, min: 0, max: 10, step: 0.5 },        // % per transmit burst

  // ---- science (points) ----
  survey_yield: { value: 12, min: 1, max: 50, step: 1 },
  calibrate_bonus: { value: 1.5, min: 1, max: 3, step: 0.1 },     // multiplier on the next survey
  drill_yield: { value: 18, min: 1, max: 60, step: 1 },
  psr_drill_mult: { value: 2.5, min: 1, max: 5, step: 0.1 },      // shadowed-crater drill multiplier
  transmit_rate: { value: 25, min: 1, max: 100, step: 1 },        // points sent per burst
  station_uses: { value: 2, min: 1, max: 5, step: 1 },            // times each outcrop / drill site pays

  // ---- terrain & landing (the terrain and sky come from real data) ----
  terrain_smooth: { value: 0.5, min: 0, max: 1, step: 0.05 },     // blend toward a smoothed copy of the LOLA heights (0 = raw data); on reload
  smooth_km: { value: 0.5, min: 0.1, max: 2, step: 0.05 },        // smoothing radius, km; on reload
  slope_max: { value: 0.6, min: 0.1, max: 2, step: 0.05 },       // steepest slope the rover climbs (rise/run)
  land_slope_max: { value: 0.3, min: 0.05, max: 1, step: 0.01 }, // steepest safe landing slope
  land_window: { value: 24, min: 0, max: 72, step: 2 },           // landing-hour window, h
  scrub_step: { value: 2, min: 1, max: 12, step: 1 },             // landing-hour scrub step, h
  slip_hours: { value: 12, min: 0, max: 48, step: 1 },            // Mission 3 launch slip
  hold_repeat: { value: 0.16, min: 0.05, max: 0.5, step: 0.01 },  // seconds between scout moves while a key is held
  // ---- planner mode ----
  plan_lapse: { value: 12, min: 1, max: 96, step: 1 },             // time-lapse speed, hours of sky per second
  plan_heat_ms: { value: 6, min: 1, max: 30, step: 1 },            // heat-map work per frame, ms

  // ---- the rover (distances in km, per real second) ----
  rover_speed: { value: 0.4, min: 0.05, max: 1.5, step: 0.05 },   // top speed, km per real second
  rover_accel: { value: 0.5, min: 0.05, max: 3, step: 0.05 },     // throttle, km/s²
  rover_brake: { value: 0.7, min: 0.05, max: 3, step: 0.05 },     // coasting / braking, km/s²
  rover_grav: { value: 0.25, min: 0, max: 2, step: 0.05 },        // how much a slope pulls you back (lunar g is gentle)
  rover_turn: { value: 75, min: 10, max: 200, step: 5 },          // steering, deg per second at speed
  rover_reverse: { value: 0.35, min: 0.1, max: 1, step: 0.05 },   // reverse top speed, share of top speed
  eye_h: { value: 0.0022, min: 0.001, max: 0.01, step: 0.0002 },  // camera height above the ground, km
  cam_tilt: { value: 0.3, min: 0, max: 1, step: 0.05 },           // how much the view pitches and rolls with the rover
  station_radius: { value: 0.22, min: 0.05, max: 1, step: 0.01 }, // how close counts as "at" a station, km
  board_radius: { value: 0.5, min: 0.1, max: 2, step: 0.05 },     // how close to the lander counts as aboard at departure, km
  oob_seconds: { value: 10, min: 1, max: 20, step: 0.5 },          // real seconds outside the mission area before the abort

  // ---- first-person visor view ----
  pov_fov: { value: 72, min: 40, max: 120, step: 2 },             // horizontal field of view, deg
  pov_deg_row: { value: 0.067, min: 0.02, max: 0.4, step: 0.001 }, // elevation deg per dot row (lower = taller relief)
  pov_horizon: { value: 0.55, min: 0.15, max: 0.8, step: 0.01 },  // where the 0° line sits, share of the view height
  turn_rate: { value: 90, min: 20, max: 360, step: 10 },          // ground view from the scout: look-around, deg per second
  sun_size: { value: 7, min: 1, max: 12, step: 0.5 },             // drawn Sun size vs true (0.5°), for readability
  earth_size: { value: 3.5, min: 1, max: 6, step: 0.5 },          // drawn Earth size vs true (1.9°), for readability
  light_step: { value: 0.25, min: 0.05, max: 2, step: 0.05 },     // Sun azimuth change (deg) that re-casts the shadows
  frost_start: { value: 45, min: 0, max: 100, step: 5 },          // battery % where frost starts creeping over the visor
  red_pulse: { value: 20, min: 0, max: 100, step: 5 },            // battery % where the visor edge pulses red
  subtitle_secs: { value: 6, min: 1, max: 20, step: 0.5 },        // how long a radio line stays on the visor

  // ---- the mission score: KPIs, their targets and what each is worth ----
  score_sent: { value: 1, min: 0, max: 5, step: 0.1 },            // points per science point that reached Earth
  score_crew: { value: 60, min: 0, max: 200, step: 5 },           // crew back aboard at ascent
  score_sun: { value: 0.4, min: 0, max: 2, step: 0.05 },          // per % of mission hours the lander's array saw the Sun
  score_earth: { value: 0.4, min: 0, max: 2, step: 0.05 },        // per % of mission hours the dish saw Earth
  score_batt: { value: 0.3, min: 0, max: 2, step: 0.05 },         // per % of the lowest battery reached
  score_lost: { value: 0.5, min: 0, max: 2, step: 0.05 },         // taken off per science point left unsent
  kpi_sent: { value: 100, min: 10, max: 400, step: 10 },          // target: science sent home per mission
  kpi_sun: { value: 70, min: 0, max: 100, step: 5 },              // target: % of hours the lander is sunlit
  kpi_earth: { value: 60, min: 0, max: 100, step: 5 },            // target: % of hours the dish sees Earth
  kpi_batt: { value: 25, min: 0, max: 100, step: 5 },             // target: lowest battery, %
  kpi_b: { value: 0.7, min: 0.3, max: 1, step: 0.05 },            // share of a target that still earns a B
  rate_director: { value: 800, min: 100, max: 2000, step: 25 },   // campaign score for FLIGHT DIRECTOR
  rate_planner: { value: 550, min: 100, max: 2000, step: 25 },    // ... MISSION PLANNER
  rate_reader: { value: 300, min: 50, max: 2000, step: 25 },      // ... HORIZON READER
  planner_cells: { value: 12, min: 1, max: 100, step: 1 },        // landable sites the debrief planner scores per frame

  // ---- danger and music thresholds ----
  dusk_hours: { value: 6, min: 1, max: 24, step: 0.5 },           // sunset this close turns the music to dusk
  danger_batt: { value: 30, min: 0, max: 100, step: 5 },          // battery % where the heartbeat starts
  danger_depart: { value: 8, min: 1, max: 24, step: 0.5 },        // departure this close (and you away from the lander) starts it too
  cut_landing: { value: 10, min: 3, max: 20, step: 0.5 },         // landing cutscene, seconds
  cut_launch: { value: 8, min: 3, max: 20, step: 0.5 },           // take-off cutscene, seconds
  cut_cam_dist: { value: 0.3, min: 0.05, max: 0.6, step: 0.01 }, // cutscene camera distance from the lander, km
  cut_alt: { value: 0.45, min: 0.1, max: 2, step: 0.05 },          // lander altitude when the descent shot opens, km
  obj_scale: { value: 3.5, min: 1, max: 6, step: 0.25 },          // stations, dish, array and lander drawn this much bigger in the visor, for readability
  obj_min_rows: { value: 12, min: 3, max: 30, step: 1 },           // smallest height (dot rows) a station is drawn at, however far
  cut_scale: { value: 7, min: 1, max: 8, step: 0.25 },          // how much bigger the lander is drawn in cutscenes, for readability
  walkthrough: { value: 1, min: 0, max: 1, step: 1 },              // 1: show the numbered tour in Mission 1 (H replays it)

  // ---- flown landing: the last few hundred metres are yours (0 plays the old landing cutscene) ----
  fly_landing: { value: 1, min: 0, max: 1, step: 1 },
  fly_alt: { value: 260, min: 80, max: 800, step: 10 },            // m above the pad when you take over
  fly_vz0: { value: 12, min: 0, max: 40, step: 1 },                // m/s, sink rate when you take over
  fly_drift: { value: 5, min: 0, max: 20, step: 0.5 },             // m/s, largest sideways drift at take-over (seeded)
  fly_offset: { value: 90, min: 0, max: 300, step: 10 },           // m, largest sideways miss at take-over (seeded)
  fly_g: { value: 1.62, min: 0.5, max: 5, step: 0.01 },            // lunar gravity, m/s²
  fly_thrust: { value: 4, min: 2, max: 10, step: 0.1 },            // m/s² at full throttle
  fly_throttle_rate: { value: 2.5, min: 0.5, max: 10, step: 0.5 }, // throttle change per second
  fly_tilt_max: { value: 25, min: 5, max: 45, step: 1 },           // deg, the most ← → tilts the lander
  fly_tilt_rate: { value: 30, min: 5, max: 120, step: 5 },         // deg/s, how fast it tilts
  fly_fuel: { value: 100, min: 10, max: 100, step: 5 },            // % descent fuel at take-over
  fly_burn: { value: 3.6, min: 0.5, max: 10, step: 0.1 },          // % fuel per second at full throttle
  fly_vz_max: { value: 2, min: 0.5, max: 6, step: 0.1 },           // m/s, fastest safe touchdown
  fly_tilt_safe: { value: 8, min: 2, max: 20, step: 1 },           // deg, most tilt at touchdown
  fly_vx_max: { value: 1.5, min: 0.2, max: 5, step: 0.1 },         // m/s, fastest safe sideways speed at touchdown
  fly_slope_max: { value: 0.27, min: 0.05, max: 0.6, step: 0.01 }, // rise/run under the feet (about 15°), from the LOLA heights
  fly_pad_m: { value: 30, min: 5, max: 100, step: 5 },             // m, beacon ring radius: inside counts as on the pad
  fly_score: { value: 40, min: 0, max: 150, step: 5 },             // points for a soft landing on the pad (half off it)
  fly_auto_pen: { value: 25, min: 0, max: 100, step: 5 },          // points the autopilot (TAB) costs
  fly_assist: { value: 1, min: 0, max: 1, step: 1 },              // 1: the computer brakes a fall you could not stop, and levels and steadies her in the last metres (free)
  fly_assist_alt: { value: 15, min: 0, max: 60, step: 1 },         // m, below this the assist levels the lander and kills drift whenever you let go of the tilt keys
  fly_crash_ends: { value: 0, min: 0, max: 1, step: 1 },           // 1: a touchdown outside the limits loses the lander; 0: a hard landing, no landing points, the mission goes on
  fly_lamp_m: { value: 70, min: 10, max: 300, step: 5 },           // m, landing-light pool on a shadowed pad
  fly_scale: { value: 2.5, min: 1, max: 8, step: 0.25 },           // lander drawn this much bigger in the descent view
  // ---- fragile cargo: samples on board crack on hard bumps ----
  cargo_jolt: { value: 0.016, min: 0.005, max: 0.08, step: 0.001 }, // bump strength where samples start to crack
  cargo_break: { value: 0.12, min: 0, max: 0.6, step: 0.01 },      // share of rock samples a bad bump breaks
  cargo_ice_mult: { value: 2.5, min: 1, max: 6, step: 0.1 },       // ice breaks this many times more easily
  // ---- solar storm (missions 2 and 3): a flare warning, then protons; shelter at the lander ----
  storm_chance: { value: 0.8, min: 0, max: 1, step: 0.05 },        // chance of a storm per mission (seeded)
  storm_lead_h: { value: 3, min: 0.5, max: 12, step: 0.5 },        // mission hours of warning before the protons arrive
  storm_hours: { value: 6, min: 1, max: 24, step: 0.5 },           // how long the storm lasts
  storm_dose: { value: 22, min: 1, max: 100, step: 1 },            // dose % per mission hour outside the shelter (100 ends the mission)
  shelter_radius: { value: 0.35, min: 0.05, max: 2, step: 0.05 },  // km from the lander that counts as sheltered
  // ---- dark crater runs ----
  lamp_range: { value: 0.35, min: 0.05, max: 1.5, step: 0.05 },    // km, headlight reach in shadow
  lamp_cone: { value: 50, min: 10, max: 120, step: 5 },            // deg, headlight beam width
  ping_range: { value: 1.2, min: 0.2, max: 4, step: 0.1 },         // km, scanner ping reach (Q)
  ping_speed: { value: 1.6, min: 0.2, max: 8, step: 0.1 },         // km/s, ping ring speed
  ping_cost: { value: 0.3, min: 0, max: 5, step: 0.1 },            // battery % per ping
  ice_count: { value: 5, min: 0, max: 12, step: 1 },               // hidden ice pockets round the cold-trap drill (seeded)
  ice_yield: { value: 14, min: 1, max: 60, step: 1 },              // points per ice pocket (fragile)
  ice_hours: { value: 0.5, min: 0.1, max: 3, step: 0.1 },          // mission hours to scoop one
  psr_cold_mult: { value: 2.2, min: 1, max: 6, step: 0.1 },        // cold drain multiplier inside permanent shadow
};

// The site: the southern Shackleton-Henson-de Gerlache ridge, "Connecting Ridge", one of NASA's 13 Artemis III
// candidate landing regions (2022). Real LOLA terrain: Shackleton's centre (89.67 S, 129.78 E) sits at km
// (-4, 8.5) and +x points toward de Gerlache crater (see assets/data/lola-site.js for the frame).
// Units: km. Map x grows right, y grows down. Azimuth 0 = map up, 90 = map right.
window.SITE = {
  cell_x: 0.3, cell_y: 0.5333,             // km per map cell (chars are 9x16 px)
  detail_amp: 0.004,                        // km of roughness added below the data's 40 m resolution (close-up view only)
  // stations, in map cells (col 0-99, row 0-25), placed on flat real ground
  survey: [[80, 2], [84, 3], [66, 1], [70, 7]],      // 2-3.4 km from the start zone, each lit at different hours
  drill: [[63, 2], [63, 6]],
  psr_drill: [[67, 4]],                     // in a permanently shadowed hollow 2.1 km from the start zone, 330 m below it
  start_cursor: [74, 4],                   // a ridge top lit in all three mission windows
  area: { x0: 0, y0: 0, x1: 29.7, y1: 13.3 }, // the mission area in km (the map); leave it and the 5 s countdown starts
  labels: [
    { text: 'SHACKLETON', c: 1, r: 17 }, { text: '(never sunlit)', c: 1, r: 18 },
    { text: 'CONNECTING RIDGE', c: 52, r: 9 }, { text: '(Artemis III candidate)', c: 52, r: 10 },
    { text: 'COLD TRAP (PSR)', c: 52, r: 5 },
    { text: 'DE GERLACHE >', c: 86, r: 0 },
  ],
};

// Missions: a real start date (UTC) for the sky, duration and briefing, and the difficulty, which climbs:
// where the scout starts (an imperfect site, for the planner to teach), starting battery %, a drain multiplier
// and the science-sent target.
window.MISSIONS = [
  { name: 'LEARN THE HORIZON', start: '2027-10-17T00:00Z', duration: 48,
    scout: [79, 2], battery: 100, drain: 1.0, kpi_sent: 60,     // starts on a half-lit spot one cell from full sun
    brief: 'CAPCOM: Welcome to Connecting Ridge, 17 October 2027. This ground comes from NASA laser altimetry of the ridge between Shackleton and de Gerlache craters, an Artemis III candidate region, smoothed a little so the rover can drive it. The Sun and Earth follow their real 2027 paths, and the Sun never climbs more than a degree and a half, so a ridge forty kilometres away can steal it. Fly the scout and watch the SKY strip: the Sun (*) and Earth (O) slide along the real skyline. Plant a flag with F where the Sun clears the ridge, scrub the landing hour with [ and ], then ENTER to land (V shows the ground view first). On the surface you drive the rover: W/S throttle, A/D steer, E to work a station. Survey outcrops only count in sunlight; the shadows move. Be back at the lander by departure, 48 hours. Your score is graded on science sent, crew home, sunlight and Earth link at your site, and battery margin. The scout starts over a half-lit spot: better ground is close.' },
  { name: 'GET IT HOME', start: '2027-10-21T00:00Z', duration: 72,
    scout: [81, 2], battery: 85, drain: 1.15, kpi_sent: 100,    // full sun, but Earth sinks behind the ridge after a day
    brief: 'CAPCOM: 21 October 2027. Data on your rover is worth nothing until the dish sends it, and this week Earth is sinking: libration is carrying it down toward the skyline. The dish [>] only transmits while Earth clears the ridge at the lander, so pick ground that keeps Earth longest. Drill sites need a 25% battery reserve. Bring the crew back to the lander by departure, 72 hours. Harder now: batteries at 85%, a hungrier rover, and the science target is 100.' },
  { name: 'THE TRADE-OFF', start: '2027-07-26T00:00Z', duration: 72,
    scout: [63, 1], battery: 70, drain: 1.3, kpi_sent: 140,     // a dark hollow: the light is 2-4 km away
    brief: 'CAPCOM: 26 July 2027, southern winter: the Sun barely scrapes the horizon and most of the ridge is dark for days. Earth is high, so the link is easy; power is the problem. The cold trap in the basin has not seen the Sun in billions of years, and a core from its floor pays two and a half times as much, but the cold drains your battery and your panels need light back at the lander. Choose your ground. Hardest yet: you start over a dark hollow with 70% battery, the cold bites harder, and the target is 140. Departure in 72 hours.' },
];

// Planner Mode (P on the title): the default date, the window lengths Y cycles through (h), the slip-test
// offsets (h), and landmarks added to the published sites N cycles through ([column, row] map cells).
window.PLANNER = {
  start: '2027-10-17T00:00Z',
  windows: [24, 72, 168, 354, 708],
  slips: [0, 24, 72, 168],
  extra_sites: [
    { name: 'MISSION 1 SCOUT START', tag: 'M1', cell: [79, 2] },
    { name: 'COLD TRAP DRILL (PERMANENT SHADOW)', tag: 'PSR', cell: [67, 4] },
  ],
  map_note: 'The baked map covers 30 x 14 km around 89.3-89.8°S on the connecting ridge.',
};

