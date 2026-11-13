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
    const heads = (body) => {
      const g = m.group.getObjectByName(body);
      return { solid: g.getObjectByName('solid').visible, hollow: g.getObjectByName('hollow').visible };
    };
    expect(heads('sun')).toEqual({ solid: true, hollow: false });
    expect(heads('earth')).toEqual({ solid: false, hollow: true });
    // and it follows the next hour's state
    m.set({ sunAz: 90, sunlit: false, earthAz: 10, earthVisible: true });
    expect(heads('sun')).toEqual({ solid: false, hollow: true });
    expect(heads('earth')).toEqual({ solid: true, hollow: false });
    m.dispose();
  });
});
