#!/usr/bin/env bash
# Screen homes for sale as investments with the Houski property data API.
#
# Lists the houses for sale in a city with the highest cap rate first, and marks
# the ones whose list price sits below the estimated list price.
#
# Usage: ./investment_property_screen.sh ca ab calgary

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

country="${1:-ca}"
province="${2:-ab}"
city="${3:-calgary}"

# Filters are a field name, an operator suffix and a value.
# One sort per request. Homes with no cap rate sort last.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=$country" \
  --data-urlencode "province_abbreviation=$province" \
  --data-urlencode "city=$city" \
  --data-urlencode "for_sale_eq=true" \
  --data-urlencode "property_type_eq=House" \
  --data-urlencode "cap_rate_sort=desc" \
  --data-urlencode "select=list_price,estimate_list_price,estimate_rent_monthly,cap_rate" \
  --data-urlencode "results_per_page=25"

# The answer can be piped through jq to read it, for example | jq .data
