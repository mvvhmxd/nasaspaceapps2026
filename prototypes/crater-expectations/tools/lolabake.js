// PROTOTYPE - NOT FOR PRODUCTION
// Bake real NASA data into one offline JS file for the game:
//  - terrain: LRO LOLA polar DEMs (PDS LDEM_85S_40M near the site, LDEM_75S_240M out to the far skyline),
//    resampled onto the game's two height grids (game km frame, heights in metres as Int16).
//  - sky: JPL Horizons hourly sub-solar and sub-Earth points on the Moon (MOON_ME frame, DE441) for 2027,
//    turned into Sun and Earth azimuth/elevation at the map's reference point (Earth with topocentric parallax).
// Usage: node lolabake.js <data dir> <out file>
const fs = require('fs');
const { dem, stereo, latlon, frame, R } = require('./lolaframe.js');
const [D, OUT] = process.argv.slice(2);
const F40 = dem(D + '/ldem_85s_40m.img', 7584, 3791.5, 0.04), F240 = dem(D + '/ldem_75s_240m.img', 3812, 1905.5, 0.24);
// The frame: Shackleton's centre (89.67 S, 129.78 E) at game (-4, 8.5); game +x toward de Gerlache (88.5 S, 273 E).
const sh = stereo(-89.67, 129.78), dg = stereo(-88.5, 273);
const TH = Math.atan2(dg.Y - sh.Y, dg.X - sh.X), GX0 = -4, GY0 = 8.5;
const Fr = frame(sh.X, sh.Y, GX0, GY0, TH);
function grid(x0, y0, x1, y1, q, M) {
  const nx = Math.round((x1 - x0) / q) + 1, ny = Math.round((y1 - y0) / q) + 1, a = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const g = Fr.toGrid(x0 + i * q, y0 + j * q);
    a[j * nx + i] = Math.round((M.inside(g.X, g.Y) ? M : F240).h(g.X, g.Y));
  }
  return { x0, y0, q, nx, ny, b64: Buffer.from(a.buffer).toString('base64') };
}
const fine = grid(-14, -12, 48, 28, 0.08, F40), coarse = grid(-110, -110, 140, 125, 0.5, F240);
// reference point: the map centre
const REF = { x: 15, y: 6.65 };
const unit = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
const P3 = (x, y) => { const g = Fr.toGrid(x, y), L = latlon(g.X, g.Y); return unit(L.lat, L.lon); };
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const n = Math.hypot(...a); return a.map(v => v / n); };
const U = P3(REF.x, REF.y), EX = norm(sub(P3(REF.x + 0.01, REF.y), P3(REF.x - 0.01, REF.y))), EY = norm(sub(P3(REF.x, REF.y + 0.01), P3(REF.x, REF.y - 0.01)));
function azel(v) { v = norm(v); const el = Math.asin(dot(v, U)) * 180 / Math.PI; const az = (Math.atan2(dot(v, EX), -dot(v, EY)) * 180 / Math.PI + 360) % 360; return { az, el }; }
function rows(file) {
  const t = fs.readFileSync(D + '/' + file, 'utf8'), a = t.indexOf('$$SOE'), b = t.indexOf('$$EOE');
  return t.slice(a + 5, b).trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => ({ when: c[0], lon: +c[3], lat: +c[4], au: +c[5] }));
}
const S = rows('hz_sun.txt'), E = rows('hz_earth.txt');
if (S.length !== E.length) throw new Error('row mismatch');
const AU = 149597870.7, n = S.length, eph = new Int16Array(n * 4);
for (let i = 0; i < n; i++) {
  const s = azel(unit(S[i].lat, S[i].lon));
  const e = azel(sub(unit(E[i].lat, E[i].lon).map(v => v * E[i].au * AU), U.map(v => v * R))); // topocentric
  const az = v => Math.round(((v + 180) % 360 - 180) * 100);
  eph[i * 4] = az(s.az); eph[i * 4 + 1] = Math.round(s.el * 100); eph[i * 4 + 2] = az(e.az); eph[i * 4 + 3] = Math.round(e.el * 100);
}
const ll = (x, y) => { const g = Fr.toGrid(x, y), L = latlon(g.X, g.Y); return [+L.lat.toFixed(4), +((L.lon + 180) % 360 - 180).toFixed(3)]; };
const out = `// PROTOTYPE - NOT FOR PRODUCTION
// Real NASA data, baked for offline play by lolabake.js (see assets/provenance.yaml).
// Terrain: LRO LOLA gridded DEMs LDEM_85S_40M and LDEM_75S_240M (PDS Geosciences Node), heights in metres
// above the 1737.4 km reference sphere, resampled to the game frame. Sky: JPL Horizons (DE441, MOON_ME frame),
// hourly sub-solar and sub-Earth points for 2027, as azimuth/elevation x100 at the map centre.
window.LOLA = ${JSON.stringify({
  frame: { shackleton: [-89.67, 129.78], at: [GX0, GY0], toward: 'de Gerlache (88.5 S, 273 E)', heading_deg: +(TH * 180 / Math.PI).toFixed(3), ref: REF, ref_latlon: ll(REF.x, REF.y), map_corners: [ll(0, 0), ll(30, 0), ll(30, 13.3), ll(0, 13.3)] },
  fine, coarse,
  eph: { start: '2027-01-01T00:00Z', step_h: 1, n, b64: Buffer.from(eph.buffer).toString('base64') },
})};
`;
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, (out.length / 1024).toFixed(0) + ' KB', 'fine', fine.nx, fine.ny, 'coarse', coarse.nx, coarse.ny, 'ref', ll(REF.x, REF.y));
// a few sky samples, to sanity-check
for (const i of [0, 24 * 30, 24 * 90, 24 * 180]) console.log(S[i].when, 'sun az/el', eph[i * 4] / 100, eph[i * 4 + 1] / 100, 'earth', eph[i * 4 + 2] / 100, eph[i * 4 + 3] / 100);
