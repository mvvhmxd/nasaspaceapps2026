// Survival model: battery/thermal state stepped one hour at a time.
// Pure functions, no DOM/three.js. Uses stateAt() from visibility.js.

/** Starting state for a run. TODO: real fields. */
export function initialState(config) {
  void config;
  throw new Error('TODO: initialState not implemented');
}

/**
 * Advance `hours` hours, stepping exactly 1 h at a time (never skip ahead,
 * so short eclipses aren't missed).
 * @returns {{ state: object, events: object[] }}
 */
export function advance(site, state, hours, plan) {
  void site; void state; void hours; void plan;
  throw new Error('TODO: advance not implemented');
}
