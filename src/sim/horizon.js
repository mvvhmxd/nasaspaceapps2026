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

/**
 * Terrain height (m) at world (x, z); NaN outside the grid. Interpolates on the
 * same two triangles per cell that the render mesh draws (split along the
 * north-east to south-west diagonal; see src/render/terrain.js), so the sim's
 * horizon and the rendered shadows come from one surface.
 */
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
  // a = (r0, c0), b = (r0, c0 + 1), c = (r0 + 1, c0), d = (r0 + 1, c0 + 1)
  if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
  return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}

/** World height of the observer's eye (m): ground at the centre plus mast height. */
export function observerEyeHeight(hm, observerHeightM = 2) {
  return heightAt(hm, 0, 0) + observerHeightM;
}

/**
 * Distances (m) along a ray from the centre where it crosses a mesh edge: grid
 * columns, grid rows and the cells' NE-SW diagonals. Along the ray the mesh
 * height is linear between these points, so the elevation angle peaks at one of
 * them; checking them all gives the exact horizon of the drawn surface.
 */
function edgeCrossings(hm, ex, nz) {
  const half = (hm.size - 1) / 2;
  const s = hm.spacingM;
  const out = [];
  // column index gx = half + ex*d/s, row index gz = half - nz*d/s, diagonal gx + gz = integer
  for (const rate of [ex / s, -nz / s, (ex - nz) / s]) {
    if (Math.abs(rate) < 1e-12) continue;
    const base = rate === (ex - nz) / s ? 2 * half : half;
    const lo = rate > 0 ? Math.floor(base) + 1 : Math.ceil(base) - 1;
    const stepK = rate > 0 ? 1 : -1;
    for (let k = lo; ; k += stepK) {
      const d = (k - base) / rate;
      if (d > hm.size * s * 1.5) break;
      out.push(d);
    }
  }
  return out;
}

/**
 * Horizon mask with one value per whole-degree azimuth (index i = azimuth i deg):
 * the highest elevation angle of the mesh surface along each azimuth, out to
 * the edge of the grid.
 */
export function computeMask(hm, { observerHeightM = 2, bins = 360 } = {}) {
  const eye = observerEyeHeight(hm, observerHeightM);
  const mask = new Array(bins);
  for (let i = 0; i < bins; i++) {
    const az = (i * 360) / bins;
    const ex = Math.sin(az * DEG); // east component
    const nz = Math.cos(az * DEG); // north component
    let best = -90;
    for (const d of edgeCrossings(hm, ex, nz)) {
      const h = heightAt(hm, ex * d, -nz * d);
      if (Number.isNaN(h)) continue;
      const el = Math.atan2(h - curvatureDrop(d) - eye, d) / DEG;
      if (el > best) best = el;
    }
    mask[i] = best;
  }
  return mask;
}
