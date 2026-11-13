import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTopDownCamera, fitTopDown, gridOffsetPx } from '../../src/render/camera.js';
import { cellTargetLayout, cellTargetFrustum } from '../../src/render/cellGrid.js';

// Projection of a world point to pixel coordinates (origin bottom-left).
function toPx(cam, x, z, w, h) {
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(x, 0, z).project(cam);
  return [((v.x + 1) / 2) * w, ((v.y + 1) / 2) * h];
}

function setup(dpr, zoom, camX, camZ) {
  const bufW = Math.floor(1366 * dpr);
  const bufH = Math.floor(768 * dpr);
  const cell = Math.round(10 * dpr);
  const cam = createTopDownCamera(10000, 1);
  fitTopDown(cam, bufW / bufH);
  cam.zoom = zoom;
  cam.position.x = camX;
  cam.position.z = camZ;
  cam.updateProjectionMatrix();
  const off = gridOffsetPx(cam, bufH, cell);
  const layout = cellTargetLayout(bufW, bufH, cell);
  const f = cellTargetFrustum(cam, bufH, cell, off, layout);
  const rt = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, cam.near, cam.far);
  rt.position.copy(cam.position);
  rt.quaternion.copy(cam.quaternion);
  rt.updateProjectionMatrix();
  return { bufW, bufH, cell, cam, off, layout, rt };
}

const CASES = [];
for (const dpr of [1, 1.25, 1.5, 2]) {
  for (const [zoom, x, z] of [[1, 0, 0], [2.5, 1234.5, -567.25], [0.7, -3210.1, 2222.2], [12, 41.3, -17.9]]) {
    CASES.push([dpr, zoom, x, z]);
  }
}

describe('cell-aligned terrain target', () => {
  it.each(CASES)('dpr %s zoom %s: every ground point lands in the texel block of its glyph cell', (dpr, zoom, x, z) => {
    const { bufW, bufH, cell, cam, off, layout, rt } = setup(dpr, zoom, x, z);
    let checked = 0;
    for (let a = 0; a < 400; a++) {
      // spread points over the visible area
      const sx = ((a * 37) % 101) / 100;
      const sy = ((a * 53) % 97) / 96;
      const halfW = (cam.right - cam.left) / (2 * zoom);
      const halfH = (cam.top - cam.bottom) / (2 * zoom);
      const wx = x + (sx * 2 - 1) * halfW;
      const wz = z + (sy * 2 - 1) * halfH;
      const [fx, fy] = toPx(cam, wx, wz, bufW, bufH);
      const ci = [(fx + off[0]) / cell, (fy + off[1]) / cell];
      const [tx, ty] = toPx(rt, wx, wz, layout.width, layout.height);
      const ti = [tx / layout.k, ty / layout.k];
      // Same continuous cell coordinate, so the same cell and the same spot in it.
      expect(Math.abs(ci[0] - ti[0])).toBeLessThan(1e-6 * layout.cols + 1e-6);
      expect(Math.abs(ci[1] - ti[1])).toBeLessThan(1e-6 * layout.rows + 1e-6);
      checked++;
    }
    expect(checked).toBe(400);
  });

  it.each(CASES)('dpr %s zoom %s: the target covers the whole screen', (dpr, zoom, x, z) => {
    const { bufW, bufH, cell, off, layout } = setup(dpr, zoom, x, z);
    // last pixel centre on screen falls inside the last column / row
    const lastCol = Math.floor((bufW - 0.5 + off[0]) / cell);
    const lastRow = Math.floor((bufH - 0.5 + off[1]) / cell);
    expect(lastCol).toBeLessThan(layout.cols);
    expect(lastRow).toBeLessThan(layout.rows);
    expect(Math.floor((0.5 + off[0]) / cell)).toBe(0);
  });

  it('covers the screen even with an offset just under one cell', () => {
    const layout = cellTargetLayout(1366, 768, 10);
    for (const o of [0, 0.001, 9.999]) {
      expect(Math.floor((1366 - 0.5 + o) / 10)).toBeLessThan(layout.cols);
      expect(Math.floor((768 - 0.5 + o) / 10)).toBeLessThan(layout.rows);
    }
    expect(layout).toEqual({ cols: 138, rows: 78, k: 2, width: 276, height: 156 });
  });
});
