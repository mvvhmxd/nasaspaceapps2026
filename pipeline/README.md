# Crater Expectations — offline data pipeline

Turns raw NASA data into the small per-site JSON files the static site loads
from `public/sites/<id>.json`. Nothing here runs in the browser. The product
has no backend and no AI.

## Data sources
- **LOLA DEMs** (Lunar Orbiter Laser Altimeter, PDS Geosciences Node): terrain
  heights around each south-pole site.
- **NAIF SPICE, DE440** planetary ephemeris (+ lunar frame / leapseconds kernels):
  Sun and Earth positions as seen from each site.
- **JPL Horizons**: independent check of those positions.

## Rule: SPICE computes, Horizons verifies
All shipped numbers come from SPICE. Horizons is only used in
`06_validate.py` to compare against, and to report the max error. If they
disagree beyond tolerance, fix the SPICE setup. Do not copy numbers over from Horizons.

## Stages
| Script | Does |
|---|---|
| `01_download_kernels.py` | fetch SPICE kernels into `data/raw/kernels/` |
| `02_fetch_dem.py` | fetch LOLA DEM tiles into `data/raw/dem/` |
| `03_crop_local_frame.py` | crop and resample to a local east/north grid |
| `04_ephemeris.py` | Sun/Earth az/el time series per site (SPICE) |
| `05_horizon_mask.py` | 360° terrain horizon mask (wide coarse DEM) |
| `06_validate.py` | compare with Horizons, report max error |
| `07_export_site.py` | write `public/sites/<id>.json` |

## Running
```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest tests
```
Stages are stubs for now. Run them in order once they're implemented.

## Never commit data
Kernels (`*.bsp`, `*.tpc`, `*.tls`), DEMs and `data/raw/` stay local
(see `pipeline/.gitignore`). Only the exported site JSON is committed.
