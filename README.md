# NYC Metro Home Values by ZIP

The landing page maps bedroom-specific typical home values across the NYC metro area. Choose 1, 2, 3, 4, or 5+ bedrooms, a 12-, 24-, or 36-month average, and a minimum or maximum value to find matching ZIP areas. Click or search a ZIP for all bedroom categories and its primary mapped town. Town names also appear as small map labels.

**The values are Zillow Home Value Index estimates, not closed-sale averages.** Public transaction files do not consistently provide bedroom counts across the full metro. See [HOME_VALUE_DATA_NOTES.md](HOME_VALUE_DATA_NOTES.md) for methodology and limitations.

## Run

```sh
python3 -m http.server 8000
```

Open http://localhost:8000, or open `index.html` directly. The checked-in extract is ready to use. Refresh it with `python3 scripts/build_home_values.py`; the build writes both JSON and a browser-loadable JavaScript copy. The prior IRS county migration explorer remains at `county.html`; its source notes are in [DATA_NOTES.md](DATA_NOTES.md).

Rebuild town labels with `python3 scripts/build_metro_towns.py`.
Rebuild water geometry with `python3 scripts/build_metro_water.py` (requires `pyshp` and `shapely`).
