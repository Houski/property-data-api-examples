#!/usr/bin/env bash
# Get the tax assessment history of a home with the Houski property data API.
#
# Finds a home by its address, then reads its assessed value for each year on
# record, beside its current assessed value and property taxes.
#
# This script needs jq, which reads the property_id out of the first answer.
#
# Usage: ./assessment_history.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

address="${*:-100 main calgary}"

found=$(curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1")

property_id=$(jq --raw-output '.data[0].property_id // empty' <<<"$found")

if [ -z "$property_id" ]; then
  echo "No property matched that address." >&2
  exit 1
fi

printf '%s\n' "$found"

# property_id_eq reads one property. expand attaches its assessment rows, one per year.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id_eq=$property_id" \
  --data-urlencode "expand=assessments" \
  --data-urlencode "select=assessment_value,property_taxes"

# Each answer can be piped through jq to read it, for example | jq .data
