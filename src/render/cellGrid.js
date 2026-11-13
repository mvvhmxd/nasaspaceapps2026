// Geometry of the low-resolution terrain target used by the ASCII pass.
// Pure math (no WebGL) so the mapping is unit-tested against real projection.
//
// The glyph grid is anchored to the ground (see camera.gridOffsetPx): screen
// cell (i, j) covers drawing-buffer pixels [i*cell - ox, (i+1)*cell - ox) and the
// same in y (origin bottom-left, like gl_FragCoord). The terrain is rendered
// into a target with one texel per cell CORNER: texel (i, j) is centred exactly
// on the corner of cells shared at (i*cell - ox, j*cell - oy). Each glyph cell
// reads its 4 corners (i..i+1, j..j+1); neighbouring cells share corners, so
// contour crossings agree across cells and contour chains have no gaps.

/**
 * Columns / rows of glyph cells that can touch the screen for any offset in
 * [0, cell), and the target size (one more texel than cells on each axis).
 * Independent of the offset, so the target is only reallocated when the
 * screen or the cell size changes.
 */
export function cellTargetLayout(bufW, bufH, cellPx) {
  const cols = Math.ceil(bufW / cellPx) + 1;
  const rows = Math.ceil(bufH / cellPx) + 1;
  return { cols, rows, width: cols + 1, height: rows + 1 };
}

/**
 * Orthographic frustum (camera space, zoom 1) for the terrain target, given the
 * on-screen camera `cam` (left/right/top/bottom/zoom), the drawing-buffer height,
 * the cell size and the grid offset [ox, oy] in drawing-buffer pixels. Texel i
 * spans screen pixels [(i - 0.5)*cell - ox, (i + 0.5)*cell - ox].
 */
export function cellTargetFrustum(cam, bufH, cellPx, [ox, oy], layout) {
  const halfH = (cam.top - cam.bottom) / (2 * cam.zoom);
  const halfW = (cam.right - cam.left) / (2 * cam.zoom);
  const left = (cam.left + cam.right) / 2 - halfW;
  const bottom = (cam.top + cam.bottom) / 2 - halfH;
  const mpp = (2 * halfH) / bufH; // metres per drawing-buffer pixel (same rule as gridOffsetPx)
  return {
    left: left + (-0.5 * cellPx - ox) * mpp,
    right: left + ((layout.width - 0.5) * cellPx - ox) * mpp,
    bottom: bottom + (-0.5 * cellPx - oy) * mpp,
    top: bottom + ((layout.height - 0.5) * cellPx - oy) * mpp,
  };
}
