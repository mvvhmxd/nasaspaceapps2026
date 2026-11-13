// Survival sim: pure functions, no three.js. Steps ONE hour at a time and never
// skips, so fast-forward (4x/16x) still gets every event.
import { stateAt } from './visibility.js';
import { SIM_CONFIG } from './config.js';

export const MODES = { AWAKE: 'awake', ASLEEP: 'asleep', DRILL: 'drilling', TRANSMIT: 'transmitting' };

/** Starting state for a mission. startHour = landing hour in the site series. */
export function initialState(config = SIM_CONFIG, startHour = 0) {
  return {
    config,
    startHour,
    hour: startHour,
    battery: config.batteryCapacity,
    store: 0,
    score: 0,
    mode: MODES.AWAKE,
    alive: true,
    done: false,
    prevSunlit: null,
    prevEarth: null,
    firedLow: [],
  };
}

/** Automatic mode choice (design rule 8). */
function autoMode(s, sky, cfg) {
  if (sky.sunlit && s.store < cfg.storeSize) return MODES.DRILL;
  if (sky.earthVisible && s.store > 0) return MODES.TRANSMIT;
  if (!sky.sunlit) return MODES.ASLEEP;
  return MODES.AWAKE;
}

/** Advance one hour. Returns the new state and the events from that hour. */
function step(site, s, plan) {
  const cfg = s.config;
  const sky = stateAt(site, s.hour);
  const events = [];
  const n = { ...s, firedLow: [...s.firedLow] };

  if (s.prevSunlit !== null && sky.sunlit !== s.prevSunlit) events.push(sky.sunlit ? 'sunrise' : 'sunset');
  if (s.prevEarth !== null && sky.earthVisible !== s.prevEarth) events.push(sky.earthVisible ? 'earthrise' : 'earthset');
  n.prevSunlit = sky.sunlit;
  n.prevEarth = sky.earthVisible;

  let mode = (plan && plan(s.hour, sky, s)) || autoMode(s, sky, cfg);
  if (mode === MODES.DRILL && (!sky.sunlit || s.store >= cfg.storeSize)) mode = MODES.AWAKE;
  if (mode === MODES.TRANSMIT && (!sky.earthVisible || s.store <= 0)) mode = MODES.AWAKE;
  n.mode = mode;

  let delta = sky.sunlit ? cfg.chargeSunlit : 0;
  delta -= mode === MODES.ASLEEP ? cfg.drainAsleep : cfg.drainAwake;
  if (mode === MODES.DRILL) { delta -= cfg.extraDrainDrill; n.store += 1; }
  if (mode === MODES.TRANSMIT) { delta -= cfg.extraDrainTransmit; n.store -= 1; n.score += 1; }
  n.battery = Math.max(0, Math.min(cfg.batteryCapacity, s.battery + delta));

  const pct = (100 * n.battery) / cfg.batteryCapacity;
  for (const t of cfg.lowBattery) {
    if (pct < t && !n.firedLow.includes(t)) { n.firedLow.push(t); events.push('battery' + t); }
    if (pct >= t && n.firedLow.includes(t)) n.firedLow = n.firedLow.filter((x) => x !== t); // re-arm
  }

  n.hour = s.hour + 1;
  if (n.battery <= 0) {
    n.alive = false; n.done = true; n.store = 0; // held data is lost
    events.push('powerDown');
  } else if (n.hour - s.startHour >= cfg.missionHours || n.hour >= site.series.sunAz.length) {
    n.done = true;
    events.push('success');
  }
  return { state: n, events: events.map((type) => ({ hour: s.hour, type })) };
}

/**
 * Advance up to `hours` hours (stops early when the mission ends).
 * plan(hour, sky, state) → mode | null overrides the automatic mode.
 */
export function advance(site, state, hours = 1, plan) {
  let s = state;
  const events = [];
  for (let i = 0; i < hours && !s.done; i++) {
    const r = step(site, s, plan);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
