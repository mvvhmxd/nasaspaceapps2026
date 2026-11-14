// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is racing a sky that the terrain hides tense and readable, and does scouting from orbit make the landing choice feel like yours?
// Date: 2026-11-13
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
// ALL NUMBERS ARE ILLUSTRATIVE: a playable model of the south-pole lighting problem, not a flight prediction.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },
  music_volume: { value: 0.55, min: 0, max: 1, step: 0.05 }, // share of master volume for music

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

  // ---- terrain & sky model ----
  colat: { value: 0.55, min: 0, max: 2, step: 0.05 },             // site distance from the pole, degrees
  sun_rate: { value: 0.508, min: 0.1, max: 3, step: 0.01 },       // Sun azimuth deg/h (360 deg per 708.7 h synodic day)
  lib_amp: { value: 6.5, min: 0, max: 10, step: 0.1 },            // Earth elevation libration amplitude, deg
  lib_lon_amp: { value: 7.0, min: 0, max: 10, step: 0.1 },        // Earth azimuth libration amplitude, deg
  lib_period: { value: 655, min: 100, max: 1000, step: 5 },       // hours (~27.3 days)
  slope_max: { value: 0.45, min: 0.1, max: 2, step: 0.05 },       // steepest slope the rover climbs (rise/run)
  land_slope_max: { value: 0.22, min: 0.05, max: 1, step: 0.01 }, // steepest safe landing slope
  land_window: { value: 24, min: 0, max: 72, step: 2 },           // landing-hour window, h
  scrub_step: { value: 2, min: 1, max: 12, step: 1 },             // landing-hour scrub step, h
  slip_hours: { value: 12, min: 0, max: 48, step: 1 },            // Mission 3 launch slip
  hold_repeat: { value: 0.16, min: 0.05, max: 0.5, step: 0.01 },  // seconds between scout moves while a key is held

  // ---- the rover (distances in km, per real second) ----
  rover_speed: { value: 0.4, min: 0.05, max: 1.5, step: 0.05 },   // top speed, km per real second
  rover_accel: { value: 0.5, min: 0.05, max: 3, step: 0.05 },     // throttle, km/s²
  rover_brake: { value: 0.7, min: 0.05, max: 3, step: 0.05 },     // coasting / braking, km/s²
  rover_grav: { value: 0.35, min: 0, max: 2, step: 0.05 },        // how much a slope pulls you back (lunar g is gentle)
  rover_turn: { value: 75, min: 10, max: 200, step: 5 },          // steering, deg per second at speed
  rover_reverse: { value: 0.35, min: 0.1, max: 1, step: 0.05 },   // reverse top speed, share of top speed
  eye_h: { value: 0.0022, min: 0.001, max: 0.01, step: 0.0002 },  // camera height above the ground, km
  cam_tilt: { value: 0.3, min: 0, max: 1, step: 0.05 },           // how much the view pitches and rolls with the rover
  station_radius: { value: 0.22, min: 0.05, max: 1, step: 0.01 }, // how close counts as "at" a station, km
  board_radius: { value: 0.5, min: 0.1, max: 2, step: 0.05 },     // how close to the lander counts as aboard at departure, km
  oob_seconds: { value: 5, min: 1, max: 20, step: 0.5 },          // real seconds outside the mission area before the abort

  // ---- first-person visor view ----
  pov_fov: { value: 72, min: 40, max: 120, step: 2 },             // horizontal field of view, deg
  pov_deg_row: { value: 0.1, min: 0.03, max: 0.4, step: 0.01 },   // elevation deg per dot row (lower = taller relief)
  pov_horizon: { value: 0.55, min: 0.15, max: 0.8, step: 0.01 },  // where the 0° line sits, share of the view height
  turn_rate: { value: 90, min: 20, max: 360, step: 10 },          // ground view from the scout: look-around, deg per second
  sun_size: { value: 7, min: 1, max: 12, step: 0.5 },             // drawn Sun size vs true (0.5°), for readability
  earth_size: { value: 3.5, min: 1, max: 6, step: 0.5 },          // drawn Earth size vs true (1.9°), for readability
  light_step: { value: 0.25, min: 0.05, max: 2, step: 0.05 },     // Sun azimuth change (deg) that re-casts the shadows
  frost_start: { value: 45, min: 0, max: 100, step: 5 },          // battery % where frost starts creeping over the visor
  red_pulse: { value: 20, min: 0, max: 100, step: 5 },            // battery % where the visor edge pulses red
  subtitle_secs: { value: 6, min: 1, max: 20, step: 0.5 },        // how long a radio line stays on the visor

  // ---- danger and music thresholds ----
  dusk_hours: { value: 6, min: 1, max: 24, step: 0.5 },           // sunset this close turns the music to dusk
  danger_batt: { value: 30, min: 0, max: 100, step: 5 },          // battery % where the heartbeat starts
  danger_depart: { value: 8, min: 1, max: 24, step: 0.5 },        // departure this close (and you away from the lander) starts it too
  cut_landing: { value: 10, min: 3, max: 20, step: 0.5 },         // landing cutscene, seconds
  cut_launch: { value: 8, min: 3, max: 20, step: 0.5 },           // take-off cutscene, seconds
};

// The site: a hand-shaped model of the Shackleton rim / Connecting Ridge area (illustrative).
// Units: km. Map x grows right, y grows down. Azimuth 0 = map up, 90 = map right.
window.SITE = {
  cell_x: 0.3, cell_y: 0.5333,             // km per map cell (chars are 9x16 px)
  shackleton: { x: -4, y: 6.5, r: 10.5, depth: 4.2, rim: 0.8 },
  ridge: { x0: 6.5, y0: 6.5, x1: 34, y1: 2.0, h: 0.5, w: 2.6 },
  terrace: { x: 19, y: 10.8, r: 2.6, depth: 0.6, rim: 0.25 },
  far: [ // distant features that make the skyline
    { name: 'MASSIF', x: 44, y: 41.5, h: 2.7, s: 7 },
    { name: 'WEST RIM', x: -22.6, y: 20.7, h: 2.1, s: 8 },
    { name: 'NORTH HILLS', x: 32, y: -40, h: 2.3, s: 9 },
  ],
  small_craters: 14,
  noise_amp: 0.055,
  // stations, in map cells (col 0-99, row 0-25)
  survey: [[40, 9], [78, 7], [50, 22], [90, 21]],
  drill: [[31, 18], [86, 13]],
  psr_drill: [[63, 20]],
  start_cursor: [52, 13],
  area: { x0: 0, y0: 0, x1: 29.7, y1: 13.3 }, // the mission area in km (the map); leave it and the 5 s countdown starts
  labels: [
    { text: 'SHACKLETON', c: 2, r: 11 }, { text: '(never sunlit)', c: 2, r: 12 },
    { text: 'CONNECTING RIDGE', c: 44, r: 11 },
    { text: 'THE TERRACE', c: 58, r: 24 },
  ],
};

// Missions: sky phase, duration and briefing. Sun azimuth at mission hour 0, solar declination,
// Earth libration phase (hours) and azimuth.
window.MISSIONS = [
  { name: 'LEARN THE HORIZON', duration: 48, sun_az0: 120, decl: 1.35, earth_az: 250, lib_phase: 76, lib_lon_phase: 0,
    brief: 'CAPCOM: Welcome to the south pole. Up here the Sun never climbs more than a couple of degrees, so a ridge forty kilometres away can steal it. Fly the scout and watch the SKY strip: the Sun (*) and Earth (O) slide along the real skyline. Plant a flag with F where the Sun clears the ridge, scrub the landing hour with [ and ], then ENTER to land (V shows the ground view first). On the surface you drive the rover with your commander beside you: W/S throttle, A/D steer, E to work a station. The clock runs while you drive. Survey outcrops only count in sunlight; the shadows move. Be back at the lander by departure, 48 hours, or the ascent stage leaves without the science. Stay inside the mission area.' },
  { name: 'GET IT HOME', duration: 72, sun_az0: 175, decl: 1.0, earth_az: 250, lib_phase: 289, lib_lon_phase: 160,
    brief: 'CAPCOM: Data on your suit is worth nothing until the dish sends it. Earth is sinking toward the west rim this week. The dish [>] only transmits while Earth clears the skyline at the lander, so higher ground keeps Earth longer. Drill sites need a 25% battery reserve. Bring the crew back to the lander by departure, 72 hours.' },
  { name: 'THE TRADE-OFF', duration: 72, sun_az0: 112, decl: 0.7, earth_az: 250, lib_phase: 26, lib_lon_phase: 320,
    brief: 'CAPCOM: The Terrace has not seen the Sun in two billion years. A core from its frozen floor pays two and a half times as much, but the cold drains your battery and your panels need light back at the lander. Sun is low this season. Choose your ground. Departure in 72 hours.' },
];
