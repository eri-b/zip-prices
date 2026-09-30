"""Extract actual NYC -> configured suburban county rows from the official CSV."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/countyoutflow2223.csv"
OUT = ROOT / "data/processed/routes_2022_2023.json"
GEO = json.loads((ROOT / "data/geography.json").read_text())
ORIGINS = {item["fips"]: item for item in GEO["origins"]}
DESTINATIONS = {item["fips"]: item for item in GEO["destinations"]}
EXPECTED_COLUMNS = ["y1_statefips", "y1_countyfips", "y2_statefips", "y2_countyfips", "y2_state", "y2_countyname", "n1", "n2", "agi"]

def main():
    if not RAW.exists():
        raise SystemExit("Run python3 scripts/download_irs_data.py first")
    records = []
    skipped_suppressed = []
    with RAW.open(newline="", encoding="latin-1") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != EXPECTED_COLUMNS:
            raise ValueError(f"Unexpected IRS layout: {reader.fieldnames}")
        for line, row in enumerate(reader, 2):
            origin_fips = row["y1_statefips"] + row["y1_countyfips"]
            destination_fips = row["y2_statefips"] + row["y2_countyfips"]
            if origin_fips not in ORIGINS or destination_fips not in DESTINATIONS:
                continue
            if any(row[key] == "-1" for key in ("n1", "n2", "agi")):
                skipped_suppressed.append(line)
                continue
            origin = ORIGINS[origin_fips]
            destination = DESTINATIONS[destination_fips]
            records.append({
                "year_start": 2022, "year_end": 2023,
                "origin_state_fips": row["y1_statefips"], "origin_county_fips": row["y1_countyfips"],
                "origin_state": "NY", "origin_county": origin["county"], "origin_borough": origin["name"],
                "destination_state_fips": row["y2_statefips"], "destination_county_fips": row["y2_countyfips"],
                "destination_state": destination["state"], "destination_county": row["y2_countyname"],
                "destination_name": destination["name"], "destination_region": destination["region"],
                "returns": int(row["n1"]), "exemptions": int(row["n2"]),
                "agi_thousands": int(row["agi"]), "agi_usd": int(row["agi"]) * 1000,
                "agi_per_return_usd": round(int(row["agi"]) * 1000 / int(row["n1"])),
                "agi_per_exemption_usd": round(int(row["agi"]) * 1000 / int(row["n2"])),
                "source_line": line
            })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "IRS SOI countyoutflow2223.csv", "year": "2022–2023", "records": records,
                               "suppressed_route_lines": skipped_suppressed}, indent=2) + "\n")
    print(f"Wrote {len(records)} county routes to {OUT}; {len(skipped_suppressed)} suppressed routes")
    for origin in GEO["origins"]:
        subset = sorted((r for r in records if r["origin_borough"] == origin["name"]), key=lambda r: -r["exemptions"])
        print(f"\n{origin['name'].upper()} — 2022→2023 (ranked by exemptions)")
        print(f"{'Destination':18} {'Returns':>9} {'Exemptions':>11} {'AGI ($000)':>12}")
        for r in subset:
            print(f"{r['destination_name'] + ', ' + r['destination_state']:18} {r['returns']:9,} {r['exemptions']:11,} {r['agi_thousands']:12,}")

if __name__ == "__main__":
    main()
