// Signal fence: an in-world boundary around the surveyed terrain square.
// Pure (no three.js, no DOM): the scene feeds it the view centre and the time.
//
// Rule: the fence trips only when the CENTRE of the view (the map point under the
// middle of the screen) leaves the surveyed square. Showing empty space at the
// screen edges is fine: looking around near the rim, or zooming out until the
// whole square is smaller than the screen, never trips it. With the centre outside,
// at least half the screen in that direction has no terrain data at any zoom.
//
// States: inside -> outside (warning, 5 s countdown) -> returning (glide to the
// landing site, or a snap with reduced motion) -> inside. Moving back inside
// during the countdown cancels it. Never fight the player: while they hold a drag
// or zoom the countdown waits at 1 s and the glide never starts, and touching the
// controls during a glide cancels it; if the view is still outside afterwards, a
// fresh countdown starts on the next tick.

export const FENCE_COUNTDOWN_MS = 5000;
export const FENCE_GLIDE_MS = 800;

/** Metres the point (x, z) lies outside the square of half-side `half` (0 inside). */
export function outsideBy(x, z, half) {
  return Math.max(Math.abs(x) - half, Math.abs(z) - half, 0);
}

/** Ease-out cubic on [0, 1]: fast start, gentle landing. */
export function easeOut(t) {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}

/**
 * `half`: half the side of the surveyed square in metres (terrain centred on the
 * landing site at 0, 0). `home`: where the glide returns to.
 */
export function createFence({
  half, home = { x: 0, z: 0 }, countdownMs = FENCE_COUNTDOWN_MS, glideMs = FENCE_GLIDE_MS,
  reducedMotion = false,
} = {}) {
  let state = 'inside';
  let deadline = 0;
  let glideStart = 0;
  let from = { x: 0, z: 0 };
  let held = false; // the player is holding a drag / zoom right now

  const fence = {
    reducedMotion,
    get state() { return state; },

    /**
     * Feed the current view centre. Returns `{ state, secondsLeft, target }`:
     * `target` is where the view centre must be put this frame (during the glide
     * or on a snap), else null. `secondsLeft` counts 5..1 while outside, else 0.
     */
    tick(x, z, now) {
      let target = null;
      if (state === 'inside') {
        if (outsideBy(x, z, half) > 0) { state = 'outside'; deadline = now + countdownMs; }
      } else if (state === 'outside') {
        if (outsideBy(x, z, half) === 0) state = 'inside';
        else if (held) deadline = Math.max(deadline, now + 1000); // wait at "1" until they let go
        else if (now >= deadline) {
          if (fence.reducedMotion) { state = 'inside'; target = { ...home }; }
          else { state = 'returning'; glideStart = now; from = { x, z }; }
        }
      }
      if (state === 'returning') {
        const k = easeOut((now - glideStart) / glideMs);
        target = { x: from.x + (home.x - from.x) * k, z: from.z + (home.z - from.z) * k };
        if (k >= 1) state = 'inside';
      }
      const secondsLeft = state === 'outside' ? Math.max(1, Math.ceil((deadline - now) / 1000)) : 0;
      return { state, secondsLeft, target };
    },

    /** The player touched the controls: stop any glide where it is. */
    userInput() {
      if (state === 'returning') state = 'inside'; // next tick re-checks, new countdown if still outside
    },

    /** Forget any countdown or glide (e.g. the view changed): back to inside. The
     * next tick starts a fresh 5 s countdown if the view is still outside. */
    reset() {
      state = 'inside';
    },

    /** Drag / zoom started (true) or ended (false). Starting also stops a glide. */
    setHeld(on) {
      held = !!on;
      if (held) fence.userInput();
    },
  };
  return fence;
}
