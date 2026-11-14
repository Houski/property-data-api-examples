#!/usr/bin/env bash
# Find properties near a latitude and longitude with the Houski property data API.
#
# Lists the houses within a radius of a point, nearest first. Use it for
# "homes near me", for comparable properties around an address, or to turn a
# map click into the properties around it.
#
# Usage: ./find_properties_near_point.sh 51.0447 -114.0719 0.5

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

latitude="${1:-51.0447}"
longitude="${2:--114.0719}"
radius_km="${3:-0.5}"

# The radius is in kilometres. shape is circle, the default, or square.
# /geocoding takes no place parameters. Filters narrow it the same way as on /properties.
# exclude=inferred leaves out the bedroom and bathroom counts Houski worked out, and a house with
# neither count stated. Remove exclude to get the inferred values back.
curl --silent --show-error --fail-with-body --get "$API_URL/geocoding" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "latitude=$latitude" \
  --data-urlencode "longitude=$longitude" \
  --data-urlencode "radius=$radius_km" \
  --data-urlencode "shape=circle" \
  --data-urlencode "property_type_eq=House" \
  --data-urlencode "select=bedroom,bathroom_full,estimate_list_price" \
  --data-urlencode "exclude=inferred" \
  --data-urlencode "results_per_page=10"

# The answer can be piped through jq to read it, for example | jq .data
