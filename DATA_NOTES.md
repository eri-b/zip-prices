# Data notes — first verified extract

## Source and available years

The official [IRS SOI migration index](https://www.irs.gov/statistics/soi-tax-stats-migration-data) currently lists 2022–2023 as its latest county-to-county release. CSV releases run from 2011–2012 through 2022–2023; older annual ZIP releases go back to 1990–1991. This MVP uses the [2022–2023 county outflow CSV](https://www.irs.gov/pub/irs-soi/countyoutflow2223.csv) and the [2022–2023 users guide](https://www.irs.gov/pub/irs-soi/2223inpublicmigdoc.pdf). The raw file is 4,584,439 bytes and 90,359 lines including its header.

## Layout and interpretation

CSV columns: `y1_statefips,y1_countyfips,y2_statefips,y2_countyfips,y2_state,y2_countyname,n1,n2,agi`. State and county FIPS are text with leading zeros (`36`,`047` for Brooklyn). `n1` is returns; `n2` is individuals represented (shown as **exemptions** in the UI for continuity with IRS terminology); `agi` is **thousands of US dollars** from the year-two return, including possible deficits. The importer preserves `agi_thousands` and derives `agi_usd` by multiplying by 1,000. AGI per return and per exemption are calculated means.

The IRS infers migration by matching return addresses in the two filing years. It says returns approximate households and individuals approximate people; they are not literal household and population counts. Filing-year addresses can differ from residences. People who do not file returns may be absent.

The 2022–2023 outflow file has special totals (`96`, `97`, `98`), foreign and other-flow records (`57`–`59`), and non-migrants with identical origin/destination FIPS. The importer only admits the configured actual county FIPS pairs, excluding all these records. `-1` indicates a suppressed value. County cells below 20 returns are not published; other suppression can also occur. No selected published route has a `-1`, but Staten Island → Putnam is absent for an unspecified publication reason, so the matrix displays `—` rather than zero. The 79 retained routes are unique.

The [IRS guide](https://www.irs.gov/pub/irs-soi/2223inpublicmigdoc.pdf) says the 2022–2023 matching update raised included returns by about 5%, so future year-over-year comparisons need an explicit break annotation. County detail can also fail to sum to published aggregate totals because of suppression and other-flow buckets.

## Connecticut geographic break

The latest IRS file codes Connecticut destinations as **planning regions**, such as Greater Bridgeport (`09120`) and Western Connecticut (`09190`), instead of Fairfield County (`09001`). Fairfield cannot be recovered from those rows as an exact county total. It is listed in `data/geography.json` as unavailable and excluded from the MVP denominator. A historical release with Fairfield County must not be presented as a directly comparable latest-year route.

## Manual source-row checks

CSV line numbers are one-based, including the header. The values below were checked directly in the untouched raw file and then in generated JSON. AGI in this table is the raw `$000` value.

| Route | Raw line | Origin FIPS | Destination FIPS | Returns | Exemptions | AGI ($000) |
|---|---:|---:|---:|---:|---:|---:|
| Kings → Westchester | 53,401 | 36047 | 36119 | 1,371 | 2,456 | 285,158 |
| New York → Westchester | 54,108 | 36061 | 36119 | 2,970 | 5,190 | 854,138 |
| Queens → Nassau | 54,762 | 36081 | 36059 | 10,413 | 20,494 | 985,184 |
| New York → Fairfield | — | 36061 | 09001 | — | — | — |

For the requested Fairfield check, the county row does not exist in the 2022–2023 source. For context only, the raw New York County → Western Connecticut Planning Region (`09190`) row is line 54,115: 1,398 returns, 2,394 exemptions, and AGI 718,209 ($000). It is **not** a substitute for Fairfield.

## Sample ranking — 2022→2023

Ranked by exemptions within the configured published NY/NJ suburban routes. AGI is raw `$000`.

| Origin | Destination | Returns | Exemptions | AGI ($000) |
|---|---|---:|---:|---:|
| Manhattan | Westchester, NY | 2,970 | 5,190 | 854,138 |
| Manhattan | Hudson, NJ | 3,860 | 5,068 | 719,036 |
| Manhattan | Bergen, NJ | 1,804 | 3,133 | 366,429 |
| Brooklyn | Nassau, NY | 2,571 | 4,754 | 278,682 |
| Brooklyn | Suffolk, NY | 1,722 | 3,052 | 213,067 |
| Brooklyn | Essex, NJ | 1,621 | 2,965 | 167,750 |
| Queens | Nassau, NY | 10,413 | 20,494 | 985,184 |
| Queens | Suffolk, NY | 4,036 | 7,422 | 359,137 |
| Queens | Bergen, NJ | 1,421 | 2,637 | 149,847 |
| Bronx | Westchester, NY | 5,118 | 8,951 | 357,803 |
| Bronx | Bergen, NJ | 1,034 | 1,991 | 67,216 |
| Bronx | Orange, NY | 844 | 1,559 | 58,959 |
| Staten Island | Monmouth, NJ | 829 | 1,663 | 103,981 |
| Staten Island | Middlesex, NJ | 843 | 1,527 | 78,807 |
| Staten Island | Hudson, NJ | 335 | 460 | 29,575 |

Run `python3 scripts/import_irs_data.py` to print the full 16-destination ranking for each borough. Run `python3 scripts/validate_data.py` to check every retained route against its exact source line, numeric units, duplicates, geography, and missing route count.

## Application architecture

The complete raw file is 4.6 MB; the extracted MVP is 79 rows. A static site with a generated JSON file is the smallest useful architecture: fast in-browser filtering, easy deployment, and no database or server logic. If historical data and reverse flows are added, keep the same pipeline and evaluate SQLite only if JSON growth or query complexity warrants it. Historical file layouts and Connecticut boundary changes should be checked year by year before combining them.

## Limits

County data cannot identify towns such as Hastings, Katonah, Pelham, or Bronxville. AGI is income, not wealth; AGI per return is a mean, not median household income. Counts exclude unpublished and suppressed county cells, and selected suburban totals are not totals for all moves out of NYC. The latest year is a filing-year comparison, not an exact count of moves during a calendar year. Historical trends, reverse flows, and a Fairfield comparison remain later work.
