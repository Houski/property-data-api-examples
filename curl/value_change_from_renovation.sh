#!/usr/bin/env bash
# Estimate how a renovation changes a home's value with the Houski property data API.
#
# Finds a home by its address, then asks /predict for its estimated sale price
# twice: as it is, and with one more bedroom. Other facts can be overridden the
# same way, such as bathroom_full, interior_sq_m and construction_year.
#
# This script needs jq, which reads the property_id and the bedroom out of the first answer.
#
# Usage: ./value_change_from_renovation.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

address="${*:-100 main calgary}"

# exclude=inferred is left off here: /predict values the home by its bedroom count whether stated or
# worked out, so the example needs a count for every home.
found=$(curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1" \
  --data-urlencode "select=bedroom")

property_id=$(jq --raw-output '.data[0].property_id // empty' <<<"$found")

if [ -z "$property_id" ]; then
  echo "No property matched that address." >&2
  exit 1
fi

one_more_bedroom=$(jq --raw-output '.data[0].bedroom | if . == null then empty else . + 1 end' <<<"$found")

if [ -z "$one_more_bedroom" ]; then
  echo "The number of bedrooms of that home is not known." >&2
  exit 1
fi

printf '%s\n' "$found"

curl --silent --show-error --fail-with-body --get "$API_URL/predict" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id=$property_id" \
  --data-urlencode "fields=estimate_sale_price" \
  --data-urlencode "period=month" \
  --data-urlencode "last=1"
echo

# An override is passed by its bare field name. Here the same home is valued with one more bedroom.
curl --silent --show-error --fail-with-body --get "$API_URL/predict" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id=$property_id" \
  --data-urlencode "fields=estimate_sale_price" \
  --data-urlencode "period=month" \
  --data-urlencode "last=1" \
  --data-urlencode "bedroom=$one_more_bedroom"

# Each answer can be piped through jq to read it, for example | jq .data
