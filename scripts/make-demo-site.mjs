// Writes public/sites/demo.json: an ILLUSTRATIVE site (procedural terrain and
// a synthetic Sun/Earth series) in the real site format, so the game can be
// built before the data pipeline delivers real LOLA + Horizons data.
// Run: npm run demo-site
import { mkdirSync, writeFileSync } from 'node:fs';
import { computeMask } from '../src/sim/horizon.js';
import { decodeHeightmap } from '../src/data/loadSite.js';

const SIZE = 257; // grid points per side
const SPACING_M = 40; // -> 10.24 km square
const HOURS = 24 * 60; // 60 Earth days
const SYNODIC_H = 29.530589 * 24;
const DRACONIC_H = 27.212221 * 24;
const ANOMALISTIC_H = 27.554550 * 24;

// Seeded RNG + value noise, so the demo site is identical on every machine.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const LATTICE = 64;
const lattice = Array.from({ length: LATTICE * LATTICE }, () => rand() * 2 - 1);
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const at = (i, j) => lattice[(((j % LATTICE) + LATTICE) % LATTICE) * LATTICE + (((i % LATTICE) + LATTICE) % LATTICE)];
  const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
function fbm(x, y) {
  let sum = 0, amp = 1, freq = 1;
  for (let o = 0; o < 5; o++) {
    sum += amp * valueNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

// Crater profile: bowl inside, raised rim, smooth falloff outside.
function crater(x, z, cx, cz, radius, depth, rim) {
  const r = Math.hypot(x - cx, z - cz) / radius;
  if (r < 1) return -depth * (1 - r * r) + rim * r ** 4;
  return rim * Math.exp(-((r - 1) ** 2) / 0.08);
}
// Ridge: gaussian cross-section along a segment.
function ridge(x, z, ax, az, bx, bz, height, width) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  const d = Math.hypot(x - (ax + t * vx), z - (az + t * vz));
  const taper = Math.sin(Math.PI * t) ** 0.5;
  return height * taper * Math.exp(-(d * d) / (2 * width * width));
}

function terrainHeight(x, z) {
  // x east, z south (metres from the landing site)
  let h = 1500 + 70 * fbm(x / 2200 + 10, z / 2200 + 10);
  h += 320 * Math.exp(-(x * x + z * z) / (2 * 1700 * 1700)); // landing site on a broad rise
  h += crater(x, z, -2600, 2200, 1900, 420, 140); // big crater to the south-west
  h += crater(x, z, 700, 800, 320, 60, 18); // small crater near the lander
  h += crater(x, z, -900, -3300, 700, 120, 40); // crater to the north
  h += ridge(x, z, 1800, -4200, 3600, 1400, 360, 650); // ridge to the east
  // Flatten a 150 m pad around the landing site.
  const r = Math.hypot(x, z);
  if (r < 300) {
    const w = smooth(Math.max(0, (r - 150) / 150));
    h = h * w + terrainHeight.pad * (1 - w);
  }
  return h;
}
terrainHeight.pad = 0;

// Build heights.
const half = (SIZE - 1) / 2;
terrainHeight.pad = 1500 + 70 * fbm(10, 10) + 320;
const heights = new Float32Array(SIZE * SIZE);
for (let row = 0; row < SIZE; row++) {
  for (let col = 0; col < SIZE; col++) {
    heights[row * SIZE + col] = terrainHeight((col - half) * SPACING_M, (row - half) * SPACING_M);
  }
}
let minM = Infinity, maxM = -Infinity;
for (const h of heights) { minM = Math.min(minM, h); maxM = Math.max(maxM, h); }
minM = Math.floor(minM);
maxM = Math.ceil(maxM);

// Encode Uint16 little-endian, base64.
const bytes = Buffer.alloc(SIZE * SIZE * 2);
for (let i = 0; i < heights.length; i++) {
  bytes.writeUInt16LE(Math.round(((heights[i] - minM) / (maxM - minM)) * 65535), 2 * i);
}
const heightmap = { size: SIZE, spacingM: SPACING_M, minM, maxM, data: bytes.toString('base64') };

// Mask from the DECODED (quantised) heights, exactly what the game will see.
const horizonMask = computeMask(decodeHeightmap(heightmap)).map((v) => +v.toFixed(3));

// Synthetic series: Sun circles the sky once per synodic month, grazing the
// horizon; Earth wobbles around north with libration-like periods.
const r3 = (v) => +v.toFixed(3);
const series = { startUtc: '2027-03-01T00:00:00Z', stepHours: 1, sunAz: [], sunEl: [], earthAz: [], earthEl: [] };
for (let t = 0; t < HOURS; t++) {
  series.sunAz.push(r3(((t / SYNODIC_H) * 360 + 40) % 360));
  series.sunEl.push(r3(0.75 + 0.75 * Math.sin((2 * Math.PI * t) / HOURS)));
  series.earthAz.push(r3((((7 * Math.sin((2 * Math.PI * t) / ANOMALISTIC_H)) % 360) + 360) % 360));
  series.earthEl.push(r3(1.5 + 6.5 * Math.sin((2 * Math.PI * t) / DRACONIC_H + 0.7)));
}

const site = {
  id: 'demo',
  name: 'Demo crater (illustrative)',
  lat: -89.5,
  lon: 0,
  illustrative: true,
  source: 'Procedural terrain and synthetic Sun/Earth series for development. Not real data.',
  heightmap,
  horizonMask,
  series,
};

mkdirSync('public/sites', { recursive: true });
const json = JSON.stringify(site);
writeFileSync('public/sites/demo.json', json);

const lit = series.sunEl.filter((el, i) => {
  const m = horizonMask[Math.floor(series.sunAz[i]) % 360];
  return el > m;
}).length;
console.log(`demo.json: ${(json.length / 1024).toFixed(0)} KB, terrain ${minM}..${maxM} m, ` +
  `mask ${Math.min(...horizonMask).toFixed(2)}..${Math.max(...horizonMask).toFixed(2)} deg, ` +
  `sunlit ~${((100 * lit) / HOURS).toFixed(0)}% of ${HOURS} h`);
