"""Prepare a licensed USPS Population Mobility Trends CSV for local map use.

This never copies the source file into the repository. Output is under ignored
data/private/ and should be loaded into the map only in a local browser session.
"""
import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZCTAS = ROOT / "data/processed/metro_zctas.json"
OUTPUT = ROOT / "data/private/metro_pmt.json"


def valid_zip(value):
    value = str(value or "").strip()
    return value.zfill(5) if value.isdigit() and len(value) <= 5 else None


def coordinate(value):
    try:
        return float(value) if str(value).strip() else None
    except ValueError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="Locally held USPS PMT CSV")
    parser.add_argument("--from-month", help="First YYYYMM to include")
    parser.add_argument("--to-month", help="Last YYYYMM to include")
    args = parser.parse_args()
    zip_set = {z["zip"] for z in json.loads(ZCTAS.read_text())["zctas"]}
    grouped = {}
    dates = set()
    accepted = 0
    with args.csv_file.open(newline="", encoding="utf-8-sig") as source:
        for line in source:
            if line.startswith("Date,"):
                fields = next(csv.reader([line]))
                break
        else:
            raise ValueError("USPS PMT header beginning with Date not found")
        required = {"Date", "O Zip", "N Zip", "Tot Vol"}
        if not required.issubset(fields):
            raise ValueError(f"Missing columns: {required - set(fields)}")
        reader = csv.DictReader(source, fieldnames=fields)
        for row in reader:
            date = (row.get("Date") or "").strip()
            if args.from_month and date < args.from_month:
                continue
            if args.to_month and date > args.to_month:
                continue
            origin = valid_zip(row.get("O Zip"))
            destination = valid_zip(row.get("N Zip"))
            if origin not in zip_set or destination is None:
                continue
            try:
                count = int((row.get("Tot Vol") or "").strip())
            except ValueError:
                continue
            if count <= 0:
                continue
            key = (origin, destination)
            if key not in grouped:
                grouped[key] = {"origin": origin, "destination": destination,
                                "city": (row.get("N Cty") or "").strip(),
                                "state": (row.get("N St") or "").strip(),
                                "count": 0,
                                "lat": coordinate(row.get("NEWLAT")),
                                "lon": coordinate(row.get("NEWLON"))}
            grouped[key]["count"] += count
            accepted += 1
            if date:
                dates.add(date)
    if not accepted:
        raise ValueError("No NYC metro origin ZCTA rows found; the public USPS sample has none")
    ordered_dates = sorted(dates)
    period = (ordered_dates[0] if len(ordered_dates) == 1 else
              f"{ordered_dates[0]}–{ordered_dates[-1]}" if ordered_dates else "undated file")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"format": "nyc-metro-pmt-v1", "period": period,
                                  "source_rows": accepted, "routes": list(grouped.values())}, separators=(",", ":")))
    print(f"Wrote {len(grouped):,} routes from {accepted:,} source rows ({period}) to {OUTPUT}")


if __name__ == "__main__":
    main()
