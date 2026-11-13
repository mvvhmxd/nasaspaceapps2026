import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  northCentred, azToX, elevationScale, elToY, pinState, skylinePoints, skylinePaths,
  exaggeration, compassTicks, gapLabel,
} from '../../src/ui/horizonGeometry.js';
import { maskAt } from '../../src/sim/visibility.js';

const site = JSON.parse(fs.readFileSync('public/sites/demo.json', 'utf8'));
const W = 600;
const H = 84;

describe('horizon strip geometry', () => {
  it('puts north in the middle, east right, west left, south at both edges', () => {
    expect(azToX(0, W)).toBe(W / 2);
    expect(azToX(90, W)).toBe(W * 0.75);
    expect(azToX(270, W)).toBe(W * 0.25);
    expect(azToX(180, W)).toBe(0);
    expect(northCentred(359)).toBe(-1);
    expect(northCentred(-90)).toBe(-90);
  });

  it('maps azimuth to x monotonically from due south round to due south', () => {
    let prev = -1;
    for (let k = 0; k < 360; k++) {
      const x = azToX((180 + k) % 360, W);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });

  it('fits a fixed per-site scale to the ridge and the Sun, not the far-swinging Earth', () => {
    const s = elevationScale(site.horizonMask, site.series);
    expect(s.min).toBeLessThan(Math.min(...site.horizonMask));
    expect(s.max).toBeGreaterThan(Math.max(...site.horizonMask));
    expect(s.max).toBeGreaterThan(Math.max(...site.series.sunEl));
    expect(s.max).toBeLessThan(Math.max(...site.series.earthEl)); // demo Earth reaches 8°: pinned, not fitted
    expect(s.grid).toContain(0);
    expect(s.grid.length).toBeGreaterThanOrEqual(3);
    expect(s.grid.length).toBeLessThanOrEqual(6);
  });

  it('maps elevation to y monotonically (higher = nearer the top) and clamps outside the scale', () => {
    const s = elevationScale(site.horizonMask, site.series);
    let prev = Infinity;
    for (let e = s.min; e <= s.max; e += 0.25) {
      const y = elToY(e, s, H);
      expect(y).toBeLessThan(prev + 1e-12);
      prev = y;
    }
    expect(elToY(s.max + 5, s, H)).toBe(0);
    expect(elToY(s.min - 5, s, H)).toBe(H);
    expect(pinState(s.min - 1, s)).toBe('below');
    expect(pinState(s.max + 1, s)).toBe('above');
    expect(pinState((s.min + s.max) / 2, s)).toBe('no');
  });

  it('draws the skyline from every mask bin, 360 points plus the closing one, at the right heights', () => {
    const s = elevationScale(site.horizonMask, site.series);
    const pts = skylinePoints(site.horizonMask, W, H, s);
    expect(pts.length).toBe(361);
    expect(pts[0][1]).toBe(pts[360][1]); // both ends are due south
    for (const az of [0, 45, 90, 180, 271]) {
      const k = (az - 180 + 360) % 360;
      expect(pts[k][0]).toBeCloseTo(azToX(az, W), 6); // due south (k = 0) sits at x = 0
      expect(pts[k][1]).toBeCloseTo(elToY(maskAt(site.horizonMask, az), s, H), 6);
    }
    const { line, ground, points } = skylinePaths(site.horizonMask, W, H, s);
    expect(points).toBe(361);
    expect(line.startsWith('M0.0 ')).toBe(true);
    expect(ground.endsWith('Z')).toBe(true);
  });

  it('reports the vertical exaggeration it actually draws', () => {
    const s = { min: -1, max: 5 };
    // 84 px over 6° vertically vs 600 px over 360° horizontally → 14 / 1.667 = 8.4
    expect(exaggeration(W, H, s)).toBe(8);
    expect(exaggeration(360, 6, { min: 0, max: 6 })).toBe(1); // true scale
  });

  it('labels compass points and the ridge gap', () => {
    const { major, minor } = compassTicks(W);
    expect(major.map((t) => t.label).join('')).toBe('SWNES');
    expect(major.find((t) => t.label === 'N').x).toBe(W / 2);
    expect(minor.length).toBe(4);
    expect(gapLabel('Sun', 0.88, 2.3)).toBe('ridge 1.4° above Sun');
    expect(gapLabel('Sun', 1.47, 0.78)).toBe('Sun 0.7° above ridge');
  });
});
