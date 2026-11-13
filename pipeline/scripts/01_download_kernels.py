"""Download the SPICE kernels from NAIF into data/raw/kernels/ (never committed).

Source: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ . Skips files already present.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import KERNEL_DIR, KERNELS, NAIF  # noqa: E402


def main():
    import requests

    KERNEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, rel in KERNELS.items():
        dest = KERNEL_DIR / name
        if dest.exists() and dest.stat().st_size > 0:
            print(f"have  {name} ({dest.stat().st_size / 1e6:.1f} MB)")
            continue
        url = NAIF + rel
        print(f"fetch {url}")
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(dest)
        print(f"saved {name} ({dest.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
