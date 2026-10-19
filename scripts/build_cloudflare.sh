#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist/data/processed

cp index.html map.css map.js dist/
cp data/processed/metro_zctas.js \
   data/processed/metro_home_values.js \
   data/processed/metro_towns.js \
   data/processed/metro_water.js \
   dist/data/processed/
