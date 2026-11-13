#!/usr/bin/env bash
# Build every site in config/sites.yaml from raw NASA data to public/sites/<id>.json.
# Run from pipeline/ with the venv active. Downloads are skipped when files exist.
set -euo pipefail
PY=${PYTHON:-python}
$PY scripts/01_download_kernels.py
$PY scripts/02_fetch_dem.py
$PY scripts/03_crop_local_frame.py "$@"
$PY scripts/05_horizon_mask.py "$@"
eval "$($PY - "$@" <<'PYEOF'
import sys; sys.path.insert(0, "scripts"); import common
cfg = common.load_config(); w = cfg["window"]
for s in common.selected_sites(cfg, sys.argv[1:]):
    print(f"$PY scripts/04_ephemeris.py --id {s['id']} --lat {s['lat_deg']} --lon {s['lon_deg']} --start {w['start_utc']} --hours {w['hours']}")
    print(f"$PY scripts/06_validate.py --id {s['id']}")
PYEOF
)"
$PY scripts/07_export_site.py "$@"
