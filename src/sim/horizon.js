// Horizon mask: for each azimuth, the highest elevation angle of the terrain
// as seen from the observer. Same math the data pipeline uses, so the game and
// the pipeline agree. Includes lunar curvature (drop = d^2 / 2R).
//
// Conventions (see docs/ARCHITECTURE.md):
//   world x = east (m), world z = south (m), y = up (m); north = -z
//   grid row 0 = north edge, col 0 = west edge, observer at the grid centre
//   azimuth clockwise from north, elevation in degrees

export const MOON_RADIUS_M = 1737400;

const DEG = Math.PI / 180;

/** Curvature drop (m) of the surface at horizontal distance d (m) from the observer. */
export function curvatureDrop(d) {
  return (d * d) / (2 * MOON_RADIUS_M);
}

/** Bilinear terrain height (m) at world (x, z); NaN outside the grid. */
export function heightAt(hm, x, z) {
  const half = (hm.size - 1) / 2;
  const gx = x / hm.spacingM + half; // column
  const gz = z / hm.spacingM + half; // row
  if (gx < 0 || gz < 0 || gx > hm.size - 1 || gz > hm.size - 1) return NaN;
  const c0 = Math.min(Math.floor(gx), hm.size - 2);
  const r0 = Math.min(Math.floor(gz), hm.size - 2);
  const fx = gx - c0;
  const fz = gz - r0;
  const h = hm.heights;
  const n = hm.size;
  const a = h[r0 * n + c0];
  const b = h[r0 * n + c0 + 1];
  const c = h[(r0 + 1) * n + c0];
  const d = h[(r0 + 1) * n + c0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

/** World height of the observer's eye (m): ground at the centre plus mast height. */
export function observerEyeHeight(hm, observerHeightM = 2) {
  return heightAt(hm, 0, 0) + observerHeightM;
}

/**
 * Horizon mask with one value per whole-degree azimuth (index i = azimuth i deg).
 * Marches each azimuth outward from the centre until the edge of the grid.
 */
export function computeMask(hm, { observerHeightM = 2, bins = 360, stepFactor = 0.5 } = {}) {
  const eye = observerEyeHeight(hm, observerHeightM);
  const step = hm.spacingM * stepFactor;
  const mask = new Array(bins);
  for (let i = 0; i < bins; i++) {
    const az = (i * 360) / bins;
    const ex = Math.sin(az * DEG); // east component
    const nz = Math.cos(az * DEG); // north component
    let best = -90;
    for (let d = step; ; d += step) {
      const h = heightAt(hm, ex * d, -nz * d);
      if (Number.isNaN(h)) break;
      const el = Math.atan2(h - curvatureDrop(d) - eye, d) / DEG;
      if (el > best) best = el;
    }
    mask[i] = best;
  }
  return mask;
}
