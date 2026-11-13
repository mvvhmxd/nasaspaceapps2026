import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { SIM_CONFIG } from '../../src/sim/config.js';
import { initialState, advance, MODES } from '../../src/sim/survival.js';
import { BLOCK_H, emptySchedule, planFrom, blockSky, isWasted, forecast } from '../../src/game/schedule.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/site-b.json', 'utf8')));
const H = SIM_CONFIG.missionHours;

describe('task schedule', () => {
  it('emptySchedule covers the mission in 6-hour blocks, all automatic', () => {
    const s = emptySchedule(H);
    expect(s).toHaveLength(H / BLOCK_H);
    expect(s.every((m) => m === null)).toBe(true);
    expect(emptySchedule(170)).toHaveLength(29);
  });

  it('planFrom maps mission hours to blocks relative to the landing hour', () => {
    const s = emptySchedule(H);
    s[0] = MODES.ASLEEP;
    s[2] = MODES.DRILL;
    const plan = planFrom(s, 240);
    expect(plan(240)).toBe(MODES.ASLEEP);
    expect(plan(245)).toBe(MODES.ASLEEP);
    expect(plan(246)).toBeNull();
    expect(plan(252)).toBe(MODES.DRILL);
    expect(plan(240 + H)).toBeNull(); // past the end: automatic
  });

  it('blockSky counts hours and never exceeds the block length', () => {
    const sky = blockSky(site, 0, H);
    expect(sky).toHaveLength(H / BLOCK_H);
    for (const b of sky) {
      expect(b.hours).toBe(BLOCK_H);
      expect(b.sun).toBeLessThanOrEqual(BLOCK_H);
      expect(b.earth).toBeLessThanOrEqual(BLOCK_H);
    }
  });

  it('isWasted flags drilling without Sun and transmitting without Earth', () => {
    expect(isWasted(MODES.DRILL, { sun: 0, earth: 6 })).toBe(true);
    expect(isWasted(MODES.DRILL, { sun: 1, earth: 0 })).toBe(false);
    expect(isWasted(MODES.TRANSMIT, { sun: 6, earth: 0 })).toBe(true);
    expect(isWasted(MODES.ASLEEP, { sun: 0, earth: 0 })).toBe(false);
    expect(isWasted(null, { sun: 0, earth: 0 })).toBe(false);
  });

  it('an all-automatic forecast equals a plain automatic run', () => {
    const f = forecast(site, SIM_CONFIG, 216, emptySchedule(H));
    const { state } = advance(site, initialState(SIM_CONFIG, 216), H);
    expect(f.state.score).toBe(state.score);
    expect(f.state.alive).toBe(state.alive);
    expect(f.batteryPct).toHaveLength(H / BLOCK_H);
  });

  it('the forecast equals what the game plays out hour by hour with the same schedule', () => {
    const s = emptySchedule(H).map((_, i) => (i % 3 === 0 ? MODES.ASLEEP : null));
    const f = forecast(site, SIM_CONFIG, 216, s);
    let state = initialState(SIM_CONFIG, 216);
    const plan = planFrom(s, 216);
    while (!state.done) state = advance(site, state, 1, plan).state; // 1x playback
    expect(state.score).toBe(f.state.score);
    expect(state.battery).toBeCloseTo(f.state.battery, 9);
    expect(state.hour).toBe(f.state.hour);
  });

  it('a schedule can save a mission the automatic plan loses', () => {
    const c = decodeSite(JSON.parse(readFileSync('public/sites/site-c.json', 'utf8')));
    let saved = 0;
    for (let day = 0; day * 24 + H <= c.hours; day++) {
      const auto = forecast(c, SIM_CONFIG, day * 24, emptySchedule(H));
      if (auto.state.alive) continue;
      expect(auto.powerDownHour).toBeGreaterThan(0);
      expect(auto.minPct).toBe(0);
      if (forecast(c, SIM_CONFIG, day * 24, emptySchedule(H).fill(MODES.ASLEEP)).state.alive) saved++;
    }
    expect(saved).toBeGreaterThan(0);
  });
});
