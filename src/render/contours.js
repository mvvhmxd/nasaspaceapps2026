// Contour lines for the map: pure rules shared by the shaders and the tests.
// Contours are lines of equal elevation taken straight from the site heightmap
// (no lighting, no invented detail). Absolute levels: multiples of the interval.
//
// The GLSL in ascii.js (cellContourInk) mirrors cellContours() below; keep the two
// in step. A browser readback check compares them (see AI_USE_LOG.md).

export const NICE_INTERVALS_M = [10, 25, 50, 100, 250, 500, 1000];
export const MAJOR_EVERY = 5; // every 5th level is a bold "index" contour

/** Minimum on-screen spacing (in glyph cells) between neighbouring contours.
 * Closer than this they would fill every cell and read as hatching, so on steep
 * slopes minor contours drop out first, then index contours. */
export const MIN_MINOR_SPACING_CELLS = 2;
export const MIN_MAJOR_SPACING_CELLS = 1.5;

/** Corner nudge: an elevation within this many metres of a level is moved to
 * level + NUDGE_M, so "above" is never ambiguous and shared corners agree. */
export const NUDGE_M = 0.01;

/** At most this many levels are drawn in one cell (the thinning rules keep real
 * cases at 1, occasionally 2 where the slope bends inside the cell). */
export const MAX_LEVELS_PER_CELL = 2;
/** Candidate levels examined per cell (fixed loop bound, mirrored in GLSL). */
export const MAX_CANDIDATES = 6;

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

const siteCache = new WeakMap();
/** Elevation range and contour spacing for a decoded heightmap, computed once
 * per heightmap and shared by the renderer and the map key. */
export function siteContours(hm) {
  let c = siteCache.get(hm.heights);
  if (!c) {
    const { minM, maxM } = elevationRange(hm.heights);
    c = { minM, maxM, interval: contourInterval(minM, maxM), majorEvery: MAJOR_EVERY };
    siteCache.set(hm.heights, c);
  }
  return c;
}

/** Elevation with the corner nudge applied for level L. */
export function nudge(e, level) {
  return Math.abs(e - level) < NUDGE_M ? level + NUDGE_M : e;
}

function isMajorLevel(level, interval, majorEvery) {
  const k = level / (interval * majorEvery);
  return Math.abs(k - Math.round(k)) < 1e-6;
}

/**
 * Marching-squares segments of level L in one cell. Cell coordinates: x right,
 * y up, both 0..1; corners bl (0,0), br (1,0), tl (0,1), tr (1,1). Edge crossings
 * are linear interpolations of the two corner elevations, so a neighbouring cell
 * that shares the edge gets exactly the same point. Saddles are resolved with the
 * cell-centre average. Returns [[x0, y0, x1, y1], ...] (0, 1 or 2 segments).
 */
export function levelSegments({ tl, tr, bl, br }, level) {
  const a = { bl: nudge(bl, level), br: nudge(br, level), tl: nudge(tl, level), tr: nudge(tr, level) };
  const up = { bl: a.bl >= level, br: a.br >= level, tl: a.tl >= level, tr: a.tr >= level };
  const t = (p, q) => (level - p) / (q - p);
  // Crossing points per edge (null when the edge is not crossed).
  const bottom = up.bl !== up.br ? [t(a.bl, a.br), 0] : null;
  const right = up.br !== up.tr ? [1, t(a.br, a.tr)] : null;
  const top = up.tl !== up.tr ? [t(a.tl, a.tr), 1] : null;
  const left = up.bl !== up.tl ? [0, t(a.bl, a.tl)] : null;
  const pts = [bottom, right, top, left].filter(Boolean);
  if (pts.length === 2) return [[...pts[0], ...pts[1]]];
  if (pts.length !== 4) return [];
  // Saddle: two diagonal corners above, two below. If the centre is above, the
  // above corners connect through the middle and the below corners are cut off.
  const centreUp = (a.bl + a.br + a.tl + a.tr) / 4 >= level;
  const cutBl = up.bl !== centreUp; // bl is cut off when it differs from the centre
  return cutBl
    ? [[...left, ...bottom], [...right, ...top]] // cut bl and tr
    : [[...bottom, ...right], [...top, ...left]]; // cut br and tl
}

/**
 * Contours drawn in one cell from its 4 corner elevations (corners are shared
 * with the neighbouring cells, so crossings agree and chains are continuous).
 * Returns up to MAX_LEVELS_PER_CELL entries { level, major, segments }.
 * Thinning: minor levels only where neighbours are >= MIN_MINOR_SPACING_CELLS
 * apart, index levels >= MIN_MAJOR_SPACING_CELLS (spacing from the cell's slope).
 */
export function cellContours(corners, interval, majorEvery = MAJOR_EVERY) {
  const { tl, tr, bl, br } = corners;
  const lo = Math.min(tl, tr, bl, br);
  const hi = Math.max(tl, tr, bl, br);
  const gx = (tr + br - tl - bl) / 2; // metres per cell
  const gy = (tl + tr - bl - br) / 2;
  const slope = Math.hypot(gx, gy);
  const minorSpacing = slope > 0 ? interval / slope : Infinity;
  const minorOk = minorSpacing >= MIN_MINOR_SPACING_CELLS;
  const majorOk = minorSpacing * majorEvery >= MIN_MAJOR_SPACING_CELLS;
  const out = [];
  // With the nudge a corner is "above" L when e > L - NUDGE_M, so L is crossed
  // exactly when lo + NUDGE_M <= L < hi + NUDGE_M.
  const first = Math.ceil((lo + NUDGE_M) / interval);
  for (let k = 0; k < MAX_CANDIDATES && out.length < MAX_LEVELS_PER_CELL; k++) {
    const level = (first + k) * interval;
    if (level >= hi + NUDGE_M) break;
    const major = isMajorLevel(level, interval, majorEvery);
    if (major ? !majorOk : !minorOk) continue;
    const segments = levelSegments(corners, level);
    if (segments.length) out.push({ level, major, segments });
  }
  return out;
}

/** Contour colours: palette key and linear-light scale. Restrained grey in shadow
 * (teal is reserved for Earth / comms, spec 8.1), amber only for index lines in
 * sunlight. Shared by the glyph pass, the plain (Off) view and the map key. */
export const CONTOUR_STYLE = {
  minorShadow: { key: 'grey', scale: 0.1 },
  majorShadow: { key: 'grey', scale: 0.2 },
  minorLit: { key: 'grey', scale: 0.28 },
  majorLit: { key: 'moonHi', scale: 0.85 },
};
/** Strength of the density glyph left under a contour stroke in ASCII mode. */
export const CONTOUR_UNDER_GLYPH = 0.35;
/** Stroke widths as a fraction of the cell, close to the bold glyph font's stroke. */
export const MINOR_STROKE_PER_CELL = 0.11;
export const MAJOR_STROKE_PER_CELL = 0.2;
