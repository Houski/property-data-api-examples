#!/usr/bin/env bash
# Find homes by building permit history with the Houski property data API.
#
# Lists homes in a city that had a roofing permit since a given date, with the
# matching permits attached. Change the pattern to find any other kind of work,
# such as solar, furnace or basement.
#
# Usage: ./find_homes_by_permit.sh roof 2024-01-01

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

word="${1:-roof}"
since="${2:-2024-01-01}"

# expand attaches each property's permit rows to it.
# These two filters choose which permit rows count. (?i) ignores case.
# all keeps only the properties that have a matching permit.
# exclude=inferred is left off here: it would drop each permit home whose construction year Houski worked out.
curl --silent --show-error --fail-with-body --get "$API_URL/properties" \
  --data-urlencode "api_key=$HOUSKI_API_KEY" \
  --data-urlencode "country_abbreviation=ca" \
  --data-urlencode "province_abbreviation=ab" \
  --data-urlencode "city=calgary" \
  --data-urlencode "expand=permits" \
  --data-urlencode "expand_permit_application_date_gte=$since" \
  --data-urlencode "expand_permit_content_regex=(?i)$word" \
  --data-urlencode "filter_expand_match=all" \
  --data-urlencode "select=construction_year" \
  --data-urlencode "results_per_page=20"

# The answer can be piped through jq to read it, for example | jq .data
