// Frame budget helpers for smooth playback. Pure (time and frame deltas are fed in).
//
// The shadow map is the costly part of a moving-Sun frame. Rather than assume a
// 60 Hz display, the scene measures the display's own frame interval and redraws
// the shadows every `stride` frames:
// - frames running more than SLOW_RATIO over the display interval: redraw less often
//   (stride + 1, up to MAX_STRIDE), so the frame fits again;
// - frames back under FAST_RATIO of the interval for RELAX_FRAMES in a row: redraw
//   more often again (stride - 1).
// The gap between the two ratios is hysteresis, so the stride does not flip-flop.

export const SLOW_RATIO = 1.1; // e.g. 18.3 ms on a 60 Hz display, 22 ms on 50 Hz
export const FAST_RATIO = 1.05;
export const RELAX_FRAMES = 120; // about 2 s at 60 Hz before stepping back up
export const MAX_STRIDE = 4; // shadows at no less than a quarter of the frame rate

/**
 * Estimates the display refresh interval from requestAnimationFrame deltas: the
 * 25th percentile of the last `size` deltas (frames are quantised to the refresh,
 * so a low percentile is the interval itself; occasional long frames do not move it).
 */
export function createRefreshEstimator({ size = 90, fallbackMs = 1000 / 60 } = {}) {
  const deltas = [];
  let estimate = fallbackMs;
  let sinceSort = 0;
  return {
    get intervalMs() { return estimate; },
    sample(dtMs) {
      if (!(dtMs > 2 && dtMs < 100)) return estimate; // ignore stalls and timer noise
      deltas.push(dtMs);
      if (deltas.length > size) deltas.shift();
      if (++sinceSort >= 15 && deltas.length >= 30) {
        sinceSort = 0;
        const sorted = [...deltas].sort((a, b) => a - b);
        estimate = sorted[Math.floor(sorted.length * 0.25)];
      }
      return estimate;
    },
  };
}

/** Adaptive shadow redraw stride (see the rule at the top of this file). */
export function createShadowStride() {
  let stride = 1;
  let fast = 0;
  return {
    get value() { return stride; },
    /** `avgMs`: smoothed frame time; `refreshMs`: display interval. */
    update(avgMs, refreshMs) {
      if (avgMs > refreshMs * SLOW_RATIO && stride < MAX_STRIDE) { stride++; fast = 0; }
      else if (avgMs < refreshMs * FAST_RATIO && stride > 1) {
        if (++fast > RELAX_FRAMES) { stride--; fast = 0; }
      } else fast = 0;
      return stride;
    },
  };
}
