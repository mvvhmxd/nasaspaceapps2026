"""Shared paths, kernel list and SPICE geometry for the pipeline stages."""
from pathlib import Path

import numpy as np

PIPELINE = Path(__file__).resolve().parent.parent
RAW = PIPELINE / "data" / "raw"          # never committed
DERIVED = PIPELINE / "data" / "derived"  # intermediate files, never committed
CONFIG = PIPELINE / "config" / "sites.yaml"
SITES_OUT = PIPELINE.parent / "public" / "sites"
GRID_SIZE = 257      # heightmap points per side
GRID_SPACING_M = 40  # 10.24 km square, the fine DEM's native resolution
EYE_HEIGHT_M = 2.0   # observer height above the surface (docs/ARCHITECTURE.md)
KERNEL_DIR = RAW / "kernels"
NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"

# Exact files, checked against the NAIF directory listings on 2026-11-13.
KERNELS = {
    "naif0012.tls": "lsk/naif0012.tls",                              # leap seconds
    "pck00011.tpc": "pck/pck00011.tpc",                              # body constants
    "de440s.bsp": "spk/planets/de440s.bsp",                          # DE440 (1849-2150), 31 MB
    "moon_pa_de440_200625.bpc": "pck/moon_pa_de440_200625.bpc",      # lunar orientation (principal axes)
    "moon_de440_250416.tf": "fk/satellites/moon_de440_250416.tf",    # MOON_PA / MOON_ME frames
}

DEM_DIR = RAW / "dem"
PDS_LOLA = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/"
# LOLA GDR, south polar stereographic, 85S to the pole, 40 m/pixel (PDS data set LRO-L-LOLA-4-GDR-V1.0, product V2.0).
DEM_FINE = "ldem_85s_40m"    # mesh and near-field horizon
# Same data set, 80S to the pole at 80 m/pixel: the wide, coarse grid for the far horizon.
DEM_WIDE = "ldem_80s_80m"

MOON_RADIUS_KM = 1737.4   # LOLA reference sphere
SITE_FRAME = "MOON_ME"    # mean Earth / polar axis: the frame LOLA products use
ABCORR = "LT+S"           # light time + stellar aberration = apparent direction


def load_kernels():
    import spiceypy as spice

    missing = [n for n in KERNELS if not (KERNEL_DIR / n).exists()]
    if missing:
        raise SystemExit(f"Missing kernels {missing}. Run scripts/01_download_kernels.py first.")
    for name in KERNELS:
        spice.furnsh(str(KERNEL_DIR / name))
    return spice


def site_vectors(lat_deg, lon_deg, alt_km=0.0):
    """Site position (km, body-fixed) and its local east/north/up unit vectors.

    lat/lon are planetocentric degrees, east-positive, on a sphere of MOON_RADIUS_KM.
    """
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.cross(up, east)
    return (MOON_RADIUS_KM + alt_km) * up, east, north, up


def az_el(vec, east, north, up):
    """Azimuth (deg, clockwise from north, 0-360) and elevation (deg) of a direction."""
    e, n, u = vec @ east, vec @ north, vec @ up
    az = np.degrees(np.arctan2(e, n)) % 360.0
    el = np.degrees(np.arctan2(u, np.hypot(e, n)))
    return az, el


def hourly_az_el(spice, target, lat_deg, lon_deg, start_utc, hours, step_hours=1, alt_km=0.0):
    """Apparent az/el of `target` ('SUN' or 'EARTH') from a lunar surface site, one row per step."""
    pos, east, north, up = site_vectors(lat_deg, lon_deg, alt_km)
    et0 = spice.str2et(start_utc.rstrip("Z"))  # SPICE does not accept a trailing Z
    out = np.empty((hours, 2))
    for i in range(hours):
        et = et0 + i * step_hours * 3600.0
        state, _ = spice.spkcpo(target, et, SITE_FRAME, "OBSERVER", ABCORR, pos, "MOON", SITE_FRAME)
        out[i] = az_el(np.array(state[:3]), east, north, up)
    return out


# ---------- LOLA polar DEM (PDS3 IMG, south polar stereographic, pixel registration) ----------

def read_label(path):
    """The few PDS3 label values the pipeline needs, as floats/strings."""
    want = ("LINES", "LINE_SAMPLES", "SAMPLE_BITS", "SAMPLE_TYPE", "SCALING_FACTOR", "OFFSET", "MAP_SCALE",
            "LINE_PROJECTION_OFFSET", "SAMPLE_PROJECTION_OFFSET", "CENTER_LATITUDE", "CENTER_LONGITUDE",
            "MINIMUM_LATITUDE", "MAP_PROJECTION_TYPE", "COORDINATE_SYSTEM_NAME", "PRODUCT_VERSION_ID", "DATA_SET_ID")
    out = {}
    for line in Path(path).read_text().splitlines():
        if "=" not in line:
            continue
        key, value = (t.strip() for t in line.split("=", 1))
        if key in want and key not in out:
            value = value.split("<")[0].strip().strip('"')
            try:
                out[key] = float(value)
            except ValueError:
                out[key] = value
    return out


class PolarDem:
    """Height (m above the 1737.4 km sphere) from a LOLA south-polar stereographic IMG."""

    def __init__(self, product):
        self.product = product
        lbl = read_label(DEM_DIR / f"{product}.lbl")
        if lbl["MAP_PROJECTION_TYPE"] != "POLAR STEREOGRAPHIC" or lbl["CENTER_LATITUDE"] != -90 or lbl["CENTER_LONGITUDE"] != 0:
            raise SystemExit(f"{product}: expected a south polar stereographic grid centred on lon 0")
        if lbl["SAMPLE_BITS"] != 16 or lbl["SAMPLE_TYPE"] != "LSB_INTEGER":
            raise SystemExit(f"{product}: expected 16-bit LSB integers")
        self.label = lbl
        self.n = int(lbl["LINES"])
        self.scale_m = lbl["MAP_SCALE"]
        self.dn_to_m = lbl["SCALING_FACTOR"]
        self.radius_m = lbl["OFFSET"]
        self.line0 = lbl["LINE_PROJECTION_OFFSET"]
        self.samp0 = lbl["SAMPLE_PROJECTION_OFFSET"]
        self.min_lat = lbl["MINIMUM_LATITUDE"] if lbl["MINIMUM_LATITUDE"] > -90 else None
        self.data = np.memmap(DEM_DIR / f"{product}.img", dtype="<i2", mode="r", shape=(self.n, self.n))

    def pixel(self, lat_deg, lon_deg):
        """Fractional (line, sample), 0-based. Lon 0 points up the image, 90 E to the right."""
        r = 2 * self.radius_m * np.tan(np.radians(90.0 + np.asarray(lat_deg)) / 2)
        lon = np.radians(lon_deg)
        return self.line0 - r * np.cos(lon) / self.scale_m, self.samp0 + r * np.sin(lon) / self.scale_m

    def height(self, lat_deg, lon_deg):
        """Bilinear height in metres; NaN outside the grid."""
        line, samp = self.pixel(lat_deg, lon_deg)
        line, samp = np.atleast_1d(line), np.atleast_1d(samp)
        ok = (line >= 0) & (samp >= 0) & (line <= self.n - 1) & (samp <= self.n - 1)
        l0 = np.clip(np.floor(line).astype(int), 0, self.n - 2)
        s0 = np.clip(np.floor(samp).astype(int), 0, self.n - 2)
        fl, fs = line - l0, samp - s0
        d = self.data
        h = ((d[l0, s0] * (1 - fs) + d[l0, s0 + 1] * fs) * (1 - fl)
             + (d[l0 + 1, s0] * (1 - fs) + d[l0 + 1, s0 + 1] * fs) * fl) * self.dn_to_m
        return np.where(ok, h, np.nan)


def destination(lat_deg, lon_deg, bearing_deg, dist_m, radius_m=MOON_RADIUS_KM * 1000):
    """Point reached from (lat, lon) going dist_m along a great circle at bearing (clockwise from north)."""
    lat1, lon1, brg = np.radians(lat_deg), np.radians(lon_deg), np.radians(bearing_deg)
    ang = np.asarray(dist_m) / radius_m
    lat2 = np.arcsin(np.sin(lat1) * np.cos(ang) + np.cos(lat1) * np.sin(ang) * np.cos(brg))
    lon2 = lon1 + np.arctan2(np.sin(brg) * np.sin(ang) * np.cos(lat1), np.cos(ang) - np.sin(lat1) * np.sin(lat2))
    return np.degrees(lat2), np.degrees(lon2) % 360.0


def horizon_mask(fine, wide, lat_deg, lon_deg, eye_m=2.0, near_m=15000.0, far_m=250000.0):
    """Terrain horizon elevation (deg) at azimuths 0..359 from a point `eye_m` above the surface.

    Exact spherical geometry (curvature included). Near field: the fine DEM every 20 m out to
    `near_m`. Far field: the wide DEM every 100 m out to `far_m` or the edge of the grid.
    Returns (mask[360], distance_m[360] of the point that sets each horizon).
    """
    radius = fine.radius_m
    ro = radius + float(fine.height(lat_deg, lon_deg)[0]) + eye_m
    az = np.arange(360.0)[:, None]
    best = np.full(360, -90.0)
    best_d = np.zeros(360)
    for dem, dist in ((fine, np.arange(20.0, near_m, 20.0)), (wide, np.arange(near_m, far_m, 100.0))):
        d = dist[None, :]
        lat2, lon2 = destination(lat_deg, lon_deg, az, d, radius)
        rt = radius + dem.height(lat2, lon2)
        gamma = d / radius
        el = np.degrees(np.arctan2(rt * np.cos(gamma) - ro, rt * np.sin(gamma)))
        el = np.where(np.isnan(el), -90.0, el)
        idx = el.argmax(axis=1)
        top = el[np.arange(360), idx]
        better = top > best
        best = np.where(better, top, best)
        best_d = np.where(better, dist[idx], best_d)
    return best, best_d


def visible_fraction(mask, az_el):
    """Share of rows of an (az, el) table where the body is above the mask (linear interpolation)."""
    az, el = az_el[:, 0], az_el[:, 1]
    i = np.floor(az).astype(int) % 360
    f = az - np.floor(az)
    m = mask[i] * (1 - f) + mask[(i + 1) % 360] * f
    return float((el > m).mean())


def load_config():
    import yaml

    cfg = yaml.safe_load(CONFIG.read_text())
    for site in cfg["sites"]:
        if site.get("lat_deg") is None or site.get("lon_deg") is None:
            raise SystemExit(f"config/sites.yaml: site {site.get('id')} has no coordinates")
    return cfg


def selected_sites(cfg, ids):
    """Sites named on the command line, or all of them."""
    sites = [s for s in cfg["sites"] if not ids or s["id"] in ids]
    missing = set(ids or []) - {s["id"] for s in sites}
    if missing:
        raise SystemExit(f"unknown site id(s): {sorted(missing)}")
    return sites
