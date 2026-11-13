#!/usr/bin/env bash
# Quote the cost of a request before running it with the Houski property data API.
#
# Houski bills for the values a request returns, never for how much was
# searched. Adding price_quote=true to any request returns what it would cost,
# with no data and no charge. This program quotes a property search, then runs
# it only if the cost is under a limit.
#
# This script needs jq, which reads cost_cents out of the quote.
#
# Usage: ./quote_request_cost.sh

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

MOST_CENTS_TO_SPEND=25

# Selecting only the fields the code uses is the biggest saving.
quote=$(curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "price_quote=true" \
  --data-urlencode "country_abbreviation=ca" \
  --data-urlencode "province_abbreviation=ab" \
  --data-urlencode "city=calgary" \
  --data-urlencode "property_type_eq=House" \
  --data-urlencode "bedroom_gte=3" \
  --data-urlencode "estimate_list_price_lte=600000" \
  --data-urlencode "estimate_list_price_sort=asc" \
  --data-urlencode "select=bedroom,bathroom_full,interior_sq_m,estimate_list_price" \
  --data-urlencode "results_per_page=25")

printf '%s\n' "$quote"

over_the_limit=$(jq --argjson limit "$MOST_CENTS_TO_SPEND" '.cost_cents > $limit' <<<"$quote")

if [ "$over_the_limit" = "true" ]; then
  echo "That is over the limit of $MOST_CENTS_TO_SPEND cents, so the request was not run." >&2
  exit 1
fi

curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=ca" \
  --data-urlencode "province_abbreviation=ab" \
  --data-urlencode "city=calgary" \
  --data-urlencode "property_type_eq=House" \
  --data-urlencode "bedroom_gte=3" \
  --data-urlencode "estimate_list_price_lte=600000" \
  --data-urlencode "estimate_list_price_sort=asc" \
  --data-urlencode "select=bedroom,bathroom_full,interior_sq_m,estimate_list_price" \
  --data-urlencode "results_per_page=25"

# Each answer can be piped through jq to read it, for example | jq .data
