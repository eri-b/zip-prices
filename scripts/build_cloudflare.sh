#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist/data/processed

cp index.html county.html map.css map.js county.css county.js DATA_NOTES.md dist/
cp data/geography.json dist/data/
cp data/processed/metro_zctas.js \
   data/processed/metro_home_values.js \
   data/processed/metro_towns.js \
   data/processed/metro_water.js \
   data/processed/routes_2022_2023.json \
   dist/data/processed/
