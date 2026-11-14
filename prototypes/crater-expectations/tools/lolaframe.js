// PROTOTYPE - NOT FOR PRODUCTION
// Shared: LOLA DEM readers and the game frame (game km -> polar stereographic km -> DEM pixel).
const fs = require('fs');
const R = 1737.4;
function dem(file, N, off, scale) { // scale km/pixel
  const b = fs.readFileSync(file);
  const at = (s, l) => { s = Math.max(0, Math.min(N - 1, s)); l = Math.max(0, Math.min(N - 1, l)); return b.readInt16LE((l * N + s) * 2) * 0.5; };
  return { // bilinear height (m) at stereographic X, Y (km); Y is grid-up (cos lon)
    h(X, Y) {
      const fs_ = off + X / scale - 0.5, fl = off - Y / scale - 0.5; // pixel centres
      const s = Math.floor(fs_), l = Math.floor(fl), tx = fs_ - s, ty = fl - l;
      return (at(s, l) * (1 - tx) + at(s + 1, l) * tx) * (1 - ty) + (at(s, l + 1) * (1 - tx) + at(s + 1, l + 1) * tx) * ty;
    },
    inside(X, Y) { const s = off + X / scale, l = off - Y / scale; return s > 1 && l > 1 && s < N - 2 && l < N - 2; },
  };
}
function stereo(lat, lon) { const k = 2 * R * Math.tan(Math.PI / 4 + lat * Math.PI / 360); return { X: k * Math.sin(lon * Math.PI / 180), Y: k * Math.cos(lon * Math.PI / 180) }; }
function latlon(X, Y) { const rho = Math.hypot(X, Y), c = 2 * Math.atan(rho / (2 * R)); return { lat: -90 + c * 180 / Math.PI, lon: (Math.atan2(X, Y) * 180 / Math.PI + 360) % 360 }; }
/** Game frame: origin game (gx0, gy0) sits at stereographic (X0, Y0); game +x points along heading th (rad, from grid +X toward grid +Y); game +y (map down) is +x turned clockwise on the map, a rotation, not a mirror. */
function frame(X0, Y0, gx0, gy0, th) {
  const ux = Math.cos(th), uy = Math.sin(th); // game +x in grid
  const vx = uy, vy = -ux;                   // game +y (down) in grid: +x rotated -90 deg (grid y is up)
  return {
    toGrid(x, y) { const a = x - gx0, b = y - gy0; return { X: X0 + a * ux + b * vx, Y: Y0 + a * uy + b * vy }; },
    ux, uy, vx, vy,
  };
}
module.exports = { dem, stereo, latlon, frame, R };
