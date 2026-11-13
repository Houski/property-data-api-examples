#!/usr/bin/env bash
# Get property data by address with the Houski property data API.
#
# Turns a typed address into one property and prints its facts: property type,
# bedrooms, bathrooms, floor area, construction year and estimated sale price.
#
# Usage: ./get_property_data_by_address.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

address="${*:-100 main calgary}"

# /search matches a typed address, typos included, and returns the best matches first.
# select names the fields to return. Only the values that come back are billed.
curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1" \
  --data-urlencode "select=property_type,bedroom,bathroom_full,interior_sq_m,construction_year,estimate_sale_price"

# A field with no value for this home is left out of the row, so print what came back.

# The answer can be piped through jq to read it, for example | jq .data
