import { describe, expect, it } from 'vitest';
import { createFence, outsideBy, easeOut, FENCE_COUNTDOWN_MS, FENCE_GLIDE_MS } from '../../src/render/fence.js';

const HALF = 5120; // demo site: 256 cells x 40 m / 2

describe('outsideBy', () => {
  it('is 0 anywhere inside or on the edge of the square', () => {
    for (const [x, z] of [[0, 0], [HALF, 0], [-HALF, HALF], [4000, -5120]]) expect(outsideBy(x, z, HALF)).toBe(0);
  });
  it('measures the distance past the nearest edge', () => {
    expect(outsideBy(HALF + 10, 0, HALF)).toBe(10);
    expect(outsideBy(0, -HALF - 250, HALF)).toBe(250);
    expect(outsideBy(HALF + 5, HALF + 30, HALF)).toBe(30);
  });
});

describe('easeOut', () => {
  it('runs 0 -> 1, monotonic, clamped', () => {
    let prev = -1;
    for (let t = -0.2; t <= 1.2; t += 0.05) {
      const v = easeOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5); // fast start
  });
});

describe('fence state machine', () => {
  it('never trips while the view centre stays over the terrain', () => {
    const f = createFence({ half: HALF });
    for (let i = 0; i < 200; i++) {
      const a = i * 0.7;
      const r = f.tick(Math.cos(a) * HALF, Math.sin(a) * HALF * 0.99, i * 100);
      expect(r.state).toBe('inside');
      expect(r.target).toBeNull();
    }
  });

  it('warns, counts 5..1, then glides home and clears', () => {
    const f = createFence({ half: HALF });
    const x = HALF + 800;
    let r = f.tick(x, 0, 0);
    expect(r.state).toBe('outside');
    expect(r.secondsLeft).toBe(5);
    const seen = new Set();
    for (let t = 0; t < FENCE_COUNTDOWN_MS; t += 100) seen.add(f.tick(x, 0, t).secondsLeft);
    expect([...seen]).toEqual([5, 4, 3, 2, 1]);
    r = f.tick(x, 0, FENCE_COUNTDOWN_MS);
    expect(r.state).toBe('returning');
    expect(r.target.x).toBeCloseTo(x, 6); // glide starts where the view is
    // the glide moves toward home and never overshoots
    let prev = x;
    for (let t = 16; t < FENCE_GLIDE_MS; t += 16) {
      r = f.tick(prev, 0, FENCE_COUNTDOWN_MS + t);
      expect(r.target.x).toBeLessThanOrEqual(prev);
      expect(r.target.x).toBeGreaterThanOrEqual(0);
      prev = r.target.x;
    }
    r = f.tick(prev, 0, FENCE_COUNTDOWN_MS + FENCE_GLIDE_MS);
    expect(r.target).toEqual({ x: 0, z: 0 });
    expect(r.state).toBe('inside');
    expect(f.tick(0, 0, FENCE_COUNTDOWN_MS + FENCE_GLIDE_MS + 16).state).toBe('inside');
  });

  it('coming back inside during the countdown cancels it', () => {
    const f = createFence({ half: HALF });
    f.tick(HALF + 100, 0, 0);
    expect(f.tick(HALF + 100, 0, 2000).secondsLeft).toBe(3);
    const r = f.tick(HALF - 1, 0, 2100);
    expect(r.state).toBe('inside');
    expect(r.secondsLeft).toBe(0);
    // going out again starts a fresh 5 s countdown
    expect(f.tick(HALF + 1, 0, 2200).secondsLeft).toBe(5);
  });

  it('reduced motion snaps home instead of gliding', () => {
    const f = createFence({ half: HALF, reducedMotion: true });
    f.tick(0, -HALF - 900, 0);
    const r = f.tick(0, -HALF - 900, FENCE_COUNTDOWN_MS);
    expect(r.target).toEqual({ x: 0, z: 0 });
    expect(r.state).toBe('inside');
  });

  it('user input stops the glide; still outside means a fresh countdown', () => {
    const f = createFence({ half: HALF });
    const x = HALF + 3000;
    f.tick(x, 0, 0);
    let r = f.tick(x, 0, FENCE_COUNTDOWN_MS);
    r = f.tick(x, 0, FENCE_COUNTDOWN_MS + 100); // mid-glide, view still outside
    expect(r.state).toBe('returning');
    f.userInput();
    r = f.tick(r.target.x, 0, FENCE_COUNTDOWN_MS + 116); // the glide no longer moves the view
    expect(r.state).toBe('outside');
    expect(r.target).toBeNull();
    expect(r.secondsLeft).toBe(5);
  });

  it('user input mid-glide over terrain just ends the glide there', () => {
    const f = createFence({ half: HALF });
    f.tick(HALF + 200, 0, 0);
    f.tick(HALF + 200, 0, FENCE_COUNTDOWN_MS);
    let r = f.tick(HALF + 200, 0, FENCE_COUNTDOWN_MS + 400); // well into the glide: back over terrain
    expect(outsideBy(r.target.x, 0, HALF)).toBe(0);
    f.userInput();
    r = f.tick(r.target.x, 0, FENCE_COUNTDOWN_MS + 416);
    expect(r).toEqual({ state: 'inside', secondsLeft: 0, target: null });
  });
});
