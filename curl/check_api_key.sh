#!/usr/bin/env bash
# Check that a Houski API key works.
#
# Calls /auth, which says whether the key exists and is enabled. It is free, so
# it is the right first request to make with a new key.
#
# Usage: ./check_api_key.sh

set -euo pipefail

API_URL="${HOUSKI_API_URL:-https://api.houski.ca}"
: "${HOUSKI_API_KEY:?Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api}"

curl --silent --show-error --fail-with-body --get "$API_URL/auth" \
  --data-urlencode "api_key=$HOUSKI_API_KEY"

# The answer can be piped through jq to read it, for example | jq .api_key_authorized
