#!/usr/bin/env bash
# Property map clusters and a price heatmap with the Houski property data API.
#
# For one bounding box, prints the clusters a zoomed out map would draw, then
# the cells of a heatmap shaded by median estimated list price.
#
# Usage: ./map_clusters_and_heatmap.sh

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

# The north east and south west corners of the map view, here central Calgary.
BBOX_NE_LAT="51.1"
BBOX_NE_LNG="-113.9"
BBOX_SW_LAT="50.9"
BBOX_SW_LNG="-114.2"

# Clusters: at most ten, each with a centre and the number of properties in it.
curl --silent --show-error --fail-with-body --get "$API_URL/map" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "cluster=true" \
  --data-urlencode "property_type_eq=House" \
  --data-urlencode "bbox_ne_lat=$BBOX_NE_LAT" \
  --data-urlencode "bbox_ne_lng=$BBOX_NE_LNG" \
  --data-urlencode "bbox_sw_lat=$BBOX_SW_LAT" \
  --data-urlencode "bbox_sw_lng=$BBOX_SW_LNG"
echo

# Heatmap: one cell per patch of the box. aggregation_value is the median price
# of the cell, and intensity is that value scaled from 0 to 1 for shading.
curl --silent --show-error --fail-with-body --get "$API_URL/map" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "heatmap=true" \
  --data-urlencode "heatmap_aggregation_field=estimate_list_price" \
  --data-urlencode "heatmap_aggregation_type=median" \
  --data-urlencode "heatmap_cell_limit=100" \
  --data-urlencode "bbox_ne_lat=$BBOX_NE_LAT" \
  --data-urlencode "bbox_ne_lng=$BBOX_NE_LNG" \
  --data-urlencode "bbox_sw_lat=$BBOX_SW_LAT" \
  --data-urlencode "bbox_sw_lng=$BBOX_SW_LNG"

# Each answer can be piped through jq to read it, for example | jq .data
