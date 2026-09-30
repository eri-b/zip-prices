"""Build an NYC-metro SVG boundary layer from official Census 2020 ZCTAs.

Requires pyshp (`python3 -m pip install pyshp`). The 64 MB national source is
downloaded to /tmp, then only local, simplified display geometry is retained.
"""
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import shapefile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/processed/metro_zctas.json"
URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"
BOUNDS = [-75.1, 40.2, -71.8, 41.8]  # Entire local display; arrows beyond it stop at its edge.
WIDTH, HEIGHT = 1400, 850


def project(lon, lat):
    return ((lon - BOUNDS[0]) / (BOUNDS[2] - BOUNDS[0]) * WIDTH,
            (BOUNDS[3] - lat) / (BOUNDS[3] - BOUNDS[1]) * HEIGHT)


def ring_path(points):
    out = []
    last = None
    for lon, lat in points:
        x, y = project(lon, lat)
        point = (round(x, 1), round(y, 1))
        if point == last:
            continue
        out.append(("M" if last is None else "L") + f"{point[0]},{point[1]}")
        last = point
    return "".join(out) + "Z" if out else ""


def main():
    with tempfile.TemporaryDirectory(prefix="nyc-zcta-") as directory:
        archive = Path(directory) / "zcta.zip"
        urllib.request.urlretrieve(URL, archive)
        with zipfile.ZipFile(archive) as source:
            source.extractall(directory)
        reader = shapefile.Reader(str(Path(directory) / "cb_2020_us_zcta520_500k.shp"))
        zctas = []
        for item in reader.iterShapeRecords():
            shape = item.shape
            x0, y0, x1, y1 = shape.bbox
            if x0 > BOUNDS[2] or x1 < BOUNDS[0] or y0 > BOUNDS[3] or y1 < BOUNDS[1]:
                continue
            starts = list(shape.parts) + [len(shape.points)]
            path = "".join(ring_path(shape.points[starts[i]:starts[i+1]]) for i in range(len(starts)-1))
            cx, cy = project((x0+x1)/2, (y0+y1)/2)
            zctas.append({"zip": item.record["ZCTA5CE20"], "path": path, "center": [round(cx, 1), round(cy, 1)]})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": URL, "bounds": BOUNDS, "width": WIDTH, "height": HEIGHT, "zctas": zctas}, separators=(",", ":")))
    print(f"Wrote {len(zctas)} ZCTA display polygons to {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
