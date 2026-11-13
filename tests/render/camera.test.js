import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTopDownCamera, gridOffsetPx } from '../../src/render/camera.js';

const W = 1366, H = 768, CELL = 10;

// Pixel position of a world point, in gl_FragCoord terms (origin bottom-left).
function toPx(cam, x, z) {
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(x, 0, z).project(cam);
  return [((v.x + 1) / 2) * W, ((v.y + 1) / 2) * H];
}
const wrap = (v) => ((v % CELL) + CELL) % CELL;
// Distance on a circle of length CELL (9.9999 and 0.0001 are 0.0002 apart).
const cellDist = (a, b) => { const d = Math.abs(a - b) % CELL; return Math.min(d, CELL - d); };

describe('gridOffsetPx', () => {
  it('keeps a ground point at the same spot inside its glyph cell while panning', () => {
    const cam = createTopDownCamera(10000, W / H);
    cam.zoom = 2.5;
    cam.updateProjectionMatrix();
    // a fractional-scale buffer height (768 CSS px at 125 %) is covered by H below
    const ref = () => {
      const [px, py] = toPx(cam, 1234, -567);
      const [ox, oy] = gridOffsetPx(cam, H, CELL);
      return [wrap(px + ox), wrap(py + oy)];
    };
    const start = ref();
    for (const [dx, dz] of [[3.7, 0], [0, -11.2], [-250.3, 98.6], [4000, 4000]]) {
      cam.position.x += dx;
      cam.position.z += dz;
      const now = ref();
      expect(cellDist(now[0], start[0])).toBeLessThan(1e-3);
      expect(cellDist(now[1], start[1])).toBeLessThan(1e-3);
    }
  });

  it('stays inside one cell', () => {
    const cam = createTopDownCamera(10000, W / H);
    cam.position.set(-98765.4, 50000, 4321.1);
    const [ox, oy] = gridOffsetPx(cam, H, CELL);
    for (const o of [ox, oy]) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(CELL);
    }
  });
});
