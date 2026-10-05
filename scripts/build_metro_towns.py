"""Choose the Census place covering the most land in each mapped ZCTA.

For ZCTAs without an incorporated place or CDP, fall back to the largest
overlapping county subdivision. This is an area-based map label, not a
population ranking or a USPS preferred city name.
"""

import csv
import io
import json
import re
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / "data/processed/metro_zctas.json"
OUTPUT = ROOT / "data/processed/metro_towns.json"
BASE = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/"
FILES = (
    ("place", "tab20_zcta520_place20_natl.txt", "NAMELSAD_PLACE_20", "GEOID_PLACE_20"),
    ("county subdivision", "tab20_zcta520_cousub20_natl.txt", "NAMELSAD_COUSUB_20", "GEOID_COUSUB_20"),
    ("county", "tab20_zcta520_county20_natl.txt", "NAMELSAD_COUNTY_20", "GEOID_COUNTY_20"),
)
NYC_BOROUGHS = {"New York County": "Manhattan", "Kings County": "Brooklyn", "Bronx County": "Bronx", "Queens County": "Queens", "Richmond County": "Staten Island"}


def clean_name(name):
    return re.sub(r" (city|town|village|borough|CDP|township|municipality)$", "", name).strip()


def read_largest(file_name, name_column, id_column, zips):
    largest = {}
    with urlopen(BASE + file_name, timeout=90) as response:
        rows = csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig"), delimiter="|")
        for row in rows:
            zipcode = row["GEOID_ZCTA5_20"]
            name = row[name_column]
            if zipcode not in zips or not name:
                continue
            area = int(row["AREALAND_PART"] or 0)
            if area > largest.get(zipcode, (0, ""))[0]:
                largest[zipcode] = (area, clean_name(name), row[id_column])
    return largest


def main():
    zips = {row["zip"] for row in json.loads(GEOMETRY.read_text())["zctas"]}
    places = read_largest(FILES[0][1], FILES[0][2], FILES[0][3], zips)
    subdivisions = read_largest(FILES[1][1], FILES[1][2], FILES[1][3], zips)
    counties = read_largest(FILES[2][1], FILES[2][2], FILES[2][3], zips)
    towns = {}
    for zipcode in sorted(zips):
        if zipcode in places:
            name = places[zipcode][1]
            county = counties.get(zipcode, (0, ""))[1]
            if name == "New York" and county in NYC_BOROUGHS:
                towns[zipcode] = {"name": NYC_BOROUGHS[county], "source": "NYC borough", "id": "borough:" + county}
            else:
                towns[zipcode] = {"name": name, "source": "place", "id": places[zipcode][2]}
        elif zipcode in subdivisions:
            towns[zipcode] = {"name": subdivisions[zipcode][1], "source": "county subdivision", "id": subdivisions[zipcode][2]}
    payload = {"format": "metro-towns-v1", "method": "largest land overlap", "source_url": BASE, "towns": towns}
    compact = json.dumps(payload, separators=(",", ":"))
    OUTPUT.write_text(compact)
    OUTPUT.with_suffix(".js").write_text("window.METRO_TOWNS=" + compact + ";\n")
    print(f"Wrote {len(towns)} ZIP town labels to {OUTPUT}")


if __name__ == "__main__":
    main()
