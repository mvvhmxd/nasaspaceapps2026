import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../../src/data/loadSite.js';
import { previewStats } from '../../src/sim/planner.js';
import { stateAt } from '../../src/sim/visibility.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/demo.json', 'utf8')));

describe('previewStats', () => {
  it('percentages are in 0..100 and match a direct count', () => {
    const p = previewStats(site, 0, 100);
    let sun = 0;
    for (let h = 0; h < 100; h++) if (stateAt(site, h).sunlit) sun++;
    expect(p.sunlitPct).toBeCloseTo(sun);
    expect(p.earthPct).toBeGreaterThanOrEqual(0);
    expect(p.earthPct).toBeLessThanOrEqual(100);
  });

  it('all dark → longestDark equals window length', () => {
    const dark = { ...site, series: { ...site.series, sunEl: site.series.sunEl.map(() => -10) } };
    expect(previewStats(dark, 0, 48).longestDarkH).toBe(48);
  });
});
