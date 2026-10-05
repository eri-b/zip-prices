"""Build an SVG water overlay for the metro ZIP map from 2020 Census TIGER.

Requires pyshp and shapely (`python3 -m pip install pyshp shapely`). Uses the counties that
intersect mapped ZCTAs, then retains area hydrography intersecting map bounds.
"""

import csv
import io
import json
import urllib.request
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import shape as polygon_shape
from shapely.ops import transform


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / "data/processed/metro_zctas.json"
OUTPUT = ROOT / "data/processed/metro_water.json"
COUNTY_REL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
WATER_URL = "https://www2.census.gov/geo/tiger/TIGER2020/AREAWATER/tl_2020_{}_areawater.zip"


def project(lon, lat, bounds, width, height):
    return ((lon - bounds[0]) / (bounds[2] - bounds[0]) * width,
            (bounds[3] - lat) / (bounds[3] - bounds[1]) * height)


def ring_path(points):
    out = []
    previous = None
    for x, y in points:
        point = (round(x, 1), round(y, 1))
        if point == previous:
            continue
        out.append(("M" if previous is None else "L") + f"{point[0]},{point[1]}")
        previous = point
    return "".join(out) + "Z" if len(out) >= 3 else ""


def polygon_path(geometry):
    polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
    parts = []
    for polygon in polygons:
        if polygon.geom_type != "Polygon" or polygon.is_empty:
            continue
        parts.append(ring_path(polygon.exterior.coords))
        parts.extend(ring_path(ring.coords) for ring in polygon.interiors)
    return "".join(parts)


def county_ids(zips):
    counties = set()
    with urllib.request.urlopen(COUNTY_REL, timeout=90) as response:
        rows = csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig"), delimiter="|")
        for row in rows:
            if row["GEOID_ZCTA5_20"] in zips:
                counties.add(row["GEOID_COUNTY_20"])
    return sorted(counties)


def main():
    geometry = json.loads(GEOMETRY.read_text())
    zips = {row["zip"] for row in geometry["zctas"]}
    bounds, width, height = geometry["bounds"], geometry["width"], geometry["height"]
    paths = []
    counties = county_ids(zips)
    for county in counties:
        with urllib.request.urlopen(WATER_URL.format(county), timeout=90) as response:
            archive = zipfile.ZipFile(io.BytesIO(response.read()))
        prefix = f"tl_2020_{county}_areawater"
        reader = shapefile.Reader(
            shp=io.BytesIO(archive.read(prefix + ".shp")),
            shx=io.BytesIO(archive.read(prefix + ".shx")),
            dbf=io.BytesIO(archive.read(prefix + ".dbf")),
        )
        county_paths = []
        for item in reader.iterShapeRecords():
            shape = item.shape
            x0, y0, x1, y1 = shape.bbox
            if x0 > bounds[2] or x1 < bounds[0] or y0 > bounds[3] or y1 < bounds[1]:
                continue
            if (item.record["AWATER"] or 0) < 5000:
                continue
            polygon = polygon_shape(shape.__geo_interface__)
            projected = transform(lambda lon, lat, z=None: project(lon, lat, bounds, width, height), polygon)
            path = polygon_path(projected.simplify(0.5, preserve_topology=True))
            if path:
                county_paths.append(path)
        if county_paths:
            paths.append("".join(county_paths))
        print(f"{county}: {len(county_paths)} water areas", flush=True)
    payload = {"format": "metro-water-v1", "source": WATER_URL, "counties": len(counties), "paths": paths}
    compact = json.dumps(payload, separators=(",", ":"))
    OUTPUT.write_text(compact)
    OUTPUT.with_suffix(".js").write_text("window.METRO_WATER=" + compact + ";\n")
    print(f"Wrote {len(paths)} county paths to {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
