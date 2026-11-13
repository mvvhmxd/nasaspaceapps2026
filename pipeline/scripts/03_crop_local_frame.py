"""Resample the LOLA DEM onto each site's local east/north grid.

The source grid is polar stereographic; the game needs a square grid in metres east and north of
the landing point (row 0 = north edge, col 0 = west edge). Each node is placed by great-circle
distance and bearing from the site, then read from the fine DEM with bilinear interpolation.
Heights stay as metres above the 1737.4 km sphere; the game applies curvature itself.

Writes data/derived/<id>_heights.npy. Usage: python scripts/03_crop_local_frame.py [site ids]
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def local_grid(dem, lat, lon, size=common.GRID_SIZE, spacing=common.GRID_SPACING_M):
    half = (size - 1) / 2
    east = (np.arange(size) - half)[None, :] * spacing
    north = (half - np.arange(size))[:, None] * spacing  # row 0 = north edge
    dist = np.hypot(east, north)
    bearing = np.degrees(np.arctan2(east, north))
    lat2, lon2 = common.destination(lat, lon, bearing, dist, dem.radius_m)
    heights = dem.height(lat2, lon2).reshape(size, size)
    if np.isnan(heights).any():
        raise SystemExit("site grid runs off the edge of the DEM")
    return heights


def main(argv=None):
    cfg = common.load_config()
    dem = common.PolarDem(common.DEM_FINE)
    common.DERIVED.mkdir(parents=True, exist_ok=True)
    for site in common.selected_sites(cfg, (argv if argv is not None else sys.argv[1:])):
        h = local_grid(dem, site["lat_deg"], site["lon_deg"])
        np.save(common.DERIVED / f"{site['id']}_heights.npy", h.astype(np.float32))
        print(f"{site['id']}: {h.shape[0]}x{h.shape[1]} at {common.GRID_SPACING_M} m, heights {h.min():.0f}..{h.max():.0f} m")


if __name__ == "__main__":
    main()
