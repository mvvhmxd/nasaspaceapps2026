import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { yawForAzimuth, createSkyMarkers } from '../../src/render/markers.js';
import { directionFromAzEl } from '../../src/render/sun.js';

describe('sky markers', () => {
  it('point the same way as the Sun light for any azimuth', () => {
    for (const az of [0, 45, 90, 137.5, 180, 270, 359]) {
      const v = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawForAzimuth(az));
      const want = directionFromAzEl(az, 0);
      expect(v.distanceTo(want)).toBeLessThan(1e-9);
    }
  });

  it('show a solid head above the horizon and a hollow one below', () => {
    const m = createSkyMarkers();
    m.set({ sunAz: 90, sunlit: true, earthAz: 10, earthVisible: false });
    const [sun, earth] = m.group.children;
    const heads = (g) => g.children.slice(1).map((h) => h.visible); // [solid, hollow]
    expect(heads(sun)).toEqual([true, false]);
    expect(heads(earth)).toEqual([false, true]);
    m.dispose();
  });
});
