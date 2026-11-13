// Sun and Earth direction pointers around the lander, drawn crisp above the
// ASCII terrain. They only show what the sim decided (azimuth, and whether the
// body is above the local terrain horizon); they never compute visibility.
// Shape tells them apart, not colour alone: Sun = round head, Earth = diamond
// head; hidden behind terrain = hollow head.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';

const DEG = Math.PI / 180;
const INNER_M = 230; // starts just outside the lander ring
const OUTER_M = 900;
const HEAD_M = 70;
const SHAFT_M = 18;

/** Rotation about +y that turns a north-pointing (−z) shape to azimuth `az`. */
export function yawForAzimuth(az) {
  return -az * DEG;
}

function flat(geom) {
  return geom.rotateX(-Math.PI / 2);
}

function material(color) {
  // Drawn over everything so ridges never hide them in the plain-shading view.
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false });
}

function pointer(color, headSegments) {
  const g = new THREE.Group();
  const mat = material(color);
  const len = OUTER_M - INNER_M - HEAD_M;
  const shaft = new THREE.Mesh(flat(new THREE.PlaneGeometry(SHAFT_M, len)), mat);
  shaft.position.z = -(INNER_M + len / 2);
  const solid = new THREE.Mesh(flat(new THREE.CircleGeometry(HEAD_M, headSegments)), mat);
  const hollow = new THREE.Mesh(flat(new THREE.RingGeometry(HEAD_M * 0.6, HEAD_M, headSegments)), mat);
  for (const head of [solid, hollow]) head.position.z = -(OUTER_M - HEAD_M);
  g.add(shaft, solid, hollow);
  g.renderOrder = 10;
  g.traverse((o) => { o.renderOrder = 10; });
  return {
    group: g,
    set(az, up) {
      g.rotation.y = yawForAzimuth(az);
      solid.visible = up;
      hollow.visible = !up;
      mat.opacity = up ? 1 : 0.55;
      shaft.scale.x = up ? 1 : 0.5;
    },
    dispose() {
      g.traverse((o) => o.geometry?.dispose());
      mat.dispose();
    },
  };
}

/** Group to add to the lander. `set({ sunAz, sunlit, earthAz, earthVisible })` per hour. */
export function createSkyMarkers() {
  const sun = pointer(PALETTE.amber, 32);
  const earth = pointer(PALETTE.teal, 4); // 4 segments = diamond
  const group = new THREE.Group();
  group.add(sun.group, earth.group);
  return {
    group,
    set({ sunAz, sunlit, earthAz, earthVisible }) {
      sun.set(sunAz, sunlit);
      earth.set(earthAz, earthVisible);
    },
    dispose() {
      sun.dispose();
      earth.dispose();
    },
  };
}
