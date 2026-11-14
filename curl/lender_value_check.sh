#!/usr/bin/env bash
# Check a home's value for a mortgage file with the Houski property data API.
#
# Prints the estimated sale price beside the assessed value and the property
# taxes, then two years of monthly value history for the same home.
#
# This script needs jq, which reads the property_id out of the first answer.
#
# Usage: ./lender_value_check.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

address="${*:-100 main calgary}"

# Step 1: find the home and read its values. Money is in the currency of the
# property's country and is never converted. assessment_value_source says where
# the assessed value came from, often a link to the roll.
# exclude=inferred leaves out an assessed value or property taxes Houski worked out. estimate_sale_price
# has no source field, so it is untouched. Remove exclude to get the inferred values back.
found=$(curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1" \
  --data-urlencode "select=estimate_sale_price,assessment_value,assessment_value_source,property_taxes" \
  --data-urlencode "exclude=inferred")

property_id=$(jq --raw-output '.data[0].property_id // empty' <<<"$found")

if [ -z "$property_id" ]; then
  echo "No property matched that address, or Houski inferred both its assessed value and its property taxes." >&2
  exit 1
fi

printf '%s\n' "$found"

# Step 2: the modelled sale value of that home for each of the last 24 months.
# /predict covers 2021-01-01 to today. It does not forecast.
curl --silent --show-error --fail-with-body --get "$API_URL/predict" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id=$property_id" \
  --data-urlencode "fields=estimate_sale_price" \
  --data-urlencode "period=month" \
  --data-urlencode "last=24"

# Each answer can be piped through jq to read it, for example | jq .data
