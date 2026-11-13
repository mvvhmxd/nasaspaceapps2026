import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { stateAt } from '../../src/sim/visibility.js';
import { SIM_CONFIG } from '../../src/sim/config.js';
import { nextChange, validStartDays, dayStats, slipDay, starsFor, bestPerRow } from '../../src/ui/gameHelpers.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/demo.json', 'utf8')));
const H = SIM_CONFIG.missionHours;

describe('gameHelpers', () => {
  it('nextChange points at the first hour where the value flips', () => {
    for (const key of ['sunlit', 'earthVisible']) {
      const n = nextChange(site, 0, key);
      if (n === null) continue;
      expect(stateAt(site, n)[key]).not.toBe(stateAt(site, 0)[key]);
      expect(stateAt(site, n - 1)[key]).toBe(stateAt(site, 0)[key]);
    }
  });

  it('nextChange is null at the last hour', () => {
    expect(nextChange(site, site.hours - 1, 'sunlit')).toBeNull();
  });

  it('validStartDays only offers days whose window fits the data', () => {
    const days = validStartDays(site, H);
    expect((days - 1) * 24 + H).toBeLessThanOrEqual(site.hours);
    expect(days * 24 + H).toBeGreaterThan(site.hours);
    expect(validStartDays({ hours: H - 1 }, H)).toBe(0);
  });

  it('dayStats has one entry per valid day with percentages in range', () => {
    const stats = dayStats(site, H);
    expect(stats).toHaveLength(validStartDays(site, H));
    for (const s of stats) {
      expect(s.sunlitPct).toBeGreaterThanOrEqual(0);
      expect(s.sunlitPct).toBeLessThanOrEqual(100);
    }
  });

  it('slipDay moves later and clamps to the last valid day', () => {
    const last = validStartDays(site, H) - 1;
    expect(slipDay(0, 5, site, H)).toBe(5);
    expect(slipDay(last, 5, site, H)).toBe(last);
  });

  it('starsFor: 0 lost, 1 survived, 2 and 3 by share of best', () => {
    const t = [0.7, 0.9];
    expect(starsFor({ alive: false, score: 99 }, 100, t)).toBe(0);
    expect(starsFor({ alive: true, score: 10 }, 100, t)).toBe(1);
    expect(starsFor({ alive: true, score: 70 }, 100, t)).toBe(2);
    expect(starsFor({ alive: true, score: 90 }, 100, t)).toBe(3);
    expect(starsFor({ alive: true, score: 0 }, 0, t)).toBe(1);
  });

  it('bestPerRow picks highest sun/Earth and shortest darkness', () => {
    const b = bestPerRow([
      { sunlitPct: 40, earthPct: 80, sunElAtLanding: 1, longestDarkH: 50 },
      { sunlitPct: 60, earthPct: 20, sunElAtLanding: 2, longestDarkH: 90 },
    ]);
    expect(b).toEqual({ sunlitPct: 1, earthPct: 0, sunElAtLanding: 1, longestDarkH: 0 });
  });
});
