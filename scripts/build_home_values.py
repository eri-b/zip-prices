"""Build a compact NYC metro ZIP home-value extract from Zillow Research CSVs.

These are ZHVI typical home values, not observed sale prices. A period value is
the arithmetic mean of available monthly ZHVI values in that trailing window.
"""

import csv
import json
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / "data/processed/metro_zctas.json"
OUTPUT = ROOT / "data/processed/metro_home_values.json"
URL = "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_{beds}_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"


def main():
    geometry = json.loads(GEOMETRY.read_text())
    metro_zips = {row["zip"] for row in geometry["zctas"]}
    values = {}
    end_dates = {}
    for beds in (1, 2, 3, 4, 5):
        source = URL.format(beds=beds)
        print(f"Downloading {beds} bedroom series…", flush=True)
        with urlopen(source, timeout=180) as response:
            rows = csv.DictReader((line.decode("utf-8-sig") for line in response))
            dates = [key for key in rows.fieldnames if len(key) == 10 and key[4] == "-" and key[7] == "-"]
            latest = max(dates)
            end_dates[str(beds)] = latest
            windows = {str(years): sorted(dates)[-years * 12:] for years in (1, 2, 3)}
            count = 0
            for row in rows:
                if row.get("RegionType") != "zip":
                    continue
                zipcode = row.get("RegionName", "").zfill(5)
                if zipcode not in metro_zips:
                    continue
                periods = {}
                for years, months in windows.items():
                    observed = [float(row[key]) for key in months if row.get(key)]
                    # Require at least 75% of months so a short run is not
                    # presented as a full one-, two-, or three-year average.
                    if len(observed) >= int(len(months) * .75):
                        periods[years] = round(sum(observed) / len(observed))
                if periods:
                    values.setdefault(zipcode, {})[str(beds)] = periods
                    count += 1
            print(f"  {count} metro ZIPs, latest month {latest}", flush=True)
    payload = {
        "format": "metro-zhvi-v1",
        "source": "Zillow Research ZIP ZHVI, bedroom-specific, seasonally adjusted",
        "source_url": "https://www.zillow.com/research/data/",
        "metric": "Mean of monthly typical home values, not sale prices",
        "end_dates": end_dates,
        "values": values,
    }
    compact = json.dumps(payload, separators=(",", ":"))
    OUTPUT.write_text(compact)
    OUTPUT.with_suffix(".js").write_text("window.METRO_HOME_VALUES=" + compact + ";\n")
    print(f"Wrote {OUTPUT} ({len(values)} ZIPs)")


if __name__ == "__main__":
    main()
