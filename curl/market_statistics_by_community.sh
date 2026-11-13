#!/usr/bin/env bash
# Median home price and home count by community with the Houski property data API.
#
# Reads the communities of a city from /location, then asks /aggregate for the
# median estimated list price and the number of houses in each one, all in a
# single batched request.
#
# This script needs jq, which reads the community names out of the first answer.
#
# Usage: ./market_statistics_by_community.sh ca ab calgary

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

country="${1:-ca}"
province="${2:-ab}"
city="${3:-calgary}"

# Step 1: the communities of the city. Places always come from /location, never
# from a list written into the code.
locations=$(curl --silent --show-error --fail-with-body --get "$API_URL/location" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "resolution=community" \
  --data-urlencode "flat=true" \
  --data-urlencode "country_abbreviation=$country" \
  --data-urlencode "province_abbreviation=$province" \
  --data-urlencode "city=$city")

communities=()
while IFS= read -r community; do
  communities+=("$community")
done < <(jq --raw-output '[.data.flat[].community | select(. != null and . != "")] | .[:5][]' <<<"$locations")

# Step 2: two statistics per community in one request. In a batch, every
# parameter carries the agg0_, agg1_ prefix of the statistic it belongs to,
# numbered from 0 with no gaps.
fields=("estimate_list_price" "property_id")
aggregations=("median" "count")
parameters=()
for index in "${!communities[@]}"; do
  for number in 0 1; do
    prefix="agg$((index * 2 + number))_"
    parameters+=(
      --data-urlencode "${prefix}country_abbreviation=$country"
      --data-urlencode "${prefix}province_abbreviation=$province"
      --data-urlencode "${prefix}city=$city"
      --data-urlencode "${prefix}community_eq=${communities[$index]}"
      --data-urlencode "${prefix}property_type_eq=House"
      --data-urlencode "${prefix}field=${fields[$number]}"
      --data-urlencode "${prefix}aggregation=${aggregations[$number]}"
    )
  done
done

# The answers come back in the order they were asked, and every value is a string.
curl --silent --show-error --fail-with-body --get "$API_URL/aggregate" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  "${parameters[@]}"

# The answer can be piped through jq to read it, for example | jq .data
