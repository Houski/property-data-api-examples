#!/usr/bin/env bash
# Return only values from public records with the Houski property data API.
#
# Houski infers a value where no record states it, so nearly every home has
# one. Many fields have a matching _source field that says where the value came
# from: a link to the public record it was read from, Observed, Inferred or
# User. exclude=inferred leaves the inferred values out of the answer, and a
# value that is left out is not billed.
#
# Usage: ./public_record_values_only.sh

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

# inferred leaves out the values Houski worked out. exclude=inferred,observed
# keeps only the values read from a linked public record.
# A home whose floor area was inferred is left out of the answer, and is not counted or billed.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=us" \
  --data-urlencode "province_abbreviation=tx" \
  --data-urlencode "city=austin" \
  --data-urlencode "select=interior_sq_m,interior_sq_m_source" \
  --data-urlencode "exclude=inferred" \
  --data-urlencode "results_per_page=5"

# The answer can be piped through jq to read it, for example | jq .data
