// Pure geometry for the horizon strip: a 360° panorama of the site's skyline,
// north in the middle, east to the right. No DOM, no React, so it is unit-tested.

/** Azimuth (deg, clockwise from north) → offset from north in [-180, 180). */
export function northCentred(az) {
  return ((((az + 180) % 360) + 360) % 360) - 180;
}

/** Azimuth → x in [0, width): north at width / 2, east to the right. */
export function azToX(az, width) {
  return ((northCentred(az) + 180) / 360) * width;
}

const GRID_STEPS = [0.5, 1, 2, 5, 10];

/**
 * Elevation range for the strip, fixed per site so the scale never jumps while
 * the clock runs. It is fitted to what decides sunlight, the ridge and the Sun
 * over the whole series, so the ridges fill the strip. Earth swings much higher
 * and lower at the pole; when it leaves the range the component pins it to the
 * edge with an arrow instead of flattening the ridges.
 */
export function elevationScale(mask, series, { capDeg = 12, marginDeg = 0.6 } = {}) {
  let maxMask = -Infinity;
  let minMask = Infinity;
  for (const m of mask) { if (m > maxMask) maxMask = m; if (m < minMask) minMask = m; }
  let maxSun = -Infinity;
  for (const e of series.sunEl) if (e > maxSun) maxSun = e;
  const top = Math.min(capDeg, Math.max(maxMask, maxSun, 1) + marginDeg);
  const bottom = Math.min(-marginDeg, minMask - marginDeg);
  const span = top - bottom;
  const step = GRID_STEPS.find((s) => span / s <= 5) ?? GRID_STEPS[GRID_STEPS.length - 1];
  const grid = [];
  for (let g = Math.ceil(bottom / step) * step; g <= top + 1e-9; g += step) grid.push(Math.round(g * 100) / 100);
  return { min: bottom, max: top, step, grid };
}

/** Elevation → y (0 at the top). Values outside the scale are clamped to the edge. */
export function elToY(el, scale, height) {
  const f = (el - scale.min) / (scale.max - scale.min);
  return (1 - Math.min(1, Math.max(0, f))) * height;
}

/** 'above' / 'below' when `el` falls outside the scale (marker pinned to that edge), else 'no'. */
export function pinState(el, scale) {
  return el > scale.max ? 'above' : el < scale.min ? 'below' : 'no';
}

/**
 * Skyline polyline points, one per mask bin from due south round through west,
 * north and east back to due south (n + 1 points; the first and last both sit at
 * due south). Uses the mask's own bins: no smoothing.
 */
export function skylinePoints(mask, width, height, scale) {
  const n = mask.length;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const az = (180 + (k * 360) / n) % 360;
    const i = Math.round((az * n) / 360) % n;
    pts.push([(k / n) * width, elToY(mask[i], scale, height)]);
  }
  return pts;
}

/** SVG path data for the skyline line and the filled ground below it. */
export function skylinePaths(mask, width, height, scale) {
  const pts = skylinePoints(mask, width, height, scale);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return { line, ground: `${line}L${width} ${height}L0 ${height}Z`, points: pts.length };
}

/** How much taller than true angles the strip draws ridges (vertical exaggeration). */
export function exaggeration(width, height, scale) {
  const pxPerDegY = height / (scale.max - scale.min);
  const pxPerDegX = width / 360;
  return Math.max(1, Math.round(pxPerDegY / pxPerDegX));
}

/** Compass ticks: N, E, S (both edges) and W labels, plus 45° minor ticks. */
export function compassTicks(width) {
  const major = [['S', 180, 0], ['W', 270], ['N', 0], ['E', 90], ['S', 180, width]].map(
    ([label, az, x]) => ({ label, az, x: x ?? azToX(az, width) }),
  );
  const minor = [225, 315, 45, 135].map((az) => ({ az, x: azToX(az, width) }));
  return { major, minor };
}

/** The gap between a body and the ridge at its azimuth, as a short label. */
export function gapLabel(name, el, maskEl) {
  const d = el - maskEl;
  const v = Math.abs(d).toFixed(1);
  return d > 0 ? `${name} ${v}° above ridge` : `ridge ${v}° above ${name}`;
}
