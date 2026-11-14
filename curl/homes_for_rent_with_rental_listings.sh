#!/usr/bin/env bash
# Find homes for rent with their rental listing history with the Houski property data API.
#
# Lists homes that are for rent in a city, each with its rental listing events
# attached: the date, the event and the monthly rent asked.
#
# Usage: ./homes_for_rent_with_rental_listings.sh ca bc vancouver

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

country="${1:-ca}"
province="${2:-bc}"
city="${3:-vancouver}"

# expand attaches each property's rental listing rows to it. Each row is billed.
# exclude=inferred leaves out the property types and bedroom counts Houski worked out, and a home with
# neither one stated. Remove exclude to get the inferred values back.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=$country" \
  --data-urlencode "province_abbreviation=$province" \
  --data-urlencode "city=$city" \
  --data-urlencode "for_rent_eq=true" \
  --data-urlencode "expand=listings_rent" \
  --data-urlencode "select=property_type,bedroom,estimate_rent_monthly" \
  --data-urlencode "exclude=inferred" \
  --data-urlencode "results_per_page=5"

# The answer can be piped through jq to read it, for example | jq .data
