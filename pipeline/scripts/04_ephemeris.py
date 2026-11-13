"""Hourly Sun and Earth azimuth/elevation at a lunar surface site, computed with SPICE (DE440).

Topocentric east/north/up on the 1737.4 km sphere, MOON_ME frame, apparent direction (LT+S),
no atmosphere. Azimuth is clockwise from north. SPICE computes; 06_validate.py checks against Horizons.

Example:
  python scripts/04_ephemeris.py --id test-point --lat -89.5 --lon 0 --start 2027-03-01T00:00:00 --hours 1440
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ABCORR, KERNELS, MOON_RADIUS_KM, PIPELINE, SITE_FRAME, hourly_az_el, load_kernels  # noqa: E402

OUT_DIR = PIPELINE / "data" / "ephemeris"


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--id", required=True)
    p.add_argument("--lat", type=float, required=True, help="planetocentric latitude, deg")
    p.add_argument("--lon", type=float, required=True, help="east longitude, deg")
    p.add_argument("--alt-km", type=float, default=0.0, help="height above the 1737.4 km sphere")
    p.add_argument("--start", required=True, help="UTC, e.g. 2027-03-01T00:00:00")
    p.add_argument("--hours", type=int, default=1440)
    return p.parse_args(argv)


def compute(args):
    spice = load_kernels()
    sun = hourly_az_el(spice, "SUN", args.lat, args.lon, args.start, args.hours, alt_km=args.alt_km)
    earth = hourly_az_el(spice, "EARTH", args.lat, args.lon, args.start, args.hours, alt_km=args.alt_km)
    return {
        "id": args.id,
        "lat": args.lat, "lon": args.lon, "altKm": args.alt_km,
        "provenance": {
            "method": "SPICE spkcpo, topocentric ENU on a sphere",
            "kernels": sorted(KERNELS),
            "frame": SITE_FRAME, "aberration": ABCORR, "radiusKm": MOON_RADIUS_KM,
            "azimuth": "degrees clockwise from north", "refraction": "none",
        },
        "series": {
            "startUtc": args.start.rstrip("Z") + "Z", "stepHours": 1,
            "sunAz": [round(float(v), 4) for v in sun[:, 0]],
            "sunEl": [round(float(v), 4) for v in sun[:, 1]],
            "earthAz": [round(float(v), 4) for v in earth[:, 0]],
            "earthEl": [round(float(v), 4) for v in earth[:, 1]],
        },
    }


def main(argv=None):
    args = parse_args(argv)
    result = compute(args)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{args.id}.json"
    out.write_text(json.dumps(result))
    print(f"wrote {out} ({args.hours} hourly rows)")


if __name__ == "__main__":
    main()
