#!/usr/bin/env bash
# Find recent home sales in a city with the Houski property data API.
#
# Lists homes with a Sold event in the last 90 days, each with the matching
# sale rows attached: the date and the price.
#
# Usage: ./recent_home_sales.sh gb eng manchester

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

country="${1:-gb}"
province="${2:-eng}"
city="${3:-manchester}"

# Dates are written yyyy-mm-dd.
# On macOS the command is date -v-90d +%F
since=$(date -d "90 days ago" +%F)

# These two filters choose which listing rows count.
# all keeps only the properties that have a matching row.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=$country" \
  --data-urlencode "province_abbreviation=$province" \
  --data-urlencode "city=$city" \
  --data-urlencode "expand=listings" \
  --data-urlencode "expand_listing_event_eq=Sold" \
  --data-urlencode "expand_listing_date_gte=$since" \
  --data-urlencode "filter_expand_match=all" \
  --data-urlencode "select=property_type,interior_sq_m" \
  --data-urlencode "results_per_page=10"

# The answer can be piped through jq to read it, for example | jq .data
