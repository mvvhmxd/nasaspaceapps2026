import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../src/data/loadSite.js';
import { computeMask } from '../src/sim/horizon.js';
import { maskAt, stateAt } from '../src/sim/visibility.js';
import { buildTerrain, landerEye, blockedToward } from '../src/render/terrain.js';
import { directionFromAzEl } from '../src/render/sun.js';

const site = decodeSite(JSON.parse(readFileSync('public/sites/demo.json', 'utf8')));

describe('conventions', () => {
  it('azimuth is clockwise from north: 0 = north (-z), 90 = east (+x)', () => {
    const n = directionFromAzEl(0, 0);
    const e = directionFromAzEl(90, 0);
    expect(n.z).toBeCloseTo(-1);
    expect(e.x).toBeCloseTo(1);
    expect(directionFromAzEl(0, 90).y).toBeCloseTo(1);
  });

  it('maskAt interpolates between bins and wraps at 360', () => {
    const mask = Array.from({ length: 360 }, (_, i) => i);
    expect(maskAt(mask, 10.5)).toBeCloseTo(10.5);
    expect(maskAt(mask, 359.5)).toBeCloseTo(179.5); // between 359 and 0
    expect(maskAt(mask, -1)).toBeCloseTo(359);
  });
});

describe('demo site', () => {
  it('stored horizon mask matches computeMask on the decoded heightmap', () => {
    const fresh = computeMask(site.heightmap);
    const maxDiff = Math.max(...fresh.map((v, i) => Math.abs(v - site.horizonMask[i])));
    expect(maxDiff).toBeLessThan(0.002);
  });

  it('has both sunlit and shadowed hours', () => {
    let lit = 0;
    for (let h = 0; h < site.hours; h++) if (stateAt(site, h).sunlit) lit++;
    expect(lit).toBeGreaterThan(0.2 * site.hours);
    expect(lit).toBeLessThan(0.9 * site.hours);
  });

  it('render raycast agrees with the sim mask on sunlit/shadow for >= 95% of hours', () => {
    const terrain = buildTerrain(site.heightmap);
    const eye = landerEye(site.heightmap);
    let agree = 0;
    const misses = [];
    for (let h = 0; h < site.hours; h++) {
      const st = stateAt(site, h);
      const blocked = blockedToward(terrain, eye, directionFromAzEl(st.sunAz, st.sunEl));
      if (blocked === !st.sunlit) agree++;
      else misses.push(Math.abs(st.sunEl - st.sunMask));
    }
    const pct = (100 * agree) / site.hours;
    const worst = misses.length ? Math.max(...misses) : 0;
    console.log(`render/sim agreement: ${pct.toFixed(2)}% of ${site.hours} h; ` +
      `${misses.length} disagreements, all within ${worst.toFixed(3)} deg of the ridge line`);
    expect(pct).toBeGreaterThanOrEqual(95);
    expect(worst).toBeLessThan(0.25); // disagreements only at grazing angles
  });
});
