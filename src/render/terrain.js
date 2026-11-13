// Terrain mesh from a decoded heightmap. No WebGL here, so tests can use it in Node.
// The mesh bakes in lunar curvature (drop = d^2 / 2R from the landing site),
// matching src/sim/horizon.js, so render shadows and the sim's mask agree.
import * as THREE from 'three';
import { curvatureDrop, observerEyeHeight } from '../sim/horizon.js';

/**
 * Build the terrain as a Group of chunk meshes (chunking lets the raycaster
 * and the camera skip most of the terrain).
 */
export function buildTerrain(hm, { chunkCells = 32, material } = {}) {
  const { size: n, spacingM: s, heights } = hm;
  const half = (n - 1) / 2;
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0xc9ced6 });
  const group = new THREE.Group();
  group.name = 'terrain';

  const worldY = (r, c) => {
    const x = (c - half) * s;
    const z = (r - half) * s;
    return heights[r * n + c] - curvatureDrop(Math.hypot(x, z));
  };
  // Normals from central differences on the full grid: no seams between chunks.
  const normalAt = (r, c, out) => {
    const l = worldY(r, Math.max(c - 1, 0));
    const rr = worldY(r, Math.min(c + 1, n - 1));
    const u = worldY(Math.max(r - 1, 0), c);
    const d = worldY(Math.min(r + 1, n - 1), c);
    return out.set(l - rr, 2 * s, u - d).normalize();
  };

  const tmp = new THREE.Vector3();
  for (let r0 = 0; r0 < n - 1; r0 += chunkCells) {
    for (let c0 = 0; c0 < n - 1; c0 += chunkCells) {
      const r1 = Math.min(r0 + chunkCells, n - 1);
      const c1 = Math.min(c0 + chunkCells, n - 1);
      const w = c1 - c0 + 1;
      const hgt = r1 - r0 + 1;
      const pos = new Float32Array(w * hgt * 3);
      const nor = new Float32Array(w * hgt * 3);
      let k = 0;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          pos[k] = (c - half) * s;
          pos[k + 1] = worldY(r, c);
          pos[k + 2] = (r - half) * s;
          normalAt(r, c, tmp);
          nor[k] = tmp.x;
          nor[k + 1] = tmp.y;
          nor[k + 2] = tmp.z;
          k += 3;
        }
      }
      const idx = [];
      for (let r = 0; r < hgt - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const a = r * w + c;
          const b = a + 1;
          const d = a + w;
          const e = d + 1;
          idx.push(a, d, b, b, d, e); // counter-clockwise seen from above
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  group.updateMatrixWorld(true);
  return group;
}

/** Landing-site eye point in world space (ground at the centre + mast height). */
export function landerEye(hm, observerHeightM = 2) {
  return new THREE.Vector3(0, observerEyeHeight(hm, observerHeightM), 0);
}

const raycaster = new THREE.Raycaster();
raycaster.near = 1;
raycaster.far = 1e6;

/** True when terrain blocks the straight line from origin toward dir. */
export function blockedToward(terrain, origin, dir) {
  raycaster.set(origin, dir);
  return raycaster.intersectObjects(terrain.children, false).length > 0;
}
