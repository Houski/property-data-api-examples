"""Get property data by address with the Houski property data API.

Turns a typed address into one property and prints its facts: property type,
bedrooms, bathrooms, floor area, construction year and estimated sale price.

Usage: python get_property_data_by_address.py "100 main calgary"
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


class MatchMeta(TypedDict):
    property_id: str
    match_value: float


# A row always has address and property_id. A field with no value for a home is left out of the row.
class HomeFacts(TypedDict, total=False):
    address: str
    property_id: str
    property_type: str
    bedroom: int
    bathroom_full: int
    interior_sq_m: float
    construction_year: int
    estimate_sale_price: float


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[HomeFacts]
    match_meta: list[MatchMeta]
    result_total: int


address = " ".join(sys.argv[1:]) or "100 main calgary"

# /search matches a typed address, typos included, and returns the best matches first.
# select names the fields to return. Only the values that come back are billed.
answer: SearchAnswer = houski(
    "search",
    query=address,
    max_results=1,
    select="property_type,bedroom,bathroom_full,interior_sq_m,construction_year,estimate_sale_price",
)

if not answer["data"]:
    sys.exit("No property matched that address.")

# A field with no value for this home is left out of the row, so print what came back.
for field, value in answer["data"][0].items():
    print(f"{field}: {value}")

print(f"Cost: {answer['cost_cents']} cents")
