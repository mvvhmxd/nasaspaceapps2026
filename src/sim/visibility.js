// The sim's source of truth for "is the Sun / Earth above the local horizon".
// The 3D render must agree with this, not the other way round.

/** Mask elevation (deg) at any azimuth, linearly interpolated between whole-degree bins. */
export function maskAt(mask, az) {
  const n = mask.length;
  const a = (((az * n) / 360) % n + n) % n;
  const i = Math.floor(a);
  const f = a - i;
  return mask[i] * (1 - f) + mask[(i + 1) % n] * f;
}

/** True when a body at (az, el) is above the terrain horizon. */
export function isAboveHorizon(mask, az, el) {
  return el > maskAt(mask, az);
}

/** Everything the game needs to know about one hour at a site. */
export function stateAt(site, hour) {
  const s = site.series;
  const h = Math.max(0, Math.min(s.sunAz.length - 1, Math.round(hour)));
  const sunAz = s.sunAz[h];
  const sunEl = s.sunEl[h];
  const earthAz = s.earthAz[h];
  const earthEl = s.earthEl[h];
  const sunMask = maskAt(site.horizonMask, sunAz);
  const earthMask = maskAt(site.horizonMask, earthAz);
  const sunNearMask = site.nearMask ? maskAt(site.nearMask, sunAz) : sunMask;
  return {
    hour: h,
    timeUtc: new Date(Date.parse(s.startUtc) + h * s.stepHours * 3600e3),
    sunAz,
    sunEl,
    earthAz,
    earthEl,
    sunMask,
    earthMask,
    sunNearMask,
    sunlit: sunEl > sunMask,
    // In shadow of terrain beyond the crop: the 3D view cannot cast this shadow.
    sunBehindFarTerrain: sunEl <= sunMask && sunEl > sunNearMask,
    earthVisible: earthEl > earthMask,
  };
}
