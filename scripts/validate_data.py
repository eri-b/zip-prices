"""Check extracted routes against source values and expected geography."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
geo = json.loads((ROOT / "data/geography.json").read_text())
data = json.loads((ROOT / "data/processed/routes_2022_2023.json").read_text())
records = data["records"]
origins = {x["fips"] for x in geo["origins"]}
destinations = {x["fips"] for x in geo["destinations"]}
seen = set()
for r in records:
    origin = r["origin_state_fips"] + r["origin_county_fips"]
    destination = r["destination_state_fips"] + r["destination_county_fips"]
    key = (r["year_start"], r["year_end"], origin, destination)
    assert origin in origins and destination in destinations, key
    assert key not in seen, f"duplicate route: {key}"
    seen.add(key)
    assert r["returns"] >= 20 and r["exemptions"] > 0, key
    assert r["agi_usd"] == r["agi_thousands"] * 1000, key
    assert r["destination_region"] == next(x["region"] for x in geo["destinations"] if x["fips"] == destination)
    assert r["year_start"] == 2022 and r["year_end"] == 2023

with (ROOT / "data/raw/countyoutflow2223.csv").open(newline="", encoding="latin-1") as file:
    source = list(csv.DictReader(file))
for r in records:
    raw = source[r["source_line"] - 2]
    assert raw["y1_statefips"] + raw["y1_countyfips"] == r["origin_state_fips"] + r["origin_county_fips"]
    assert raw["y2_statefips"] + raw["y2_countyfips"] == r["destination_state_fips"] + r["destination_county_fips"]
    assert (int(raw["n1"]), int(raw["n2"]), int(raw["agi"])) == (r["returns"], r["exemptions"], r["agi_thousands"])

assert len(records) == 79, f"unexpected route count: {len(records)}"
assert len(origins) * len(destinations) - len(records) == 1
assert (2022, 2023, "36085", "36079") not in seen  # Staten Island → Putnam is not published; the reason is not identified per row.
print(f"Validated {len(records)} unique routes against their exact raw CSV lines; one unpublished route remains missing.")
