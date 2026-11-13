import { describe, expect, it } from 'vitest';
import { createRefreshEstimator, createShadowStride, MAX_STRIDE, RELAX_FRAMES } from '../../src/render/frameBudget.js';

const feed = (est, deltas) => deltas.forEach((d) => est.sample(d));

describe('refresh estimator', () => {
  it('finds 60 Hz, 50 Hz and 144 Hz from frame deltas', () => {
    for (const hz of [60, 50, 144]) {
      const est = createRefreshEstimator();
      feed(est, Array.from({ length: 90 }, (_, i) => 1000 / hz + (i % 3 - 1) * 0.2));
      expect(est.intervalMs).toBeCloseTo(1000 / hz, 0);
    }
  });

  it('is not moved by occasional long frames or stalls', () => {
    const est = createRefreshEstimator();
    const d = Array.from({ length: 90 }, (_, i) => (i % 10 === 0 ? 33.4 : 16.7));
    d.push(500, 0, -3);
    feed(est, d);
    expect(est.intervalMs).toBeCloseTo(16.7, 1);
  });
});

describe('shadow stride', () => {
  it('backs off on a 50 Hz display only when frames really overrun 20 ms', () => {
    const s = createShadowStride();
    const refresh = 20; // 50 Hz
    s.update(20.5, refresh); // 2.5 % over: within budget on 50 Hz
    expect(s.value).toBe(1);
    s.update(18.5, 1000 / 60); // the old fixed 18.5 ms rule would also trip here on 60 Hz
    expect(s.value).toBe(2);
  });

  it('caps at MAX_STRIDE and relaxes after RELAX_FRAMES fast frames', () => {
    const s = createShadowStride();
    for (let i = 0; i < 10; i++) s.update(40, 16.7);
    expect(s.value).toBe(MAX_STRIDE);
    for (let i = 0; i < RELAX_FRAMES; i++) s.update(16.7, 16.7);
    expect(s.value).toBe(MAX_STRIDE); // not yet
    s.update(16.7, 16.7);
    expect(s.value).toBe(MAX_STRIDE - 1);
  });

  it('a frame in the hysteresis band resets the relax count', () => {
    const s = createShadowStride();
    s.update(40, 16.7);
    for (let i = 0; i < RELAX_FRAMES; i++) s.update(16.7, 16.7);
    s.update(17.8, 16.7); // between FAST and SLOW ratios
    s.update(16.7, 16.7);
    expect(s.value).toBe(2);
  });
});
