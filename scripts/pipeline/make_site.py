"""Build a real site file (docs/ARCHITECTURE.md, "Site data") from LOLA terrain
and JPL Horizons Sun and Earth positions.

    .venv/Scripts/python -I scripts/pipeline/make_site.py connecting-ridge
    .venv/Scripts/python -I scripts/pipeline/make_site.py connecting-ridge --start 2027-03-01 --days 60

Inputs (downloaded on first run into data/raw/, which git ignores):
  - the 5 m LOLA DEM of the site (NASA GSFC PGDA, Barker et al. 2021) for the
    local terrain and the near horizon;
  - the 240 m LOLA polar DEM to 75 S (PDS LOLA GDR) for the far horizon, which
    at the pole often comes from mountains 100+ km away;
  - hourly apparent azimuth and elevation of the Sun (10) and Earth (399) seen
    from the site, from the JPL Horizons API (observer on the Moon, airless).

Prints a short summary only; never prints the data.
"""
import argparse
import base64
import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import rasterio

R = 1737400.0  # m, LOLA reference sphere (same as MOON_RADIUS_M in src/sim/horizon.js)
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "sites"

SIZE = 257  # heightmap grid points per side
SPACING_M = 40.0  # -> 10.24 km square, centred on the site
OBSERVER_M = 2.0  # eye height above the ground, as in computeMask
MAX_RANGE_M = 450_000.0  # far-horizon march stops here (or at the edge of the polar DEM)
USER_AGENT = "crater-expectations-pipeline/1.0"

PGDA = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
SITES = {
    # Site coordinates and numbering follow Mazarico et al. 2011 (Icarus 211, 1066).
    "connecting-ridge": dict(
        name="Connecting Ridge",
        lat=-89.45,
        lon=222.69,
        dem="site01/Site01_final_adj_5mpp_surf.tif",
        dem_url=f"{PGDA}/Site01/Site01_final_adj_5mpp_surf.tif",
    ),
}

POLAR = dict(
    path="polar/LDEM_75S_240M.IMG",
    url="https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG",
    n=3812,
    scale=240.0,
    centre=1905.5,  # 0-based pixel index of the pole; checked against the 5 m DEM (4.7 m RMS)
    dn_m=0.5,
)


# ---------- downloads ----------

def fetch(url, dest):
    dest = Path(dest)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    return dest


# ---------- south polar stereographic (LOLA convention) ----------

def ll_to_xy(lat, lon):
    rho = 2 * R * np.tan(np.radians(90 + lat) / 2)
    lon = np.radians(lon)
    return rho * np.sin(lon), rho * np.cos(lon)


def scale_factor(lat):
    """Map metres per ground metre of the stereographic projection at this latitude."""
    return 2 / (1 + np.sin(np.radians(-lat)))


def bilinear(img, fc, fr):
    """Bilinear sample of a 2D array at fractional (col, row); NaN outside."""
    fc = np.asarray(fc, dtype=np.float64)
    fr = np.asarray(fr, dtype=np.float64)
    h, w = img.shape
    ok = (fc >= 0) & (fr >= 0) & (fc <= w - 1) & (fr <= h - 1)
    c0 = np.clip(np.floor(fc).astype(int), 0, w - 2)
    r0 = np.clip(np.floor(fr).astype(int), 0, h - 2)
    tx = fc - c0
    ty = fr - r0
    v = (img[r0, c0] * (1 - tx) + img[r0, c0 + 1] * tx) * (1 - ty) + (
        img[r0 + 1, c0] * (1 - tx) + img[r0 + 1, c0 + 1] * tx
    ) * ty
    return np.where(ok, v, np.nan)


class Terrain:
    """Heights (m above the 1737.4 km sphere) at polar stereographic x, y:
    the 5 m site DEM where it covers, the 240 m polar DEM elsewhere."""

    def __init__(self, site_dem, polar_img):
        with rasterio.open(site_dem) as ds:
            self.near = ds.read(1).astype(np.float64)
            self.inv = ~ds.transform
        if np.isnan(self.near).any():
            raise SystemExit("site DEM has empty pixels")
        n = POLAR["n"]
        raw = np.fromfile(polar_img, dtype="<i2")
        if raw.size != n * n:
            raise SystemExit(f"polar DEM: expected {n * n} values, got {raw.size}")
        self.far = raw.reshape(n, n).astype(np.float64) * POLAR["dn_m"]

    def near_height(self, x, y):
        c, r = self.inv * (np.asarray(x), np.asarray(y))
        return bilinear(self.near, c - 0.5, r - 0.5)  # GeoTIFF pixel centres sit at +0.5

    def far_height(self, x, y):
        c = POLAR["centre"]
        s = POLAR["scale"]
        return bilinear(self.far, c + np.asarray(x) / s, c - np.asarray(y) / s)

    def height(self, x, y):
        h = self.near_height(x, y)
        return np.where(np.isnan(h), self.far_height(x, y), h)


# ---------- terrain crop ----------

def local_axes(lat, lon):
    """Unit vectors of local east and north in polar stereographic x, y."""
    lo = math.radians(lon)
    east = np.array([math.cos(lo), -math.sin(lo)])  # direction of increasing longitude
    north = np.array([math.sin(lo), math.cos(lo)])  # away from the south pole
    return east, north


def build_heightmap(terrain, lat, lon):
    """SIZE x SIZE grid in the game's frame: row 0 = north edge, col 0 = west edge,
    site at the centre point. Point-sampled (bilinear) from the 5 m DEM."""
    x0, y0 = ll_to_xy(lat, lon)
    east, north = local_axes(lat, lon)
    k = scale_factor(lat)
    half = (SIZE - 1) / 2
    idx = (np.arange(SIZE) - half) * SPACING_M
    wx, wz = np.meshgrid(idx, idx)  # world x = east, world z = south
    mx = x0 + k * (wx * east[0] - wz * north[0])
    my = y0 + k * (wx * east[1] - wz * north[1])
    h = terrain.near_height(mx, my)
    if np.isnan(h).any():
        raise SystemExit("the 10 km crop runs off the 5 m site DEM; pick a site nearer its centre")
    return h


def encode_heightmap(h):
    min_m = math.floor(float(h.min()))
    max_m = math.ceil(float(h.max()))
    v = np.round((h - min_m) / (max_m - min_m) * 65535).astype("<u2")
    return dict(
        size=SIZE,
        spacingM=SPACING_M,
        minM=min_m,
        maxM=max_m,
        data=base64.b64encode(v.tobytes()).decode("ascii"),
    )


# ---------- horizon mask ----------

def unit(lat, lon):
    la = np.radians(lat)
    lo = np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)


def decode_heights(enc):
    """The heights exactly as the game decodes them (loadSite.decodeHeightmap)."""
    v = np.frombuffer(base64.b64decode(enc["data"]), dtype="<u2").astype(np.float64)
    return (enc["minM"] + v * (enc["maxM"] - enc["minM"]) / 65535).reshape(SIZE, SIZE)


def mesh_height(h, fc, fr):
    """Port of heightAt in src/sim/horizon.js: interpolate on the two triangles
    per cell that the render mesh draws (split along the NE-SW diagonal)."""
    w = h.shape[1]
    c0 = np.clip(np.floor(fc).astype(int), 0, w - 2)
    r0 = np.clip(np.floor(fr).astype(int), 0, h.shape[0] - 2)
    fx = fc - c0
    fz = fr - r0
    a = h[r0, c0]
    b = h[r0, c0 + 1]
    c = h[r0 + 1, c0]
    d = h[r0 + 1, c0 + 1]
    lower = a + (b - a) * fx + (c - a) * fz
    upper = d + (c - d) * (1 - fx) + (b - d) * (1 - fz)
    return np.where(fx + fz <= 1, lower, upper)


def crop_mask(h):
    """Port of computeMask in src/sim/horizon.js: the exact horizon of the 40 m
    mesh the game draws, checked at every point where each azimuth's ray crosses
    a mesh edge (columns, rows, NE-SW diagonals)."""
    half = (SIZE - 1) / 2
    eye = h[SIZE // 2, SIZE // 2] + OBSERVER_M
    k = np.arange(-2 * SIZE, 2 * SIZE + 1, dtype=np.float64)
    mask = np.empty(360)
    for az in range(360):
        th = math.radians(az)
        ex = math.sin(th)
        nz = math.cos(th)
        ds = []
        for rate, base in ((ex / SPACING_M, half), (-nz / SPACING_M, half), ((ex - nz) / SPACING_M, 2 * half)):
            if abs(rate) > 1e-12:
                ds.append((np.round(base) + k - base) / rate)
        d = np.concatenate(ds)
        d = d[d > 0]
        gx = half + ex * d / SPACING_M
        gz = half - nz * d / SPACING_M
        ok = (gx >= 0) & (gz >= 0) & (gx <= SIZE - 1) & (gz <= SIZE - 1)
        d, gx, gz = d[ok], gx[ok], gz[ok]
        hh = mesh_height(h, gx, gz)
        el = np.degrees(np.arctan2(hh - d**2 / (2 * R) - eye, d))
        mask[az] = el.max()
    return mask


def crop_exit(az):
    """Distance (m) at which a ray from the centre leaves the square crop."""
    th = math.radians(az)
    return (SIZE - 1) / 2 * SPACING_M / max(abs(math.sin(th)), abs(math.cos(th)))


def far_mask(terrain, lat, lon, eye_ground_m):
    """Elevation (deg) of the highest terrain BEYOND the crop at each whole-degree
    azimuth, marching along the great circle in 3D (exact curvature) on the 5 m
    DEM and then the 240 m DEM. Returns (mask, distance of that terrain in m)."""
    u0 = unit(lat, lon)
    eye = (R + eye_ground_m + OBSERVER_M) * u0
    d_all = np.concatenate([np.arange(2.5, 8000, 2.5), np.arange(8000, MAX_RANGE_M, 60.0)])
    p1 = math.radians(lat)
    l1 = math.radians(lon)
    mask = np.empty(360)
    where = np.empty(360)
    for az in range(360):
        d = d_all[d_all > crop_exit(az)]
        delta = d / R
        th = math.radians(az)
        p2 = np.arcsin(math.sin(p1) * np.cos(delta) + math.cos(p1) * np.sin(delta) * math.cos(th))
        l2 = l1 + np.arctan2(
            math.sin(th) * np.sin(delta) * math.cos(p1), np.cos(delta) - math.sin(p1) * np.sin(p2)
        )
        plat = np.degrees(p2)
        plon = np.degrees(l2)
        x, y = ll_to_xy(plat, plon)
        h = terrain.height(x, y)
        ok = ~np.isnan(h)
        p = (R + h[ok])[:, None] * unit(plat[ok], plon[ok])
        v = p - eye
        el = np.degrees(np.arcsin((v @ u0) / np.linalg.norm(v, axis=1)))
        i = int(np.argmax(el))
        mask[az] = el[i]
        where[az] = d[ok][i]
    return mask, where


# ---------- JPL Horizons ----------

HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"


def horizons_series(body, lat, lon, alt_km, start, hours, cache_dir):
    stop = start + timedelta(hours=hours - 1)
    key = f"{body}_{lat}_{lon}_{start:%Y%m%dT%H}_{hours}h.txt"
    cache = cache_dir / key
    if not cache.exists():
        params = {
            "format": "text",
            "COMMAND": f"'{body}'",
            "EPHEM_TYPE": "'OBSERVER'",
            "CENTER": "'coord@301'",
            "COORD_TYPE": "'GEODETIC'",
            "SITE_COORD": f"'{lon % 360:.4f},{lat:.4f},{alt_km:.4f}'",
            "START_TIME": f"'{start:%Y-%m-%d %H:%M}'",
            "STOP_TIME": f"'{stop:%Y-%m-%d %H:%M}'",
            "STEP_SIZE": "'1 h'",
            "QUANTITIES": "'4'",  # apparent azimuth (clockwise from north) and elevation
            "APPARENT": "'AIRLESS'",
            "CSV_FORMAT": "'YES'",
            "MAKE_EPHEM": "'YES'",
            "OBJ_DATA": "'NO'",
        }
        url = HORIZONS + "?" + urllib.parse.urlencode(params)
        print(f"querying JPL Horizons for body {body}")
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=300) as r:
            text = r.read().decode("utf-8")
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8")
    text = cache.read_text(encoding="utf-8")
    if "$$SOE" not in text:
        raise SystemExit(f"Horizons returned no ephemeris for body {body}; see {cache}")
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    az = []
    el = []
    for row in rows:
        f = [s.strip() for s in row.split(",")]
        az.append(float(f[3]))
        el.append(float(f[4]))
    if len(az) != hours:
        raise SystemExit(f"Horizons body {body}: expected {hours} rows, got {len(az)}")
    return np.array(az), np.array(el)


# ---------- main ----------

def r(values, nd):
    return [round(float(v), nd) for v in values]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", choices=sorted(SITES))
    ap.add_argument("--start", default="2027-03-01", help="first hour of the series, UTC (YYYY-MM-DD)")
    ap.add_argument("--days", type=int, default=60)
    args = ap.parse_args()

    s = SITES[args.site]
    lat, lon = s["lat"], s["lon"]
    start = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    hours = args.days * 24

    site_dem = fetch(s["dem_url"], RAW / s["dem"])
    polar = fetch(POLAR["url"], RAW / POLAR["path"])
    terrain = Terrain(site_dem, polar)

    hm = build_heightmap(terrain, lat, lon)
    enc = encode_heightmap(hm)
    game_h = decode_heights(enc)
    ground = float(game_h[SIZE // 2, SIZE // 2])
    # Inside the crop the horizon comes from the 40 m terrain the game draws, so
    # the sim and the 3D view agree; beyond it, from the 5 m and 240 m DEMs.
    near = crop_mask(game_h)
    far, far_dist = far_mask(terrain, lat, lon, ground)
    mask = np.maximum(near, far)
    is_far = far > near

    cache = RAW / "horizons"
    sun_az, sun_el = horizons_series("10", lat, lon, ground / 1000, start, hours, cache)
    earth_az, earth_el = horizons_series("399", lat, lon, ground / 1000, start, hours, cache)

    site = dict(
        id=args.site,
        name=s["name"],
        lat=lat,
        lon=lon,
        illustrative=False,
        source=(
            "Terrain: LOLA 5 m/px site DEM (NASA GSFC PGDA, Barker et al. 2021) resampled to 40 m; "
            "far horizon from the LOLA 240 m polar DEM (PDS LOLA GDR). "
            "Sun and Earth: JPL Horizons, observer on the Moon at the site, apparent azimuth/elevation, airless."
        ),
        heightmap=enc,
        horizonMask=r(mask, 4),
        series=dict(
            startUtc=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            stepHours=1,
            sunAz=r(sun_az, 3),
            sunEl=r(sun_el, 3),
            earthAz=r(earth_az, 3),
            earthEl=r(earth_el, 3),
        ),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{args.site}.json"
    text = json.dumps(site, separators=(",", ":"))
    out.write_text(text, encoding="utf-8")

    # Summary only.
    m_at = lambda az: np.interp(az % 360, np.arange(361), np.append(mask, mask[0]))
    sunlit = sun_el > m_at(sun_az)
    earth = earth_el > m_at(earth_az)
    print(f"{out.relative_to(ROOT)}: {len(text) / 1024:.0f} KB")
    print(f"  site {s['name']} {lat} {lon}; ground {ground:.1f} m; crop {hm.min():.0f}..{hm.max():.0f} m")
    print(f"  horizon {mask.min():.2f}..{mask.max():.2f} deg; set by terrain beyond the crop at {is_far.sum()} of 360 azimuths "
          f"({far_dist[is_far].min() / 1000:.0f} to {far_dist[is_far].max() / 1000:.0f} km away)")
    print(f"  {hours} h from {start:%Y-%m-%d}: Sun el {sun_el.min():.2f}..{sun_el.max():.2f} deg, "
          f"sunlit {100 * sunlit.mean():.1f}%; Earth el {earth_el.min():.2f}..{earth_el.max():.2f} deg, "
          f"in view {100 * earth.mean():.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
