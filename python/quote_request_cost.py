"""Quote the cost of a request before running it with the Houski property data API.

Houski bills for the values a request returns, never for how much was
searched. Adding price_quote=true to any request returns what it would cost,
with no data and no charge. This program quotes a property search, then runs
it only if the cost is under a limit.

Usage: python quote_request_cost.py
"""

import json
import os
import sys
from typing import Any, TypedDict
import urllib.error
import urllib.parse
import urllib.request

API_URL = os.environ.get("HOUSKI_API_URL", "https://api.houski.ca")
API_KEY = os.environ.get("HOUSKI_API_KEY") or sys.exit("Set HOUSKI_API_KEY first. Keys come from https://www.houski.ca/dashboard/api")

MOST_CENTS_TO_SPEND = 25


def houski(endpoint: str, **parameters: Any) -> Any:
    """Send one GET request to the Houski API and return the parsed JSON answer."""
    query = urllib.parse.urlencode({"api_key": API_KEY, **parameters})
    try:
        with urllib.request.urlopen(f"{API_URL}/{endpoint}?{query}") as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        sys.exit(f"Houski answered {error.code}: {error.read().decode()}")


# Every billed answer carries these keys. A failure has the same shape with an empty data and a filled error.
class AnswerEnvelope(TypedDict):
    error: str
    time_ms: int
    cost_cents: float
    cache_hit: bool
    price_quote: bool


class Pagination(TypedDict):
    current_page: int
    page_total: int
    has_next_page: bool
    has_previous_page: bool


# A row always has address and property_id. A field with no value for a home is left out of the row.
class SearchedHome(TypedDict, total=False):
    address: str
    property_id: str
    bedroom: int
    bathroom_full: int
    interior_sq_m: float
    estimate_list_price: float


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[SearchedHome]
    result_total: int
    pagination: Pagination


search = {
    "country_abbreviation": "ca",
    "province_abbreviation": "ab",
    "city": "calgary",
    "property_type_eq": "House",
    "bedroom_gte": 3,
    "estimate_list_price_lte": 600000,
    "estimate_list_price_sort": "asc",
    # Selecting only the fields the code uses is the biggest saving.
    "select": "bedroom,bathroom_full,interior_sq_m,estimate_list_price",
    "results_per_page": 25,
}

quote: PropertiesAnswer = houski("properties", price_quote="true", **search)
print(f"{quote['result_total']} homes match. This page would cost {quote['cost_cents']} cents.")

if quote["cost_cents"] > MOST_CENTS_TO_SPEND:
    sys.exit(f"That is over the limit of {MOST_CENTS_TO_SPEND} cents, so the request was not run.")

answer: PropertiesAnswer = houski("properties", **search)
for home in answer["data"]:
    print(f"{home['address']}: {home.get('bedroom')} bedrooms, {home.get('interior_sq_m')} square metres, {home.get('estimate_list_price')}")

print(f"Cost: {answer['cost_cents']} cents")
