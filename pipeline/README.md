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

## Status (2026-11-13): all seven stages run on real NASA data
```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
./run_all.sh            # every site in config/sites.yaml; or: ./run_all.sh ridge
python -m pytest tests
```
On Windows without bash, run the stages one by one in the order `run_all.sh` lists them.

| Stage | What it does now |
|---|---|
| `01_download_kernels.py` | NAIF kernels: `naif0012.tls`, `pck00011.tpc`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` |
| `02_fetch_dem.py` | LOLA GDR from PDS Geosciences (data set LRO-L-LOLA-4-GDR-V1.0, product V2.0): `LDEM_85S_40M` and `LDEM_80S_80M` (115 MB each) |
| `03_crop_local_frame.py` | 257 x 257 grid at 40 m in local east/north metres around the site, by great-circle offset, bilinear |
| `04_ephemeris.py` | hourly Sun and Earth az/el: SPICE `spkcpo`, `MOON_ME`, `LT+S`, 1737.4 km sphere |
| `05_horizon_mask.py` | 360-azimuth horizon, eye 2 m up, exact spherical geometry: fine DEM to 15 km, wide DEM to 250 km |
| `06_validate.py` | same series from the JPL Horizons API; report in `validation/<id>.json`; fails above 0.02 deg |
| `07_export_site.py` | `public/sites/<id>.json`; refuses a site without a passing validation for the same coordinates |

`scripts/candidates.py` is a helper, not a stage: it searches the fine DEM for local high points near the pole and scores each with its real horizon and Sun/Earth series.

### Checks made
- **Ephemeris vs Horizons:** max separation 0.00007 deg for the Sun and the Earth at every exported site and at two extra test points (`validation/`).
- **DEM projection:** the label convention (lon 0 up the image, 90 E right) puts known deep crater floors where expected (for example about -2.79 km at 89.67 S, 129.8 E and -3.93 km at 88.1 S, 44.9 E), and the two DEM products agree with each other to within a metre at the same points.
- **Geometry tests (`tests/test_geometry.py`):** smooth-sphere horizon equals the dip angle; a wall is seen only in its direction; grid orientation; pixel mapping; azimuth convention.

### Known limits
- Sites are this team's own picks from the terrain search, not official landing sites. Dev 1 still chooses the final three.
- The Sun is treated as a point at its centre; the real disc is about 0.5 deg wide.
- The frame is the DE421 mean-Earth/polar-axis frame for LOLA and `MOON_ME` (DE440) for SPICE. The difference is far below the 40 m grid.
- The horizon stops at 250 km or the edge of the 80 S grid.
- Kernels, DEMs and intermediate files are never committed (`data/raw/`, `data/derived/`, `data/ephemeris/`).

Challenge resources (from the Space Apps page): LROC QuickMap, NASA Moon Trek, JPL Horizons, CSA Moon exploration.
