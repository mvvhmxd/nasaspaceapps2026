// Task schedule: the player's plan for the mission, in 6-hour blocks. Pure, no React.
// A block holds a mode from src/sim/survival.js MODES, or null for "automatic".
import { stateAt } from '../sim/visibility.js';
import { initialState, advance, MODES } from '../sim/survival.js';

export const BLOCK_H = 6;
export const TOOLS = [
  { mode: null, key: 'A', label: 'Automatic' },
  { mode: MODES.DRILL, key: 'D', label: 'Drill' },
  { mode: MODES.TRANSMIT, key: 'T', label: 'Transmit' },
  { mode: MODES.ASLEEP, key: 'S', label: 'Sleep' },
  { mode: MODES.AWAKE, key: 'W', label: 'Stay awake' },
];

export function emptySchedule(missionHours) {
  return new Array(Math.ceil(missionHours / BLOCK_H)).fill(null);
}

/** plan(hour, sky, state) for advance(): the scheduled mode for that hour, or null for automatic. */
export function planFrom(schedule, startHour) {
  return (hour) => schedule[Math.floor((hour - startHour) / BLOCK_H)] ?? null;
}

/** Sunlit and Earth-visible hours in each block, for the timeline rows. */
export function blockSky(site, startHour, missionHours) {
  const out = [];
  for (let b = 0; b * BLOCK_H < missionHours; b++) {
    let sun = 0, earth = 0, n = 0;
    for (let h = b * BLOCK_H; h < Math.min((b + 1) * BLOCK_H, missionHours); h++) {
      const s = stateAt(site, startHour + h);
      if (s.sunlit) sun++;
      if (s.earthVisible) earth++;
      n++;
    }
    out.push({ sun, earth, hours: n });
  }
  return out;
}

/** True when a scheduled task cannot run in any hour of its block (the sim would idle awake). */
export function isWasted(mode, sky) {
  return (mode === MODES.DRILL && sky.sun === 0) || (mode === MODES.TRANSMIT && sky.earth === 0);
}

/**
 * Run the whole mission with this schedule, using the same advance() the game uses.
 * Returns the final state, the battery % at the end of each block, the lowest battery %
 * and the hour (from landing) of a power down, or null.
 */
export function forecast(site, config, startHour, schedule) {
  const plan = planFrom(schedule, startHour);
  let state = initialState(config, startHour);
  const batteryPct = [];
  let minPct = 100;
  const blocks = schedule.length;
  for (let b = 0; b < blocks; b++) {
    if (!state.done) state = advance(site, state, BLOCK_H, plan).state;
    const pct = (100 * state.battery) / config.batteryCapacity;
    minPct = Math.min(minPct, pct);
    batteryPct.push(pct);
  }
  return { state, batteryPct, minPct, powerDownHour: state.alive ? null : state.hour - startHour };
}
