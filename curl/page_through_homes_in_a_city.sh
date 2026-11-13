#!/usr/bin/env bash
# Page through every home in a city with the Houski property data API.
#
# Walks the result of one search page by page, following has_next_page, which
# is how to pull a whole city or load a database. Each page is billed for the
# values it returns, so this program stops after a set number of pages. Raise
# MOST_PAGES to pull more.
#
# This script needs jq, which reads has_next_page out of each answer.
#
# Usage: ./page_through_homes_in_a_city.sh ca ab calgary

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

MOST_PAGES=3

country="${1:-ca}"
province="${2:-ab}"
city="${3:-calgary}"

page=1

while [ "$page" -le "$MOST_PAGES" ]; do
  # results_per_page goes up to 1000. One response holds at most 10,000 values,
  # counted as rows times columns with address and property_id included.
  answer=$(curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
    --data-urlencode "api_key=$HOUSKI_API_KEY" \
    --data-urlencode "country_abbreviation=$country" \
    --data-urlencode "province_abbreviation=$province" \
    --data-urlencode "city=$city" \
    --data-urlencode "select=estimate_list_price" \
    --data-urlencode "results_per_page=50" \
    --data-urlencode "page=$page")

  printf '%s\n' "$answer"

  # has_next_page says whether another page follows this one.
  has_next_page=$(jq '.pagination.has_next_page' <<<"$answer")

  if [ "$has_next_page" != "true" ]; then
    break
  fi
  page=$((page + 1))
done

# Each answer can be piped through jq to read it, for example | jq .data
