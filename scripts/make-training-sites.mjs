// Writes public/sites/site-{a,b,c}.json: three TRAINING sites.
//   Sky:     REAL. Sun/Earth series from SPICE (DE440), checked against JPL Horizons
//            (pipeline/scripts/04_ephemeris.py and 06_validate.py must be run first).
//   Terrain: ILLUSTRATIVE. Procedural heightmap, not LOLA. The sites stay flagged
//            `illustrative: true` until the pipeline delivers real terrain.
// The coordinates are round-number test points, not selected or proposed landing sites.
// Run: node scripts/make-training-sites.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { computeMask } from '../src/sim/horizon.js';
import { decodeHeightmap } from '../src/data/loadSite.js';

const SIZE = 257;
const SPACING_M = 40;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (t) => t * t * (3 - 2 * t);
function makeFbm(seed) {
  const N = 64, rand = mulberry32(seed);
  const lattice = Array.from({ length: N * N }, () => rand() * 2 - 1);
  const at = (i, j) => lattice[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    return (at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx) * (1 - fy) + (at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx) * fy;
  };
  return (x, y) => { let s = 0, a = 1, f = 1; for (let o = 0; o < 5; o++) { s += a * noise(x * f, y * f); a *= 0.5; f *= 2; } return s; };
}
function crater(x, z, [cx, cz, radius, depth, rim]) {
  const r = Math.hypot(x - cx, z - cz) / radius;
  return r < 1 ? -depth * (1 - r * r) + rim * r ** 4 : rim * Math.exp(-((r - 1) ** 2) / 0.08);
}
function ridge(x, z, [ax, az, bx, bz, height, width]) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  const d = Math.hypot(x - (ax + t * vx), z - (az + t * vz));
  return height * Math.sin(Math.PI * t) ** 0.5 * Math.exp(-(d * d) / (2 * width * width));
}

// x east, z south, metres from the landing point.
const SITES = [
  { id: 'site-a', name: 'Training site A: high rise', seed: 2026, rise: 320,
    blurb: 'On a broad rise. Open sky in most directions, one ridge to the east.',
    craters: [[-2600, 2200, 1900, 420, 140], [700, 800, 320, 60, 18], [-900, -3300, 700, 120, 40]],
    ridges: [[1800, -4200, 3600, 1400, 360, 650]] },
  { id: 'site-b', name: 'Training site B: shallow basin', seed: 77, rise: 90,
    blurb: 'Inside a wide, shallow basin. Flat and sheltered, but the rim hides a low Sun.',
    craters: [[300, -200, 3800, 20, 35], [-1500, 1200, 500, 60, 20]],
    ridges: [[-4400, -3000, -1200, -4600, 70, 500]] },
  { id: 'site-c', name: 'Training site C: rim saddle', seed: 913, rise: 200,
    blurb: 'On a rim between two low peaks. Good light, with gaps when the Sun passes behind a peak.',
    craters: [[2900, 600, 2300, 300, 60], [-600, -2500, 450, 70, 20]],
    ridges: [[-3800, -1500, -1500, 3200, 110, 550], [900, -4300, 3000, -2800, 90, 420]] },
];

function build(def) {
  const fbm = makeFbm(def.seed);
  const raw = (x, z) => {
    let h = 1500 + 70 * fbm(x / 2200 + 10, z / 2200 + 10);
    h += def.rise * Math.exp(-(x * x + z * z) / (2 * 1700 * 1700));
    for (const c of def.craters) h += crater(x, z, c);
    for (const r of def.ridges) h += ridge(x, z, r);
    return h;
  };
  const pad = raw(0, 0);
  const height = (x, z) => {
    const r = Math.hypot(x, z), h = raw(x, z);
    if (r >= 300) return h;
    const w = smooth(Math.max(0, (r - 150) / 150)); // flat 150 m landing pad
    return h * w + pad * (1 - w);
  };
  const half = (SIZE - 1) / 2;
  const heights = new Float32Array(SIZE * SIZE);
  let minM = Infinity, maxM = -Infinity;
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
    const h = height((col - half) * SPACING_M, (row - half) * SPACING_M);
    heights[row * SIZE + col] = h; minM = Math.min(minM, h); maxM = Math.max(maxM, h);
  }
  minM = Math.floor(minM); maxM = Math.ceil(maxM);
  const bytes = Buffer.alloc(SIZE * SIZE * 2);
  for (let i = 0; i < heights.length; i++) bytes.writeUInt16LE(Math.round(((heights[i] - minM) / (maxM - minM)) * 65535), 2 * i);
  const heightmap = { size: SIZE, spacingM: SPACING_M, minM, maxM, data: bytes.toString('base64') };
  const horizonMask = computeMask(decodeHeightmap(heightmap)).map((v) => +v.toFixed(3));

  const eph = JSON.parse(readFileSync(`pipeline/data/ephemeris/${def.id}.json`, 'utf8'));
  const val = JSON.parse(readFileSync(`pipeline/validation/${def.id}.json`, 'utf8'));
  if (!val.pass) throw new Error(`${def.id}: Horizons validation did not pass`);
  const r3 = (a) => a.map((v) => +v.toFixed(3));
  const s = eph.series;
  return {
    schemaVersion: 2,
    id: def.id, name: def.name, blurb: def.blurb, lat: eph.lat, lon: eph.lon,
    illustrative: true, // terrain is procedural
    source: 'Sky: SPICE DE440 (NAIF), checked against JPL Horizons. Terrain: procedural, illustrative, not LOLA. ' +
      'Coordinates are a test point, not a selected landing site.',
    maskSource: 'procedural-terrain',
    sky: {
      real: true, method: eph.provenance.method, kernels: eph.provenance.kernels, frame: eph.provenance.frame,
      aberration: eph.provenance.aberration,
      validation: {
        against: 'JPL Horizons API', toleranceDeg: val.toleranceDeg, checkedUtc: val.checkedUtc,
        sunMaxSeparationDeg: val.bodies.sun.maxSeparationDeg, earthMaxSeparationDeg: val.bodies.earth.maxSeparationDeg,
      },
    },
    heightmap, horizonMask,
    series: { startUtc: s.startUtc, stepHours: s.stepHours, sunAz: r3(s.sunAz), sunEl: r3(s.sunEl), earthAz: r3(s.earthAz), earthEl: r3(s.earthEl) },
  };
}

mkdirSync('public/sites', { recursive: true });
for (const def of SITES) {
  const site = build(def);
  const json = JSON.stringify(site);
  writeFileSync(`public/sites/${def.id}.json`, json);
  const m = site.horizonMask, n = site.series.sunAz.length;
  const maskAt = (az) => m[Math.round(az) % 360];
  const lit = site.series.sunEl.filter((el, i) => el > maskAt(site.series.sunAz[i])).length;
  const earth = site.series.earthEl.filter((el, i) => el > maskAt(site.series.earthAz[i])).length;
  console.log(`${def.id}: ${(json.length / 1024).toFixed(0)} KB, mask ${Math.min(...m).toFixed(2)}..${Math.max(...m).toFixed(2)} deg, ` +
    `sunlit ~${((100 * lit) / n).toFixed(0)}%, Earth ~${((100 * earth) / n).toFixed(0)}% of ${n} h`);
}
