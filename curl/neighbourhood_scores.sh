#!/usr/bin/env bash
# Get the neighbourhood scores of an address with the Houski property data API.
#
# Prints how the area around a home rates for walkability, transit, schools,
# safety and quiet. Each score runs from 0 to 10 and higher is always better.
#
# Usage: ./neighbourhood_scores.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

address="${*:-100 main calgary}"

curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1" \
  --data-urlencode "select=score_total,score_walkability,score_transit,score_education,score_safety,score_quiet"

# The answer can be piped through jq to read it, for example | jq .data
