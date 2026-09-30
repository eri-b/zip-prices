"""Download the official 2022–2023 IRS county outflow CSV, preserving raw bytes."""
from pathlib import Path
from urllib.request import urlopen

URL = "https://www.irs.gov/pub/irs-soi/countyoutflow2223.csv"
TARGET = Path(__file__).resolve().parents[1] / "data/raw/countyoutflow2223.csv"

if TARGET.exists():
    print(f"Already present: {TARGET} ({TARGET.stat().st_size:,} bytes)")
else:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(URL, timeout=60) as response, TARGET.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    print(f"Downloaded {URL} -> {TARGET} ({TARGET.stat().st_size:,} bytes)")
