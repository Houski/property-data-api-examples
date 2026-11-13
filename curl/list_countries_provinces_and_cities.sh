#!/usr/bin/env bash
# List the countries, provinces or states, and cities the Houski property data API covers.
#
# Places are never written into code. /location returns the ones that hold
# data, so menus and validation stay right as coverage grows. This program
# prints every country, then the provinces or states of one country, then the
# cities of one province or state.
#
# Usage: ./list_countries_provinces_and_cities.sh ca ab

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

country="${1:-ca}"
province="${2:-ab}"

# resolution says which level to list. flat=true returns a plain list instead of a nested tree.
curl --silent --show-error --fail-with-body --get "$API_URL/location" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "resolution=country" \
  --data-urlencode "flat=true"
echo

# Each level needs every level above it, so provinces need their country.
curl --silent --show-error --fail-with-body --get "$API_URL/location" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "resolution=province" \
  --data-urlencode "flat=true" \
  --data-urlencode "country_abbreviation=$country"
echo

# /location has no paging, so always scope it. The slug of a city works as the city value of other requests.
curl --silent --show-error --fail-with-body --get "$API_URL/location" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "resolution=city" \
  --data-urlencode "flat=true" \
  --data-urlencode "country_abbreviation=$country" \
  --data-urlencode "province_abbreviation=$province"

# Each answer can be piped through jq to read it, for example | jq .data
