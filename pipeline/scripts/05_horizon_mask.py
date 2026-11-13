"""Terrain horizon mask (360 azimuths) for each site, from the real LOLA terrain.

Wide coarse DEM for the far horizon, fine DEM for the near field: distant ridges matter, so the
mask is NOT computed from the small mesh crop. Observer 2 m above the surface, curvature included.

Writes data/derived/<id>_mask.json. Usage: python scripts/05_horizon_mask.py [site ids]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

NEAR_M, FAR_M = 15000.0, 250000.0


def main(argv=None):
    cfg = common.load_config()
    fine, wide = common.PolarDem(common.DEM_FINE), common.PolarDem(common.DEM_WIDE)
    common.DERIVED.mkdir(parents=True, exist_ok=True)
    for site in common.selected_sites(cfg, (argv if argv is not None else sys.argv[1:])):
        mask, dist = common.horizon_mask(fine, wide, site["lat_deg"], site["lon_deg"], common.EYE_HEIGHT_M, NEAR_M, FAR_M)
        out = {
            "id": site["id"], "eyeHeightM": common.EYE_HEIGHT_M, "nearM": NEAR_M, "farM": FAR_M,
            "fineProduct": common.DEM_FINE.upper(), "wideProduct": common.DEM_WIDE.upper(),
            "mask": [round(float(v), 3) for v in mask],
            "horizonDistanceKm": [round(float(v) / 1000, 2) for v in dist],
        }
        (common.DERIVED / f"{site['id']}_mask.json").write_text(json.dumps(out))
        print(f"{site['id']}: mask {mask.min():.2f}..{mask.max():.2f} deg, farthest horizon point {dist.max() / 1000:.0f} km")


if __name__ == "__main__":
    main()
