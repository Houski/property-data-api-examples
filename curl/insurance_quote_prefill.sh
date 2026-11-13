#!/usr/bin/env bash
# Pre-fill an insurance quote form from an address with the Houski property data API.
#
# One request returns the facts an insurer asks a home owner for: property type,
# construction year, floor area, roof material, and the flood and fire scores of
# the area. Each score runs from 0 to 10 and higher is better, so a high
# score_flood means the area floods less often.
#
# Usage: ./insurance_quote_prefill.sh "100 main calgary"

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

QUOTE_FORM_FIELDS="property_type,construction_year,interior_sq_m,roof_material,score_flood,score_fire"

address="${*:-100 main calgary}"

curl --silent --show-error --fail-with-body --get "$API_URL/search" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "query=$address" \
  --data-urlencode "max_results=1" \
  --data-urlencode "select=$QUOTE_FORM_FIELDS"

# A field with no value for this home is left out of the row. Leave that form box
# empty for the applicant to fill in.

# The answer can be piped through jq to read it, for example | jq .data
