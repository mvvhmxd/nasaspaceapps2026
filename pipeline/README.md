# Data pipeline (Dev 3)

Offline Python that turns NASA data into `public/sites/<id>.json` (format: docs/ARCHITECTURE.md §4).
The file format is the API: the game only `fetch`es that JSON. No server.

**Rule: SPICE computes, Horizons verifies.** One source doing both proves nothing.

| Step | Script | Input → Output |
|---|---|---|
| 1 | `01_download_kernels.py` | NAIF kernels (DE440, Moon PA frames, LSK) → `data/raw/kernels/` |
| 2 | `02_fetch_dem.py` | LOLA polar DEMs (fine 20 m + wide coarse) → `data/raw/dem/` |
| 3 | `03_crop_local_frame.py` | DEM → heightmap in a **local east/north** frame (not the stereographic grid!) |
| 4 | `04_ephemeris.py` | site lat/lon → hourly Sun & Earth az/el, no refraction |
| 5 | `05_horizon_mask.py` | **wide** coarse DEM → 360-bin horizon mask (far massifs matter) |
| 6 | `06_validate.py` | JPL Horizons, same site & hours → max az/el error report |
| 7 | `07_export_site.py` | everything → `public/sites/<id>.json` |

## Setup
```bash
cd pipeline
python -m venv .venv
.venv\Scripts\activate        # Windows  (Linux/mac: source .venv/bin/activate)
pip install -r requirements.txt
pytest
```
Downloaded data goes in `data/raw/`, which is git-ignored. Never commit kernels or DEMs.
