#!/usr/bin/env bash
# Count homes and find the median price inside a polygon with the Houski property data API.
#
# Draw any area as a list of points, such as a sales territory, a flood zone or
# a school catchment, and /aggregate answers for the homes inside it.
#
# Usage: ./statistics_inside_a_polygon.sh

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

# The corners of the area as latitude and longitude, here a few blocks of central Calgary. At most 100 points.
# A polygon is written lat_lng,lat_lng,lat_lng with an underscore inside each point and commas between points.
POLYGON="51.05_-114.09,51.05_-114.05,51.03_-114.05,51.03_-114.09"

# Two statistics in one request. In a batch, every parameter carries the agg0_, agg1_
# prefix of its statistic. Only polygon and price_quote stay bare.
curl --silent --show-error --fail-with-body --get "$API_URL/aggregate" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "polygon=$POLYGON" \
  --data-urlencode "agg0_field=property_id" \
  --data-urlencode "agg0_aggregation=count" \
  --data-urlencode "agg1_field=estimate_list_price" \
  --data-urlencode "agg1_aggregation=median"

# The answer can be piped through jq to read it, for example | jq .data
