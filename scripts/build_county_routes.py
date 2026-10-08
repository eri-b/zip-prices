"""Build a compact, multi-year extract of published IRS county outflows."""
import csv
import io
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
GEO = json.loads((ROOT / "data/geography.json").read_text())
LOCATIONS = {item["fips"]: item for item in GEO["destinations"]}
OUT = ROOT / "data/processed/county_routes.json"
COLUMNS = ["y1_statefips", "y1_countyfips", "y2_statefips", "y2_countyfips", "y2_state", "y2_countyname", "n1", "n2", "agi"]


def extract(year):
    suffix = f"{year % 100:02d}{(year + 1) % 100:02d}"
    url = f"https://www.irs.gov/pub/irs-soi/countyoutflow{suffix}.csv"
    records = {}
    duplicates = 0
    with urlopen(url, timeout=90) as response:
        reader = csv.DictReader(io.TextIOWrapper(response, encoding="latin-1", newline=""))
        if reader.fieldnames != COLUMNS:
            raise ValueError(f"Unexpected columns in {url}: {reader.fieldnames}")
        for row in reader:
            origin = row["y1_statefips"].zfill(2) + row["y1_countyfips"].zfill(3)
            destination = row["y2_statefips"].zfill(2) + row["y2_countyfips"].zfill(3)
            if origin not in LOCATIONS or destination not in LOCATIONS or origin == destination:
                continue
            if any(row[key] in ("", "-1") for key in ("n1", "n2", "agi")):
                continue
            record = {
                "o": origin, "d": destination,
                "returns": int(row["n1"]),
                "people": int(row["n2"]),
                "agi_usd": int(row["agi"]) * 1000,
            }
            key = (origin, destination)
            if key in records:
                if records[key] != record:
                    raise ValueError(f"Conflicting duplicate route {key} in {url}")
                duplicates += 1
                continue
            records[key] = record
    print(f"{year}–{year+1}: {len(records)} routes, {duplicates} identical duplicate rows")
    return list(records.values())


def main():
    payload = {
        "source": "IRS SOI county-to-county outflow",
        "years": {f"{year}-{year+1}": extract(year) for year in range(2011, 2023)},
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
