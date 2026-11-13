import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeSite } from '../../src/data/loadSite.js';
import { stateAt } from '../../src/sim/visibility.js';
import { skyAt, shortestArc, createDisplayClock } from '../../src/render/skyClock.js';

const site = decodeSite(JSON.parse(fs.readFileSync('public/sites/demo.json', 'utf8')));
const last = site.series.sunAz.length - 1;

// A tiny synthetic site for exact wrap / bound checks.
function miniSite(sunAz, sunEl, earthAz = sunAz, earthEl = sunEl) {
  return {
    horizonMask: new Array(360).fill(1),
    series: { startUtc: '2027-01-01T00:00:00Z', stepHours: 1, sunAz, sunEl, earthAz, earthEl },
  };
}

describe('skyAt', () => {
  it('equals the sim exactly at every whole hour of the demo site', () => {
    for (let h = 0; h <= last; h += 7) {
      const a = skyAt(site, h);
      const b = stateAt(site, h);
      for (const k of ['sunAz', 'sunEl', 'earthAz', 'earthEl', 'sunMask', 'earthMask', 'sunlit', 'earthVisible', 'hour']) {
        expect(a[k]).toEqual(b[k]);
      }
    }
  });

  it('crosses north the short way (359° → 1° passes 0°, not 180°)', () => {
    const s = miniSite([359, 1], [0, 0]);
    expect(skyAt(s, 0.5).sunAz).toBeCloseTo(0, 9);
    expect(skyAt(s, 0.25).sunAz).toBeCloseTo(359.5, 9);
    expect(skyAt(s, 0.75).sunAz).toBeCloseTo(0.5, 9);
    expect(shortestArc(10, 350)).toBe(-20);
    expect(shortestArc(350, 10)).toBe(20);
  });

  it('keeps elevation between the two neighbouring samples', () => {
    for (let h = 0; h < last; h += 13) {
      const lo = Math.min(site.series.sunEl[h], site.series.sunEl[h + 1]);
      const hi = Math.max(site.series.sunEl[h], site.series.sunEl[h + 1]);
      for (const f of [0.1, 0.5, 0.9]) {
        const el = skyAt(site, h + f).sunEl;
        expect(el).toBeGreaterThanOrEqual(lo - 1e-12);
        expect(el).toBeLessThanOrEqual(hi + 1e-12);
      }
    }
  });

  it('clamps to the series and survives bad input', () => {
    expect(skyAt(site, -5).sunAz).toBe(stateAt(site, 0).sunAz);
    expect(skyAt(site, last + 99).sunAz).toBe(stateAt(site, last).sunAz);
    expect(skyAt(site, NaN).sunAz).toBe(stateAt(site, 0).sunAz);
  });

  it('takes the truth flags from the whole hour reached, never from the in-between position', () => {
    // Find an hour where sunlit flips between h and h + 1.
    let h = 0;
    while (h < last && stateAt(site, h).sunlit === stateAt(site, h + 1).sunlit) h++;
    expect(h).toBeLessThan(last);
    for (const f of [0.01, 0.5, 0.99]) {
      const s = skyAt(site, h + f);
      expect(s.sunlit).toBe(stateAt(site, h).sunlit);
      expect(s.simHour).toBe(h);
    }
    expect(skyAt(site, h + 1).sunlit).toBe(stateAt(site, h + 1).sunlit);
  });
});

describe('display clock', () => {
  it('eases monotonically to the new sim hour without overshooting', () => {
    const c = createDisplayClock({ durationMs: 500 });
    c.jump(10, 0);
    c.setTarget(14, 0);
    let prev = 10;
    for (let t = 0; t <= 600; t += 25) {
      const v = c.value(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(14);
      prev = v;
    }
    expect(c.value(500)).toBe(14);
    expect(c.animating(600)).toBe(false);
  });

  it('retargets from where it is, so a new hour mid-ease never jumps backwards', () => {
    const c = createDisplayClock({ durationMs: 500 });
    c.jump(0, 0);
    c.setTarget(1, 0);
    const mid = c.value(250);
    c.setTarget(2, 250);
    expect(c.value(250)).toBeCloseTo(mid, 12);
    expect(c.value(260)).toBeGreaterThanOrEqual(mid);
    expect(c.value(750)).toBe(2);
  });

  it('snaps on backward moves and on long jumps', () => {
    const c = createDisplayClock({ durationMs: 500, maxEaseHours: 48 });
    c.jump(100, 0);
    c.setTarget(0, 0); // loop back to the start
    expect(c.value(1)).toBe(0);
    c.setTarget(300, 10); // slider scrub far ahead
    expect(c.value(11)).toBe(300);
  });

  it('with reduced motion, jumps straight to each hour', () => {
    const c = createDisplayClock({ durationMs: 500, reducedMotion: true });
    c.jump(5, 0);
    c.setTarget(6, 0);
    expect(c.value(0)).toBe(6);
    expect(c.animating(0)).toBe(false);
  });
});
