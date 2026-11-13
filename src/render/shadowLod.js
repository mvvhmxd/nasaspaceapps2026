// Shadow map size while the Sun is moving (motion level of detail). Pure.
//
// In ASCII mode the terrain is sampled once per glyph cell, so shadow detail finer
// than a cell is never seen. A shadow texel of at most half a cell is enough:
// at default zoom a cell is ~70 m and 512² already gives ~30 m texels over the
// 15 km shadow frustum; zoomed in to ~6 m cells it climbs back to 4096².
// Plain shading (ASCII Off) shows every pixel, so it keeps `offSize`.

const nextPow2 = (x) => 2 ** Math.ceil(Math.log2(Math.max(1, x)));

/**
 * @param {object} o
 * @param {number} o.coverM     width of the shadow camera frustum in metres
 * @param {number} o.cellM      glyph cell size in metres on screen (ASCII), or null when ASCII is off
 * @param {number} o.stillSize  the preset's full shadow map size (upper bound)
 * @param {number} [o.minSize]  lower bound
 * @param {number} [o.offSize]  size used while moving with ASCII off
 */
export function motionShadowSize({ coverM, cellM, stillSize, minSize = 512, offSize = 2048 }) {
  if (!(cellM > 0)) return Math.min(stillSize, offSize);
  const needed = nextPow2(coverM / (cellM / 2));
  return Math.min(stillSize, Math.max(minSize, needed));
}
