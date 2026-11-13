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

## Status (2026-11-13)
Working with real NASA data:
- `01_download_kernels.py`: downloads `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` from NAIF into `data/raw/kernels/`.
- `04_ephemeris.py`: hourly Sun and Earth az/el at a surface point (SPICE `spkcpo`, `MOON_ME` frame, `LT+S`, 1737.4 km sphere).
- `06_validate.py`: the same series from the JPL Horizons API (`CENTER='coord@301'`, quantity 4, airless), with a report in `validation/<id>.json`.

Validation results (tolerance 0.02 deg):

| Point | Window | Max separation, Sun | Max separation, Earth |
|---|---|---|---|
| lat -89.5, lon 0 | 1440 h from 2027-03-01 | 0.00007 deg | 0.00007 deg |
| lat -85.3, lon 31.7 E | 720 h from 2028-07-10 | 0.00007 deg | 0.00007 deg |

These two points are validation test points, not selected landing sites.

Still stubs: `02_fetch_dem.py`, `03_crop_local_frame.py`, `05_horizon_mask.py`, `07_export_site.py`. Terrain (LOLA) is not downloaded yet, so no real site file exists and the game still uses the illustrative demo site.

```bash
python scripts/01_download_kernels.py
python scripts/04_ephemeris.py --id test-point --lat -89.5 --lon 0 --start 2027-03-01T00:00:00 --hours 1440
python scripts/06_validate.py --id test-point
```

Challenge resources (from the Space Apps page): LROC QuickMap, NASA Moon Trek, JPL Horizons, CSA Moon exploration.
