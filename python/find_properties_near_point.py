"""Find properties near a latitude and longitude with the Houski property data API.

Lists the houses within a radius of a point, nearest first. Use it for
"homes near me", for comparable properties around an address, or to turn a
map click into the properties around it.

Usage: python find_properties_near_point.py 51.0447 -114.0719 0.5
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


class Pagination(TypedDict):
    current_page: int
    page_total: int
    has_next_page: bool
    has_previous_page: bool


# A row always has address and property_id. A field with no value for a home is left out of the row.
class NearbyHome(TypedDict, total=False):
    address: str
    property_id: str
    bedroom: int
    bathroom_full: int
    estimate_list_price: float


# /geocoding: one row per property, nearest first, paged like /properties.
class GeocodingAnswer(AnswerEnvelope):
    data: list[NearbyHome]
    result_total: int
    pagination: Pagination


latitude = sys.argv[1] if len(sys.argv) > 1 else "51.0447"
longitude = sys.argv[2] if len(sys.argv) > 2 else "-114.0719"
radius_km = sys.argv[3] if len(sys.argv) > 3 else "0.5"

answer: GeocodingAnswer = houski(
    "geocoding",
    latitude=latitude,
    longitude=longitude,
    # The radius is in kilometres. shape is circle, the default, or square.
    radius=radius_km,
    shape="circle",
    # /geocoding takes no place parameters. Filters narrow it the same way as on /properties.
    property_type_eq="House",
    select="bedroom,bathroom_full,estimate_list_price",
    # exclude=inferred leaves out the bedroom and bathroom counts Houski worked out, and a house with
    # neither count stated. Remove exclude to get the inferred values back.
    exclude="inferred",
    results_per_page=10,
)

for home in answer["data"]:
    print(f"{home['address']}: {home.get('bedroom')} bedrooms, {home.get('bathroom_full')} full bathrooms, {home.get('estimate_list_price')}")

print(f"{answer['result_total']} houses within {radius_km} km. Cost of this page: {answer['cost_cents']} cents")
