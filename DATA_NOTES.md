# County migration data notes

## Source and scope

The explorer uses the [IRS SOI county-to-county outflow files](https://www.irs.gov/statistics/soi-tax-stats-migration-data) for every available CSV year from 2011–2012 through 2022–2023. `python3 scripts/build_county_routes.py` downloads each official `countyoutflowYYZZ.csv` and writes the selected rows to `data/processed/county_routes.json`. The browser reads this compact extract; rebuilding requires network access.

Origins are the five NYC boroughs. Destinations are the other four boroughs, Ulster, and the selected NY and NJ counties in `data/geography.json`. Same-county rows are excluded because they do not represent a county-to-county move. This is a selected destination set, not all departures from NYC.

## Meaning of the values

The IRS matches taxpayer addresses on returns filed in consecutive years. `n1` is the count of matched tax returns, an approximation of households. `n2` is the number of individuals represented on those returns, not a complete population count. `agi` is aggregate adjusted gross income on destination-year returns, supplied in thousands of dollars and multiplied by 1,000 in the extract. It is income, not wealth.

Origin and destination FIPS are normalized to two state digits plus three county digits because the 2020–2021 and 2021–2022 CSVs omit some leading zeros. The importer keeps only real configured county pairs and skips suppressed `-1` or blank values. A route absent from the file or suppressed is displayed as `—`, never zero. Each retained origin–destination pair is checked for uniqueness within its year.

## Comparing years

The [IRS migration index](https://www.irs.gov/statistics/soi-tax-stats-migration-data) warns that its improved return-matching process beginning with 2022–2023 increased coverage. Treat the break between 2021–2022 and 2022–2023 as a methodology change, rather than a clean year-over-year movement. Other years and cells may be revised or unpublished.

Connecticut uses planning regions in the latest county file, so Fairfield County is not treated as a comparable destination across this series. The selected NY and NJ county definitions are stable within the series.

## Source-row checks

The two newly requested routes appear in both early and latest releases:

| Filing years | Origin → destination | Returns | People on returns | AGI ($000) |
|---|---|---:|---:|---:|
| 2011–2012 | Brooklyn → Manhattan | 8,623 | 12,506 | 555,150 |
| 2011–2012 | Manhattan → Ulster | 171 | 263 | 15,972 |
| 2022–2023 | Brooklyn → Manhattan | 7,421 | 9,588 | 992,073 |
| 2022–2023 | Manhattan → Ulster | 275 | 412 | 166,941 |

The original 2022–2023 raw file and `scripts/import_irs_data.py` remain for checking the earlier suburban-only extract. The explorer uses the multi-year `county_routes.json` instead.
