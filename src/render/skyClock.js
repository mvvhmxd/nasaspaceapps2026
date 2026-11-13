// Smooth sky for display: Sun and Earth positions at a fractional hour, and an
// easing display clock. Pure (no DOM, no three.js).
//
// The sim stays authoritative and hourly. Positions are interpolated between the
// hourly samples only so motion looks fluid; the truth flags (sunlit, earthVisible)
// always come from the sim at the whole hour that has been reached (floor(t)),
// never from the interpolated position.
import { maskAt, stateAt } from '../sim/visibility.js';

/** Signed shortest angular step from a to b, in degrees, in [-180, 180). */
export function shortestArc(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

function lerpAz(a, b, f) {
  return (((a + shortestArc(a, b) * f) % 360) + 360) % 360;
}

/**
 * Sky at fractional hour `t` (clamped to the series). At whole hours this equals
 * stateAt(site, t) exactly. `simHour` is the whole hour the truth flags come from.
 */
export function skyAt(site, t) {
  const s = site.series;
  const last = s.sunAz.length - 1;
  const tc = Math.max(0, Math.min(last, Number.isFinite(t) ? t : 0));
  const h0 = Math.floor(tc);
  const truth = stateAt(site, h0);
  const f = tc - h0;
  if (f === 0 || h0 >= last) return { ...truth, t: tc, simHour: h0 };
  const h1 = h0 + 1;
  const sunAz = lerpAz(s.sunAz[h0], s.sunAz[h1], f);
  const earthAz = lerpAz(s.earthAz[h0], s.earthAz[h1], f);
  const sunEl = s.sunEl[h0] + (s.sunEl[h1] - s.sunEl[h0]) * f;
  const earthEl = s.earthEl[h0] + (s.earthEl[h1] - s.earthEl[h0]) * f;
  return {
    ...truth, // hour, timeUtc, sunlit, earthVisible: the sim's whole-hour truth
    t: tc,
    simHour: h0,
    sunAz,
    sunEl,
    earthAz,
    earthEl,
    sunMask: maskAt(site.horizonMask, sunAz),
    earthMask: maskAt(site.horizonMask, earthAz),
  };
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);

/**
 * Display clock that eases from the hour on screen to each new sim hour over
 * `durationMs`. It never runs ahead of the sim: the value always lies between
 * where it was and the latest target. Backward moves (scrubbing, looping) and
 * jumps longer than `maxEaseHours` snap; `reducedMotion` snaps everything.
 * Time is injected (`now` in ms) so the rule is testable.
 */
export function createDisplayClock({ durationMs = 500, maxEaseHours = 48, reducedMotion = false } = {}) {
  let from = 0;
  let to = 0;
  let start = -Infinity;
  const clock = {
    reducedMotion,
    /** Current display hour at time `now`. */
    value(now) {
      if (clock.reducedMotion || durationMs <= 0) return to;
      const x = Math.min(1, Math.max(0, (now - start) / durationMs));
      return x >= 1 ? to : from + (to - from) * easeInOut(x);
    },
    /** True while easing toward the target. */
    animating(now) {
      return !clock.reducedMotion && to !== from && now - start < durationMs;
    },
    /** The sim reached `hour` at time `now`. */
    setTarget(hour, now) {
      const current = clock.value(now);
      const snap = clock.reducedMotion || hour < current || hour - current > maxEaseHours;
      from = snap ? hour : current;
      to = hour;
      start = now;
    },
    /** Jump straight to `hour` (first load, explicit seek). */
    jump(hour, now = 0) {
      from = to = hour;
      start = now;
    },
  };
  return clock;
}
