"""Shared paths, kernel list and SPICE geometry for the pipeline stages."""
from pathlib import Path

import numpy as np

PIPELINE = Path(__file__).resolve().parent.parent
RAW = PIPELINE / "data" / "raw"          # never committed
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
