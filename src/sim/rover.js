// Rover rules: the player drives a small rover from the lander to ice prospects and back.
// Pure functions, no three.js. World axes as everywhere else: x = east, z = south (metres),
// origin at the lander. All energy numbers are game values, not real rover figures.
import { heightAt, curvatureDrop } from './horizon.js';
import { maskAt } from './visibility.js';

export const ROVER = {
  batteryCapacity: 100,
  speedMPerH: 150, // on flat ground
  driveCostPer100M: 1,
  climbFactor: 6, // extra cost per unit of uphill grade (a 20% climb costs 2.2x)
  maxSlopeDeg: 35, // speed falls to 15% at and above this slope
  idleDrain: 0.3, // per hour, away from the lander
  chargeSunlit: 6, // per hour in sunlight
  drillHours: 2,
  drillDrain: 1, // per hour while drilling
  dockRadiusM: 120,
  targetRadiusM: 90,
  maxCarry: 2,
  icePackets: 10, // science packets per delivered sample
  eyeM: 1.5,
};

const DEG = Math.PI / 180;

/** Ground height (m) in the game's world frame (curvature drop applied); NaN off the grid. */
export function groundY(hm, x, z) {
  return heightAt(hm, x, z) - curvatureDrop(Math.hypot(x, z));
}

/** True when the local terrain blocks a body at (az, el) seen from eyeM above the ground at (x, z). */
export function localBlocked(hm, x, z, az, el, eyeM = ROVER.eyeM) {
  const eye = groundY(hm, x, z) + eyeM;
  const ex = Math.sin(az * DEG), nz = Math.cos(az * DEG), rise = Math.tan(el * DEG);
  const step = hm.spacingM * 0.5;
  for (let d = step; ; d += step) {
    const h = groundY(hm, x + ex * d, z - nz * d);
    if (Number.isNaN(h)) return false; // reached the edge of the local grid
    if (h > eye + rise * d) return true;
  }
}

/**
 * Is the rover in sunlight? The Sun must clear the lander's far horizon (the site mask, an
 * approximation away from the lander) AND the local 10 km terrain as seen from the rover.
 */
export function sunlitAt(site, x, z, sky) {
  if (sky.sunEl <= maskAt(site.horizonMask, sky.sunAz)) return false;
  return !localBlocked(site.heightmap, x, z, sky.sunAz, sky.sunEl);
}

/**
 * Ice prospects: the deepest reachable low ground in the terrain crop (pits first), the places
 * least likely to see the Sun. These are prospects chosen by this rule, not known ice deposits.
 */
export function findIceTargets(site, count = 4) {
  const hm = site.heightmap, n = hm.size, half = (n - 1) / 2, s = hm.spacingM;
  const stride = 4, win = 8, minR = 600, maxR = half * s - 400, minSep = 800;
  const base = hm.heights[Math.round(half) * n + Math.round(half)];
  const minDepth = 40, maxDepth = 700; // deeper than this is not a round trip the rover can make
  const pits = [], lows = [];
  for (let r = win; r < n - win; r += stride) {
    for (let c = win; c < n - win; c += stride) {
      const x = (c - half) * s, z = (r - half) * s, dist = Math.hypot(x, z);
      if (dist < minR || dist > maxR) continue;
      const h = hm.heights[r * n + c], depthM = Math.round(base - h);
      if (depthM < minDepth || depthM > maxDepth) continue;
      let lowest = true;
      for (let dr = -win; dr <= win && lowest; dr += 2) {
        for (let dc = -win; dc <= win; dc += 2) {
          if (hm.heights[(r + dr) * n + (c + dc)] < h) { lowest = false; break; }
        }
      }
      (lowest ? pits : lows).push({ x, z, depthM, distM: Math.round(dist) });
    }
  }
  // True pits (local low points) first, deepest first; then the lowest reachable ground to fill up.
  const byDepth = (a, b) => b.depthM - a.depthM || a.distM - b.distM;
  const picked = [];
  for (const f of [...pits.sort(byDepth), ...lows.sort(byDepth)]) {
    if (picked.every((p) => Math.hypot(p.x - f.x, p.z - f.z) >= minSep)) picked.push(f);
    if (picked.length === count) break;
  }
  return picked.map((p, i) => ({ id: i, ...p }));
}

export function initialRover() {
  return { x: 0, z: 0, heading: 0, battery: ROVER.batteryCapacity, carrying: 0, delivered: 0, alive: true,
    collected: [], drill: null, sunlit: true, docked: true, distanceM: 0 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Advance the rover by dtH game hours. `input` = { east, north } in -1..1 (zero = parked).
 * Returns { rover, events } with events from: iceCollected, iceDelivered, roverLost.
 */
export function stepRover(site, rover, input, dtH, sky, targets) {
  if (!rover.alive) return { rover, events: [] };
  const hm = site.heightmap, r = { ...rover, collected: [...rover.collected] }, events = [];
  let cost = 0;
  const mag = Math.hypot(input.east, input.north);
  if (mag > 0.01) {
    const ex = input.east / mag, nn = input.north / mag;
    const want = ROVER.speedMPerH * dtH * Math.min(1, mag);
    const h0 = groundY(hm, r.x, r.z), hProbe = groundY(hm, r.x + ex * want, r.z - nn * want);
    r.heading = (Math.atan2(ex, nn) / DEG + 360) % 360;
    r.drill = null;
    if (!Number.isNaN(hProbe) && want > 0) {
      const grade = (hProbe - h0) / want;
      const slopeDeg = Math.abs(Math.atan(grade)) / DEG;
      const dist = want * clamp(1 - slopeDeg / ROVER.maxSlopeDeg, 0.15, 1);
      const nx = r.x + ex * dist, nz = r.z - nn * dist;
      const limit = ((hm.size - 1) / 2) * hm.spacingM - 80;
      if (Math.abs(nx) <= limit && Math.abs(nz) <= limit) {
        r.x = nx; r.z = nz; r.distanceM += dist;
        cost = (dist / 100) * ROVER.driveCostPer100M * (1 + Math.max(0, grade) * ROVER.climbFactor);
      }
    }
  }
  r.docked = Math.hypot(r.x, r.z) <= ROVER.dockRadiusM;
  r.sunlit = sunlitAt(site, r.x, r.z, sky);
  let delta = (r.sunlit ? ROVER.chargeSunlit : 0) * dtH - (r.docked ? 0 : ROVER.idleDrain * dtH) - cost;

  if (mag <= 0.01 && r.carrying < ROVER.maxCarry) {
    const t = targets.find((q) => !r.collected.includes(q.id) && Math.hypot(q.x - r.x, q.z - r.z) <= ROVER.targetRadiusM);
    if (t) {
      const hours = (r.drill?.id === t.id ? r.drill.hours : 0) + dtH;
      delta -= ROVER.drillDrain * dtH;
      if (hours >= ROVER.drillHours) {
        r.carrying += 1; r.collected.push(t.id); r.drill = null;
        events.push('iceCollected');
      } else r.drill = { id: t.id, hours };
    } else r.drill = null;
  }
  if (r.docked && r.carrying > 0) {
    r.delivered += r.carrying; r.carrying = 0;
    events.push('iceDelivered');
  }
  r.battery = clamp(r.battery + delta, 0, ROVER.batteryCapacity);
  if (r.battery <= 0) {
    r.alive = false; r.carrying = 0; r.drill = null;
    events.push('roverLost');
  }
  return { rover: r, events };
}

/** Science packets earned by delivered ice. */
export const iceScore = (rover) => rover.delivered * ROVER.icePackets;
