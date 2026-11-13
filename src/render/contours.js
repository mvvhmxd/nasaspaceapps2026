// Contour lines for the map: pure rules shared by the shaders and the tests.
// Contours are lines of equal elevation taken straight from the site heightmap
// (no lighting, no invented detail). Absolute levels: multiples of the interval.

export const NICE_INTERVALS_M = [10, 25, 50, 100, 250, 500, 1000];
export const MAJOR_EVERY = 5; // every 5th level is a bold "index" contour

/** Lowest and highest height in a decoded heightmap (metres). */
export function elevationRange(heights) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return { minM: min, maxM: max };
}

/** Number of contour levels L = k * interval with lo < L <= hi. */
export function levelsCrossed(lo, hi, interval) {
  return Math.floor(hi / interval) - Math.floor(lo / interval);
}

/**
 * Interval giving about 12-20 lines over the site's relief: the smallest nice
 * interval with at most 20 lines (the largest one if even that gives more).
 */
export function contourInterval(minM, maxM) {
  const relief = Math.max(0, maxM - minM);
  for (const step of NICE_INTERVALS_M) {
    if (relief / step <= 20) return step;
  }
  return NICE_INTERVALS_M[NICE_INTERVALS_M.length - 1];
}

/** The backslash glyph, spelled out to avoid escape mistakes. */
export const BACKSLASH = String.fromCharCode(92);

const TAN_22_5 = Math.tan(Math.PI / 8);

/** Minimum on-screen spacing (in glyph cells) between neighbouring contours.
 * Closer than this they would fill every cell and read as hatching, so on steep
 * slopes minor contours drop out first, then index contours. */
export const MIN_MINOR_SPACING_CELLS = 2;
export const MIN_MAJOR_SPACING_CELLS = 1.5;

/** Metres the terrain must clear a level by, on both sides, to count as crossing it.
 * About the elevation precision of the glyph pass (0.4 m mean, 0.8 m p95 measured). */
export const CROSSING_MARGIN_M = 1;

/**
 * Which contour glyph a glyph cell shows, from the elevations at its 4 corners
 * `{ tl, tr, bl, br }` (screen space, north up, y up; corners are shared with the
 * neighbouring cells, so crossings agree and chains are continuous).
 * Returns null when no shown level crosses the cell, else { glyph, major } where
 * glyph is '-', '|', '/' or BACKSLASH (the contour's direction on screen).
 * Mirrors the GLSL in ascii.js; keep the two in step.
 */
export function contourGlyphForCell({ tl, tr, bl, br }, interval, majorEvery = MAJOR_EVERY) {
  // A level only counts when the terrain clears it by CROSSING_MARGIN_M on both
  // sides: grazing touches are below the data's precision and would scatter
  // one-cell fragments over flat ground.
  const lo = Math.min(tl, tr, bl, br) + CROSSING_MARGIN_M;
  const hi = Math.max(tl, tr, bl, br) - CROSSING_MARGIN_M;
  const n = levelsCrossed(lo, hi, interval);
  if (n <= 0) return null;
  const nMajor = levelsCrossed(lo, hi, interval * majorEvery);
  // Gradient of the bilinear patch (x right, y up), in metres per cell.
  const gx = (tr + br - tl - bl) / 2;
  const gy = (tl + tr - bl - br) / 2;
  const ax = Math.abs(gx);
  const ay = Math.abs(gy);
  const slope = Math.hypot(gx, gy);
  // Spacing between neighbouring contours, in cells (Infinity on a saddle / flat).
  const minorSpacing = slope > 0 ? interval / slope : Infinity;
  const showMajor = nMajor > 0 && minorSpacing * majorEvery >= MIN_MAJOR_SPACING_CELLS;
  const showMinor = n - nMajor > 0 && minorSpacing >= MIN_MINOR_SPACING_CELLS;
  if (!showMajor && !showMinor) return null;
  let glyph;
  if (ax <= ay * TAN_22_5) glyph = '-'; // height changes north-south: line runs east-west
  else if (ay <= ax * TAN_22_5) glyph = '|';
  else glyph = gx * gy < 0 ? '/' : BACKSLASH;
  // Saddle (gradient ~0 with a crossing): pick by which diagonal is higher.
  if (ax + ay < 1e-9) glyph = tl + br >= tr + bl ? BACKSLASH : '/';
  return { glyph, major: showMajor };
}

export const CONTOUR_GLYPHS = ['-', '|', '/', BACKSLASH]; // atlas order, also the shader's index
