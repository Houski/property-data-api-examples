#!/usr/bin/env bash
# Address autocomplete with the Houski property data API.
#
# Prints address suggestions for a partly typed address, best match first. Call
# this from your own server as the visitor types, so the API key never reaches
# the browser.
#
# Usage: ./address_autocomplete.sh "100 main cal"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

typed_text="${*:-100 main cal}"

# With no select, a result carries only address and property_id, the least expensive answer.
curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$typed_text" \
  --data-urlencode "max_results=5"

# match_meta holds one match score per result, keyed by property_id.

# The answer can be piped through jq to read it, for example | jq .data
