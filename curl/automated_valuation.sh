#!/usr/bin/env bash
# Get an automated valuation of a home with the Houski property data API.
#
# Finds a home by its address, quotes the valuation for free, and runs it only
# when --yes is given, because a valuation costs $5.00. The valuation holds the
# estimated sale price, list price and monthly rent, each with a confidence
# score, plus warning flags and a link to a report.
#
# This script needs jq, which reads the property_id out of the first answer.
#
# Usage: ./automated_valuation.sh "100 main calgary"
#        ./automated_valuation.sh "100 main calgary" --yes

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

approved="false"
address=""
for argument in "$@"; do
  if [ "$argument" = "--yes" ]; then
    approved="true"
  else
    address="${address:+$address }$argument"
  fi
done
address="${address:-100 main calgary}"

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

# price_quote=true returns what the valuation would cost, and charges nothing.
curl --silent --show-error --fail-with-body --get "$API_URL/avm" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id=$property_id" \
  --data-urlencode "price_quote=true"
echo

# Never run a valuation without the yes of the person who pays for it.
if [ "$approved" != "true" ]; then
  echo "Run again with --yes to buy the valuation." >&2
  exit 1
fi

curl --silent --show-error --fail-with-body --get "$API_URL/avm" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "property_id=$property_id"

# Each answer can be piped through jq to read it, for example | jq .data
