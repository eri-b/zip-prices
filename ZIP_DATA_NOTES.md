# NYC metro ZIP flow map — data notes

## What is available

The new landing page uses [2020 Census ZIP Code Tabulation Area (ZCTA) cartographic boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2020.html). The reproducible `scripts/build_metro_zctas.py` download converts the national source to 1,308 local display areas in `data/processed/metro_zctas.json`. The map extent is fixed to roughly 75.1°W–71.8°W and 40.2°N–41.8°N. Out-of-area flows terminate at the map frame, where their destination ZIP and count are labeled.

**ZCTAs approximate ZIP delivery areas; they are not official USPS ZIP boundaries.** Some USPS ZIPs have no ZCTA, especially nonresidential ZIPs, so they do not have a hoverable polygon. The [Census explanation](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html) describes this difference.

## ZIP-to-ZIP counts

[USPS Population Mobility Trends](https://postalpro.usps.com/pmt) (PMT) is the identified source of actual origin/destination ZIP pairs. It publishes up to nine highest-volume destination ZIPs per origin ZIP (three each in its local, in-state, and out-of-state groups), subject to minimum-count rules. Its `Tot Vol` field in the [official sample CSV](https://postalpro.usps.com/node/12150) is used as change-of-address request count. These are **not all migration routes**, not counts of individual people, and not the IRS returns or AGI measures. Do not use the displayed route sum as a total number of movers.

The public 12-month and 48-month USPS sample CSVs contain only a handful of Massachusetts/Puerto Rico rows, no NYC-origin examples. No real NYC ZIP-to-ZIP counts are bundled with this project. The map deliberately displays no arrows until data is loaded. USPS offers PMT through a license; the [product page](https://postalpro.usps.com/pmt) says limited editions permit only limited published summaries. Check the applicable agreement before publicly deploying route counts.

## Loading a licensed file

For a modest CSV, click **Load local flow data** in the map. The file is parsed in your browser and is not uploaded or stored. Select any origin area with published rows to see arrows and a ranked list. The page shows the month range contained in the loaded rows and sums counts across that range.

For a large USPS CSV, preprocess it locally:

```sh
python3 scripts/import_usps_pmt.py /path/to/your/PMT.csv
```

Optional `--from-month YYYYMM` and `--to-month YYYYMM` restrict the period. The output `data/private/metro_pmt.json` is excluded from Git; load that JSON through the same map button. Keep licensed source files outside the repository. Both import paths preserve reported counts and aggregate only duplicate origin/destination pairs across included months. Neither estimates missing flows.

The import only retains origin ZIPs that have a Census ZCTA intersecting the displayed metro extent. A route destination can be inside or outside it. If a destination is beyond the map, the USPS latitude/longitude fields place the outgoing arrow on the appropriate edge. If coordinates are unavailable, the destination remains in the list without a mapped arrow.

## Existing county data

The former IRS county explorer remains at `county.html`, with its raw-source checks in `DATA_NOTES.md`. It is separate from the USPS ZIP view and should not be mixed into ZIP flow counts.
