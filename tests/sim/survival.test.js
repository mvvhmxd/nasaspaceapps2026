import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { initialState, advance } from '../../src/sim/survival.js';
import { SIM_CONFIG } from '../../src/sim/config.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/demo.json', 'utf8')));
const len = site.series.sunAz.length;

describe('survival', () => {
  it('advance(N) equals N single steps (fast-forward never skips)', () => {
    const big = advance(site, initialState(), 50);
    let s = initialState(); const ev = [];
    for (let i = 0; i < 50; i++) { const r = advance(site, s, 1); s = r.state; ev.push(...r.events); }
    expect(s.battery).toBeCloseTo(big.state.battery);
    expect(s.score).toBe(big.state.score);
    expect(ev).toEqual(big.events);
  });

  it('battery stays within 0..capacity', () => {
    let s = initialState();
    while (!s.done) {
      s = advance(site, s, 1).state;
      expect(s.battery).toBeGreaterThanOrEqual(0);
      expect(s.battery).toBeLessThanOrEqual(SIM_CONFIG.batteryCapacity);
    }
  });

  it('a mission ends with exactly one success or powerDown', () => {
    const { events } = advance(site, initialState(), len + 10);
    const ends = events.filter((e) => e.type === 'success' || e.type === 'powerDown');
    expect(ends.length).toBe(1);
  });

  it('no charge in permanent darkness → power down', () => {
    const dark = { ...site, series: { ...site.series, sunEl: site.series.sunEl.map(() => -10) } };
    const { state, events } = advance(dark, initialState(), len);
    expect(state.alive).toBe(false);
    expect(events.some((e) => e.type === 'powerDown')).toBe(true);
  });
});
