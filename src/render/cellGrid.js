// Geometry of the low-resolution terrain target used by the ASCII pass.
// Pure math (no WebGL) so the mapping is unit-tested against real projection.
//
// The glyph grid is anchored to the ground (see camera.gridOffsetPx): screen
// cell (i, j) covers drawing-buffer pixels [i*cell - ox, (i+1)*cell - ox) and the
// same in y (origin bottom-left, like gl_FragCoord). The terrain is rendered
// into a target of K x K texels per cell whose frustum is shifted by the same
// offset, so texel block (K*i .. K*i+K-1, K*j .. K*j+K-1) is exactly cell (i, j).

export const TEXELS_PER_CELL = 2;

/**
 * Columns / rows of glyph cells that can touch the screen for any offset in
 * [0, cell), and the target size. Independent of the offset, so the target is
 * only reallocated when the screen or the cell size changes.
 */
export function cellTargetLayout(bufW, bufH, cellPx, k = TEXELS_PER_CELL) {
  const cols = Math.ceil(bufW / cellPx) + 1;
  const rows = Math.ceil(bufH / cellPx) + 1;
  return { cols, rows, k, width: cols * k, height: rows * k };
}

/**
 * Orthographic frustum (camera space, zoom 1) for the terrain target, given the
 * on-screen camera `cam` (left/right/top/bottom/zoom), the drawing-buffer height,
 * the cell size and the grid offset [ox, oy] in drawing-buffer pixels.
 */
export function cellTargetFrustum(cam, bufH, cellPx, [ox, oy], layout) {
  const halfH = (cam.top - cam.bottom) / (2 * cam.zoom);
  const halfW = (cam.right - cam.left) / (2 * cam.zoom);
  const left = (cam.left + cam.right) / 2 - halfW;
  const bottom = (cam.top + cam.bottom) / 2 - halfH;
  const mpp = (2 * halfH) / bufH; // metres per drawing-buffer pixel (same rule as gridOffsetPx)
  return {
    left: left - ox * mpp,
    right: left + (layout.cols * cellPx - ox) * mpp,
    bottom: bottom - oy * mpp,
    top: bottom + (layout.rows * cellPx - oy) * mpp,
  };
}
