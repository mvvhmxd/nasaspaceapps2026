// Decides when the frame rate is low enough to step the ASCII quality down.
// Pure (no DOM, no three.js) so the rule is unit-tested.
//
// Rule: after a grace period (start-up shader compile, atlas rebuild, shadow map
// reallocation), `streak` consecutive readings below `floor` fps ask for one step
// down. Readings while the tab is hidden are ignored (browsers throttle rAF).
// With 0.5 s readings the default streak needs 2 s of sustained low fps, so a
// one-off stall (GC, screen capture, a busy background tab) does not count.

export function createFpsGovernor({ floor = 30, streak = 4, graceMs = 2000 } = {}) {
  let low = 0;
  let graceUntil = -Infinity;
  return {
    /** Start (or restart) the grace period, e.g. after a quality change. */
    reset(now) {
      low = 0;
      graceUntil = now + graceMs;
    },
    /** Feed one reading; returns true when the quality should step down. */
    sample(fps, now, hidden = false) {
      if (hidden || now < graceUntil) {
        low = 0;
        return false;
      }
      low = fps < floor ? low + 1 : 0;
      if (low >= streak) {
        low = 0;
        return true;
      }
      return false;
    },
  };
}
