"""Check a 04_ephemeris.py series against JPL Horizons and report the largest difference.

Horizons verifies; it never supplies shipped numbers. Queries the Horizons API for the Sun (10)
and Earth (399) as seen from the same lunar surface point (CENTER coord@301), apparent, airless.

Example:
  python scripts/06_validate.py --id test-point
"""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import PIPELINE, RAW  # noqa: E402

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
EPHEM_DIR = PIPELINE / "data" / "ephemeris"
REPORT_DIR = PIPELINE / "validation"
TOLERANCE_DEG = 0.02  # pass/fail limit on angular separation


def horizons_params(body, lat, lon, alt_km, start, stop):
    return {
        "format": "text", "COMMAND": f"'{body}'", "OBJ_DATA": "NO", "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER", "CENTER": "'coord@301'", "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"'{lon},{lat},{alt_km}'",  # E-longitude deg, latitude deg, height km
        "START_TIME": f"'{start}'", "STOP_TIME": f"'{stop}'", "STEP_SIZE": "'1 h'",
        "QUANTITIES": "'4'", "ANG_FORMAT": "DEG", "APPARENT": "AIRLESS", "CSV_FORMAT": "YES",
        "TIME_TYPE": "UT",
    }


def parse_az_el(text):
    """Rows between $$SOE and $$EOE: date, flag, flag, azimuth, elevation."""
    if "$$SOE" not in text:
        raise SystemExit("Horizons returned no ephemeris:\n" + text[-1500:])
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        rows.append((float(cells[3]), float(cells[4])))
    return np.array(rows)


def unit(az_deg, el_deg):
    az, el = np.radians(az_deg), np.radians(el_deg)
    return np.stack([np.cos(el) * np.sin(az), np.cos(el) * np.cos(az), np.sin(el)], axis=-1)


def compare(ours, theirs):
    """Max elevation difference and max angular separation (deg) between two (az, el) tables."""
    sep = np.degrees(np.arccos(np.clip(np.sum(unit(*ours.T) * unit(*theirs.T), axis=1), -1, 1)))
    d_el = np.abs(ours[:, 1] - theirs[:, 1])
    return {
        "maxSeparationDeg": round(float(sep.max()), 5), "meanSeparationDeg": round(float(sep.mean()), 5),
        "maxElevationDiffDeg": round(float(d_el.max()), 5), "worstHour": int(sep.argmax()),
    }


def main(argv=None):
    import requests

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--id", required=True)
    args = p.parse_args(argv)

    eph = json.loads((EPHEM_DIR / f"{args.id}.json").read_text())
    s = eph["series"]
    n = len(s["sunAz"])
    t0 = datetime.fromisoformat(s["startUtc"].rstrip("Z"))
    start = t0.strftime("%Y-%m-%d %H:%M")
    stop = (t0 + timedelta(hours=n - 1)).strftime("%Y-%m-%d %H:%M")

    report = {"id": args.id, "lat": eph["lat"], "lon": eph["lon"], "startUtc": s["startUtc"], "hours": n,
              "toleranceDeg": TOLERANCE_DEG, "spice": eph["provenance"],
              "horizons": {"api": API, "center": "coord@301", "quantities": 4, "apparent": "AIRLESS"},
              "checkedUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "bodies": {}}
    (RAW / "horizons").mkdir(parents=True, exist_ok=True)
    ok = True
    for name, body in (("sun", 10), ("earth", 399)):
        r = requests.get(API, params=horizons_params(body, eph["lat"], eph["lon"], eph["altKm"], start, stop), timeout=120)
        r.raise_for_status()
        (RAW / "horizons" / f"{args.id}_{name}.txt").write_text(r.text)
        theirs = parse_az_el(r.text)
        if len(theirs) != n:
            raise SystemExit(f"{name}: Horizons returned {len(theirs)} rows, expected {n}")
        ours = np.column_stack([s[f"{name}Az"], s[f"{name}El"]])
        res = compare(ours, theirs)
        res["pass"] = res["maxSeparationDeg"] <= TOLERANCE_DEG
        ok &= res["pass"]
        report["bodies"][name] = res
        print(f"{name:5s} max separation {res['maxSeparationDeg']:.5f} deg, "
              f"max elevation diff {res['maxElevationDiffDeg']:.5f} deg  {'PASS' if res['pass'] else 'FAIL'}")
    report["pass"] = bool(ok)
    REPORT_DIR.mkdir(exist_ok=True)
    out = REPORT_DIR / f"{args.id}.json"
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {out}")
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
