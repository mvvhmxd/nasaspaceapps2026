// PROTOTYPE - NOT FOR PRODUCTION
// Analyse the baked site the way the game does: per map cell, height, slope, PSR, and the share of each
// mission window with the Sun / Earth above the real skyline. Prints an ASCII map and station candidates.
const fs = require('fs');
global.window = {}; global.atob = s => Buffer.from(s, 'base64').toString('binary');
require(process.argv[2]); const L = window.LOLA;
const MC = 100, MR = 26, CX = 0.3, CY = 0.5333, MOON_R = 1737.4, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const dec = g => { const b = atob(g.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const a = new Int16Array(u.buffer); return { ...g, a: Float32Array.from(a, v => v / 1000) }; };
const LF = dec(L.fine), LC = dec(L.coarse), REF = L.frame.ref;
const smp = (g, x, y) => { const fx = (x - g.x0) / g.q, fy = (y - g.y0) / g.q; if (fx < 0 || fy < 0 || fx >= g.nx - 1 || fy >= g.ny - 1) return NaN; const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, k = iy * g.nx + ix, a = g.a; return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + g.nx] * (1 - tx) + a[k + g.nx + 1] * tx) * ty; };
const H = (x, y) => { let z = smp(LF, x, y); if (z !== z) z = smp(LC, x, y); return z !== z ? 0 : z; };
const e = (() => { const b = atob(L.eph.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); })();
const eph = (t, k) => { const i = Math.round(t); return { az: (e[i * 4 + k] / 100 + 360) % 360, el: e[i * 4 + k + 1] / 100 }; };
const DISTS = []; for (let d = 0.15; d < 95; d *= 1.09) DISTS.push(d);
const NAZ = 72;
function prof(c, r) {
  const x0 = c * CX, y0 = r * CY, h0 = H(x0, y0) + 0.002, p = new Float32Array(NAZ);
  for (let a = 0; a < NAZ; a++) { const az = (a + 0.5) * 360 / NAZ * D2R, sx = Math.sin(az), sy = -Math.cos(az); let m = -1;
    for (const d of DISTS) { const s = (H(x0 + sx * d, y0 + sy * d) - d * d / (2 * MOON_R) - h0) / d; if (s > m) m = s; }
    p[a] = Math.atan(m) * R2D - ((x0 - REF.x) * sx + (y0 - REF.y) * sy) / MOON_R * R2D; }
  return p;
}
const hz = (p, az) => p[Math.floor(((az % 360) + 360) % 360 / 360 * NAZ) % NAZ];
const T0 = Date.parse(L.eph.start);
const wins = (process.argv[3] || '2027-10-17T00:00Z:72,2027-10-21T00:00Z:96,2027-07-26T00:00Z:96').split(',').map(s => { const k = s.lastIndexOf(':'); return { h0: (Date.parse(s.slice(0, k)) - T0) / 3600e3, n: +s.slice(k + 1) }; });
let sunMax = new Float32Array(72).fill(-90); for (let i = 0; i < L.eph.n; i++) { const b = eph(i, 0); const a = Math.floor(b.az / 5) % 72; sunMax[a] = Math.max(sunMax[a], b.el); }
const out = [];
for (let r = 0; r < MR; r += 1) for (let c = 0; c < MC; c += 1) {
  const x = c * CX, y = r * CY, p = prof(c, r);
  const sl = Math.max(Math.abs(H(x + CX, y) - H(x, y)) / CX, Math.abs(H(x, y + CY) - H(x, y)) / CY);
  let psr = 1; for (let a = 0; a < 72; a++) if (sunMax[a] > hz(p, a * 5 + 2.5)) { psr = 0; break; }
  const w = wins.map(W => { let s = 0, ee = 0; for (let t = 0; t < W.n; t++) { const S = eph(W.h0 + t, 0), E = eph(W.h0 + t, 2); if (S.el > hz(p, S.az)) s++; if (E.el > hz(p, E.az)) ee++; } return [Math.round(100 * s / W.n), Math.round(100 * ee / W.n)]; });
  out.push({ c, r, h: H(x, y), sl, psr, w });
}
fs.writeFileSync(process.argv[4], JSON.stringify(out));
// ASCII: per window, sun share digit (0-9), P for PSR, # for too steep to land
for (let k = 0; k < wins.length; k++) {
  console.log('window', k, 'sun share (digit = tens of %), P = PSR, lowercase = slope > 0.22');
  for (let r = 0; r < MR; r++) console.log(String(r).padStart(2) + ' ' + out.filter(o => o.r === r).map(o => o.psr ? 'P' : o.sl > 0.22 ? '.' : String(Math.min(9, Math.floor(o.w[k][0] / 10)))).join(''));
}
console.log('earth share, window 0');
for (let r = 0; r < MR; r++) console.log(String(r).padStart(2) + ' ' + out.filter(o => o.r === r).map(o => String(Math.min(9, Math.floor(o.w[0][1] / 10)))).join(''));
console.log('heights (0-9 low-high)'); const lo = Math.min(...out.map(o => o.h)), hi = Math.max(...out.map(o => o.h));
console.log('range km', lo.toFixed(2), hi.toFixed(2));
for (let r = 0; r < MR; r++) console.log(String(r).padStart(2) + ' ' + out.filter(o => o.r === r).map(o => String(Math.floor((o.h - lo) / (hi - lo + 1e-6) * 10))).join(''));
