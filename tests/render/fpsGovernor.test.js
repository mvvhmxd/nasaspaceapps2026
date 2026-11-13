import { describe, expect, it } from 'vitest';
import { createFpsGovernor } from '../../src/render/fpsGovernor.js';

describe('fps governor', () => {
  it('asks for one step down after `streak` low readings in a row', () => {
    const g = createFpsGovernor({ floor: 30, streak: 3, graceMs: 0 });
    expect([20, 20].map((f, i) => g.sample(f, i * 500))).toEqual([false, false]);
    expect(g.sample(20, 1000)).toBe(true);
    // the streak restarts, so it never asks twice in a row
    expect(g.sample(20, 1500)).toBe(false);
  });

  it('a good reading breaks the streak', () => {
    const g = createFpsGovernor({ streak: 3, graceMs: 0 });
    expect([20, 20, 45, 20, 20].some((f, i) => g.sample(f, i * 500))).toBe(false);
  });

  it('ignores start-up and post-change hitches during the grace period', () => {
    const g = createFpsGovernor({ streak: 3, graceMs: 2000 });
    g.reset(0);
    expect([5, 5, 5, 5].some((f, i) => g.sample(f, i * 500))).toBe(false); // t = 0..1500
    expect(g.sample(5, 2000)).toBe(false);
    expect(g.sample(5, 2500)).toBe(false);
    expect(g.sample(5, 3000)).toBe(true);
  });

  it('defaults to 2 s of sustained low fps (four 0.5 s readings)', () => {
    const g = createFpsGovernor({ graceMs: 0 });
    expect([10, 10, 10].some((f, i) => g.sample(f, i * 500))).toBe(false);
    expect(g.sample(10, 1500)).toBe(true);
  });

  it('ignores readings from a hidden tab', () => {
    const g = createFpsGovernor({ streak: 3, graceMs: 0 });
    g.sample(10, 0);
    g.sample(10, 500);
    expect(g.sample(1, 1000, true)).toBe(false);
    expect(g.sample(10, 1500)).toBe(false); // hidden reading reset the streak
  });
});
