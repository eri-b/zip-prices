# NYC Metro ZIP Flow Atlas

The landing page is a NYC-metro ZIP flow map. It outlines 2020 Census ZIP Code Tabulation Areas and draws origin-to-destination arrows with counts when a USPS Population Mobility Trends file is loaded locally. The earlier IRS county explorer remains at `county.html`.

## Run

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. The map ships with public ZCTA boundaries, but no NYC ZIP-to-ZIP counts. Load a licensed USPS PMT CSV or locally prepared JSON through the map’s file control. See [ZIP_DATA_NOTES.md](ZIP_DATA_NOTES.md) for data and license limits.

To rebuild the boundary layer: `python3 -m pip install pyshp` then `python3 scripts/build_metro_zctas.py`. For the prior county view, run `python3 scripts/download_irs_data.py`, `python3 scripts/import_irs_data.py`, and `python3 scripts/validate_data.py`. See [DATA_NOTES.md](DATA_NOTES.md) for its source checks.
