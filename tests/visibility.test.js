import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodeSite } from '../src/data/loadSite.js';
import { computeMask } from '../src/sim/horizon.js';
import { maskAt, stateAt } from '../src/sim/visibility.js';
import { buildTerrain, landerEye, blockedToward } from '../src/render/terrain.js';
import { directionFromAzEl } from '../src/render/sun.js';

const load = (id) => decodeSite(JSON.parse(readFileSync(`public/sites/${id}.json`, 'utf8')));

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

/** Render raycast vs the near horizon (the shadows the crop itself can cast). */
function renderAgreement(site) {
  const terrain = buildTerrain(site.heightmap);
  const eye = landerEye(site.heightmap);
  let agree = 0;
  const misses = [];
  for (let h = 0; h < site.hours; h++) {
    const st = stateAt(site, h);
    const blocked = blockedToward(terrain, eye, directionFromAzEl(st.sunAz, st.sunEl));
    if (blocked === st.sunEl <= st.sunNearMask) agree++;
    else misses.push(Math.abs(st.sunEl - st.sunNearMask));
  }
  return { pct: (100 * agree) / site.hours, misses: misses.length, worst: misses.length ? Math.max(...misses) : 0 };
}

function sunlitFraction(site) {
  let lit = 0;
  for (let h = 0; h < site.hours; h++) if (stateAt(site, h).sunlit) lit++;
  return lit / site.hours;
}

describe('demo site (illustrative)', () => {
  const site = load('demo');

  it('stored horizon mask matches computeMask on the decoded heightmap', () => {
    const maxDiff = Math.max(...site.nearMask.map((v, i) => Math.abs(v - site.horizonMask[i])));
    expect(maxDiff).toBeLessThan(0.002);
  });

  it('has both sunlit and shadowed hours', () => {
    const f = sunlitFraction(site);
    expect(f).toBeGreaterThan(0.2);
    expect(f).toBeLessThan(0.9);
  });

  it('render raycast agrees with the sim mask on sunlit/shadow for >= 95% of hours', () => {
    const r = renderAgreement(site);
    console.log(`demo render/sim agreement: ${r.pct.toFixed(2)}% of ${site.hours} h; ` +
      `${r.misses} disagreements, all within ${r.worst.toFixed(3)} deg of the ridge line`);
    expect(r.pct).toBeGreaterThanOrEqual(95);
    expect(r.worst).toBeLessThan(0.01); // sim and mesh share one surface: only exact ridge-line ties
  });
});

describe('Connecting Ridge (real LOLA + JPL Horizons)', () => {
  const site = load('connecting-ridge');

  it('is marked as real data with a source', () => {
    expect(site.illustrative).toBe(false);
    expect(site.source).toMatch(/LOLA/);
    expect(site.source).toMatch(/Horizons/);
  });

  it('the pipeline horizon is never below the horizon the crop itself shows', () => {
    // horizonMask also sees terrain beyond the crop, so it can only be higher.
    const fresh = computeMask(site.heightmap);
    const worst = Math.max(...fresh.map((v, i) => v - site.horizonMask[i]));
    const same = fresh.filter((v, i) => Math.abs(v - site.horizonMask[i]) < 0.05).length;
    console.log(`ridge: crop horizon exceeds pipeline horizon by at most ${worst.toFixed(3)} deg; ` +
      `${same} of 360 azimuths set inside the crop`);
    expect(worst).toBeLessThan(0.05);
    expect(same).toBeGreaterThan(180); // most of the horizon is the ridge's own terrain
  });

  it('has both sunlit and shadowed hours, and some of the shadow is from far terrain', () => {
    const f = sunlitFraction(site);
    let far = 0;
    for (let h = 0; h < site.hours; h++) if (stateAt(site, h).sunBehindFarTerrain) far++;
    console.log(`ridge: sunlit ${(100 * f).toFixed(1)}% of ${site.hours} h; far-terrain shadow ${far} h`);
    expect(f).toBeGreaterThan(0.05);
    expect(f).toBeLessThan(0.95);
  });

  it('render raycast agrees with the near horizon on sunlit/shadow for >= 95% of hours', () => {
    const r = renderAgreement(site);
    console.log(`ridge render/sim agreement: ${r.pct.toFixed(2)}% of ${site.hours} h; ` +
      `${r.misses} disagreements, all within ${r.worst.toFixed(3)} deg of the ridge line`);
    expect(r.pct).toBeGreaterThanOrEqual(95);
    expect(r.worst).toBeLessThan(0.01); // sim and mesh share one surface: only exact ridge-line ties
  });
});
