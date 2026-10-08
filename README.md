# NYC Metro Home Values by ZIP

Production app: [thirdbr.com](https://thirdbr.com/)

The landing page maps typical home values across the NYC area, including Ulster and Dutchess counties. Choose any bedroom count or 1, 2, 3, 4, or 5+ bedrooms, a 12-, 24-, or 36-month average, and a minimum or maximum value to find matching ZIP areas. Hover or search a ZIP for its values and primary mapped town. Clicking a ZIP opens it in Google Maps. Town names also appear as small map labels.

**The values are Zillow Home Value Index estimates, not closed-sale averages.** Public transaction files do not consistently provide bedroom counts across the full metro.

## Run

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. The checked-in home-value extract is ready to use. Refresh it with `python3 scripts/build_home_values.py`; the build writes both JSON and a browser-loadable JavaScript copy.

The [county migration explorer](county.html) shows IRS origin → destination flows from NYC boroughs to other boroughs and nearby counties for 2011–2012 through 2022–2023. Its checked-in extract is ready to use; refresh it with `python3 scripts/build_county_routes.py`. See [DATA_NOTES.md](DATA_NOTES.md) for source and comparability notes.

Rebuild town labels with `python3 scripts/build_metro_towns.py`.
Rebuild water geometry with `python3 scripts/build_metro_water.py` (requires `pyshp` and `shapely`).
Rebuild ZIP boundaries with `python3 scripts/build_metro_zctas.py` (requires `pyshp`), then rebuild the values, towns, and water layers because they use the ZIP selection and projection.

## Deploy to Cloudflare Workers

The site is configured as a Workers Static Assets project named `zip-prices` in `wrangler.jsonc`. The build publishes only the site files and browser data to `dist/`; it leaves raw source data and build scripts out of the deployed site.

For a connected Git repository, set the following in the Worker's **Settings → Build**:

- Build command: `sh scripts/build_cloudflare.sh`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Wrangler's `build.command` also runs the site build for local `npx wrangler deploy`. Cloudflare Workers Builds does not use that setting, so its dashboard Build command is required. Run `sh scripts/build_cloudflare.sh` locally to inspect the deployment files.
