// PROTOTYPE - NOT FOR PRODUCTION
// Bakes Natural Earth's 1:110m land polygons into a 1-degree land mask for the Earth disc.
// Usage: node tools/earthbake.js <ne_110m_land.geojson> assets/data/earth-land.js
// Output: window.EARTH_LAND = { w: 360, h: 180, bits: '<base64>' }, row 0 at 90°N, column 0 at 180°W,
// one bit per cell (most significant bit first), set where the cell centre is on land (even-odd rule).
const fs = require('fs');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node tools/earthbake.js <ne_110m_land.geojson> <out.js>'); process.exit(1); }
const W = 360, H = 180;
const rings = [];
for (const f of JSON.parse(fs.readFileSync(src, 'utf8')).features) {
  const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) for (const r of p) rings.push(r);
}
const bytes = new Uint8Array(W * H / 8);
let landCells = 0;
for (let j = 0; j < H; j++) {
  const lat = 90 - (j + 0.5);
  const xs = []; // longitudes where a ring edge crosses this latitude
  for (const r of rings) for (let k = 0; k < r.length - 1; k++) {
    const [x1, y1] = r[k], [x2, y2] = r[k + 1];
    if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + (lat - y1) / (y2 - y1) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  for (let i = 0; i < W; i++) {
    const lon = -180 + (i + 0.5);
    let n = 0; for (const x of xs) if (x < lon) n++;
    if (n % 2 === 1) { const b = j * W + i; bytes[b >> 3] |= 0x80 >> (b & 7); landCells++; }
  }
}
// Antarctica's 110m polygon ends near 85°S; fill the pole cap so the ice sheet is whole.
for (let j = H - 6; j < H; j++) for (let i = 0; i < W; i++) { const b = j * W + i; if (!(bytes[b >> 3] & (0x80 >> (b & 7)))) { bytes[b >> 3] |= 0x80 >> (b & 7); landCells++; } }
fs.writeFileSync(out, `// PROTOTYPE - NOT FOR PRODUCTION
// Earth land mask, 1 degree, baked by tools/earthbake.js from Natural Earth 1:110m land (public domain).
// Row 0 is 90°N, column 0 is 180°W; one bit per cell, most significant bit first. See assets/provenance.yaml.
window.EARTH_LAND = { w: ${W}, h: ${H}, bits: '${Buffer.from(bytes).toString('base64')}' };
`);
console.log('rings', rings.length, 'land share', (landCells / (W * H)).toFixed(3), 'bytes', fs.statSync(out).size);
