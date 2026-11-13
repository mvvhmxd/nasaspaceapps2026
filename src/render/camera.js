import * as THREE from 'three';

/**
 * Top-down orthographic camera: looking straight down, north at the top of
 * the screen. `viewM` is how many metres fit across the LONGER screen side,
 * so the terrain covers the screen with no margins (pan to see the rest).
 * (The hero camera arrives in M3.)
 */
export function createTopDownCamera(viewM, aspect) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 200000);
  cam.position.set(0, 50000, 0);
  cam.up.set(0, 0, -1); // screen-up = north (-z)
  cam.lookAt(0, 0, 0);
  cam.userData.viewM = viewM;
  fitTopDown(cam, aspect);
  return cam;
}

export function fitTopDown(cam, aspect) {
  const half = cam.userData.viewM / 2;
  const w = aspect >= 1 ? half : half * aspect;
  const v = aspect >= 1 ? half / aspect : half;
  cam.left = -w;
  cam.right = w;
  cam.top = v;
  cam.bottom = -v;
  cam.updateProjectionMatrix();
}
