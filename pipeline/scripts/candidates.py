"""Search the LOLA terrain near the south pole for well-lit points and print a table.

A helper for choosing sites, not a pipeline stage. Candidates are local high points of the
fine DEM; each is scored with its real horizon and the SPICE Sun/Earth series for the window.
These are our own picks from the data, not official or proposed landing sites.

Example: python scripts/candidates.py --start 2026-12-01T00:00:00Z --hours 1440 --max-colat 2.0 --top 30
"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--start", default="2026-12-01T00:00:00Z")
    p.add_argument("--hours", type=int, default=1440)
    p.add_argument("--max-colat", type=float, default=2.0, help="search radius from the pole, deg")
    p.add_argument("--top", type=int, default=30)
    args = p.parse_args(argv)

    fine, wide = common.PolarDem(common.DEM_FINE), common.PolarDem(common.DEM_WIDE)
    spice = common.load_kernels()
    step = 10  # 400 m
    coarse = np.asarray(fine.data[::step, ::step], dtype=float) * fine.dn_to_m
    n = coarse.shape[0]
    y, x = np.mgrid[0:n, 0:n]
    px_x = (x * step - fine.samp0) * fine.scale_m
    px_y = (fine.line0 - y * step) * fine.scale_m
    r = np.hypot(px_x, px_y)
    colat = np.degrees(2 * np.arctan(r / (2 * fine.radius_m)))
    win = 6  # local maximum within +-2.4 km
    cands = []
    for i in range(win, n - win):
        for j in range(win, n - win):
            if colat[i, j] > args.max_colat:
                continue
            h = coarse[i, j]
            if h >= coarse[i - win:i + win + 1, j - win:j + win + 1].max():
                cands.append((h, -(90 - colat[i, j]), np.degrees(np.arctan2(px_x[i, j], px_y[i, j])) % 360))
    cands.sort(reverse=True)
    print(f"{len(cands)} local high points within {args.max_colat} deg of the pole; scoring the top {args.top}")
    print(" lat      lonE    height  sun%  earth%  maskMin  maskMax")
    for h, lat, lon in cands[:args.top]:
        mask, _ = common.horizon_mask(fine, wide, lat, lon)
        sun = common.hourly_az_el(spice, "SUN", lat, lon, args.start, args.hours)
        earth = common.hourly_az_el(spice, "EARTH", lat, lon, args.start, args.hours)
        print(f"{lat:8.3f} {lon:7.2f} {h:8.0f} {100 * common.visible_fraction(mask, sun):5.0f} "
              f"{100 * common.visible_fraction(mask, earth):6.0f} {mask.min():8.2f} {mask.max():8.2f}")


if __name__ == "__main__":
    main()
