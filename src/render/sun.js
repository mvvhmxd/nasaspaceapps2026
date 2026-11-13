import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * Unit vector toward a body at azimuth az (clockwise from north) and
 * elevation el, both in degrees. World axes: x = east, y = up, z = south.
 */
export function directionFromAzEl(az, el, target = new THREE.Vector3()) {
  const c = Math.cos(el * DEG);
  return target.set(Math.sin(az * DEG) * c, Math.sin(el * DEG), -Math.cos(az * DEG) * c);
}
