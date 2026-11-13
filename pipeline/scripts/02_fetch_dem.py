"""Download the LOLA south-pole DEMs (IMG + PDS label) into data/raw/dem/ (never committed).

Products (LOLA gridded data records, south polar stereographic, PDS data set LRO-L-LOLA-4-GDR-V1.0):
  LDEM_85S_40M  40 m/pixel, 85S to the pole: terrain mesh and near-field horizon
  LDEM_80S_80M  80 m/pixel, 80S to the pole: wide grid for the far horizon
Source: PDS Geosciences Node. Skips files already present.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DEM_DIR, DEM_FINE, DEM_WIDE, PDS_LOLA  # noqa: E402


def main():
    import requests

    DEM_DIR.mkdir(parents=True, exist_ok=True)
    for product, ext in [(p, e) for p in (DEM_FINE, DEM_WIDE) for e in ("lbl", "img")]:
        dest = DEM_DIR / f"{product}.{ext}"
        if dest.exists() and dest.stat().st_size > 0:
            print(f"have  {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
            continue
        url = f"{PDS_LOLA}{product}.{ext}"
        print(f"fetch {url}")
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(dest)
        print(f"saved {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
