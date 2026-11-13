"""Write public/sites/<id>.json in the format src/data/loadSite.js reads (docs/ARCHITECTURE.md).

Needs, per site: 03 (heights), 05 (mask), 04 (ephemeris) and a passing 06 (Horizons validation).
Refuses to export a site whose validation is missing or failed.

Usage: python scripts/07_export_site.py [site ids]
"""
import base64
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def encode_heightmap(h):
    lo, hi = int(np.floor(h.min())), int(np.ceil(h.max()))
    q = np.round((h - lo) / (hi - lo) * 65535).astype("<u2")
    return {"size": int(h.shape[0]), "spacingM": common.GRID_SPACING_M, "minM": lo, "maxM": hi,
            "data": base64.b64encode(q.tobytes()).decode("ascii")}


def build(site, cfg):
    sid = site["id"]
    heights = np.load(common.DERIVED / f"{sid}_heights.npy")
    mask = json.loads((common.DERIVED / f"{sid}_mask.json").read_text())
    eph = json.loads((common.PIPELINE / "data" / "ephemeris" / f"{sid}.json").read_text())
    val_path = common.PIPELINE / "validation" / f"{sid}.json"
    if not val_path.exists():
        raise SystemExit(f"{sid}: no Horizons validation report; run 06_validate.py")
    val = json.loads(val_path.read_text())
    if not val["pass"]:
        raise SystemExit(f"{sid}: Horizons validation failed; not exporting")
    if (eph["lat"], eph["lon"]) != (site["lat_deg"], site["lon_deg"]) or (val["lat"], val["lon"]) != (eph["lat"], eph["lon"]):
        raise SystemExit(f"{sid}: ephemeris or validation was made for different coordinates; re-run 04 and 06")
    s = eph["series"]
    r3 = lambda a: [round(float(v), 3) for v in a]  # noqa: E731
    fine = common.read_label(common.DEM_DIR / f"{common.DEM_FINE}.lbl")
    return {
        "schemaVersion": 2,
        "id": sid, "name": site["name"], "blurb": site.get("blurb", ""), "lat": site["lat_deg"], "lon": site["lon_deg"],
        "illustrative": False,
        "source": "Terrain: NASA LOLA gridded DEM (PDS). Sun and Earth: SPICE DE440, checked against JPL Horizons. "
                  + cfg["source"],
        "maskSource": "lola-wide",
        "terrain": {
            "real": True, "dataSet": fine["DATA_SET_ID"], "productVersion": fine["PRODUCT_VERSION_ID"],
            "meshProduct": mask["fineProduct"], "horizonProducts": [mask["fineProduct"], mask["wideProduct"]],
            "frame": fine["COORDINATE_SYSTEM_NAME"], "resampling": "local east/north grid by great-circle offset, bilinear",
            "horizonRangeKm": mask["farM"] / 1000, "eyeHeightM": mask["eyeHeightM"],
        },
        "sky": {
            "real": True, "method": eph["provenance"]["method"], "kernels": eph["provenance"]["kernels"],
            "frame": eph["provenance"]["frame"], "aberration": eph["provenance"]["aberration"],
            "validation": {
                "against": "JPL Horizons API", "toleranceDeg": val["toleranceDeg"], "checkedUtc": val["checkedUtc"],
                "sunMaxSeparationDeg": val["bodies"]["sun"]["maxSeparationDeg"],
                "earthMaxSeparationDeg": val["bodies"]["earth"]["maxSeparationDeg"],
            },
        },
        "heightmap": encode_heightmap(heights),
        "horizonMask": mask["mask"],
        "series": {"startUtc": s["startUtc"], "stepHours": s["stepHours"], "sunAz": r3(s["sunAz"]), "sunEl": r3(s["sunEl"]),
                   "earthAz": r3(s["earthAz"]), "earthEl": r3(s["earthEl"])},
    }


def main(argv=None):
    cfg = common.load_config()
    common.SITES_OUT.mkdir(parents=True, exist_ok=True)
    for site in common.selected_sites(cfg, (argv if argv is not None else sys.argv[1:])):
        out = common.SITES_OUT / f"{site['id']}.json"
        text = json.dumps(build(site, cfg), separators=(",", ":"))
        out.write_text(text)
        print(f"wrote {out} ({len(text) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
