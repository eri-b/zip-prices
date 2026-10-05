# Home value data and interpretation

The landing page uses the free ZIP-level, bedroom-specific [Zillow Home Value Index (ZHVI) downloads](https://www.zillow.com/research/data/). We use the seasonally adjusted, middle-tier series for 1, 2, 3, 4, and 5+ bedroom single-family, condo, and co-op homes. **ZHVI estimates the typical value of all homes in a group, including homes that did not sell. It is not an average sale price.** Zillow's [methodology](https://www.zillow.com/research/zhvi-methodology/) describes how property-level value estimates are combined.

`scripts/build_home_values.py` reads Zillow's five public ZIP CSVs, retains ZIPs with a 2020 Census ZCTA in the map extent, and writes `data/processed/metro_home_values.json` plus a browser-loadable `.js` copy. For each bedroom group, the 12-, 24-, and 36-month figures are the arithmetic mean of available monthly ZHVI values in that window. A window requires at least 75% of its months. These are averages *over time*, not weighted means of home sales or homes. The build records the latest source month for each group. Zillow updates these data monthly and may change CSV paths.

Zillow publishes 4-bedroom and 5+ bedroom groups separately. We do not merge them into a 4+ price: without the number of homes or sales in each group, a combined average would be arbitrary.

The geometry comes from [2020 Census ZIP Code Tabulation Areas](https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html). These approximate USPS ZIP areas. Some valid ZIPs lack ZCTA boundaries and are absent from the map.

Water comes from the Census [2020 TIGER/Line area hydrography](https://www.census.gov/cgi-bin/geo/shapefiles/index.php?layergroup=Water&year=2020). `scripts/build_metro_water.py` selects county water polygons intersecting the map extent and simplifies their display paths. Water is drawn over the ZCTA fills; gaps without ZIP polygons remain neutral land rather than being treated as water.

Town labels come from the Census [2020 ZCTA-to-place relationship file](https://www.census.gov/geographies/reference-files/2020/geo/relationship-files.html). `scripts/build_metro_towns.py` chooses the Census place with the greatest land-area overlap for each ZCTA, falling back to the largest overlapping county subdivision where no place is listed. Within New York City, it uses the borough identified by the largest overlapping county instead of repeating "New York" across every borough. This identifies a useful area name; it is **not a population ranking** or an official USPS preferred city. The map displays only a limited number of labels at once to keep ZIP borders readable. The selected ZIP's area name appears in the detail panel.

The earlier NYC metro ZIP migration prototype and its source notes remain in the repository as `ZIP_DATA_NOTES.md`, but are no longer the landing page.

Data provided by Zillow Group.
