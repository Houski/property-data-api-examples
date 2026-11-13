"""Find recent home sales in a city with the Houski property data API.

Lists homes with a Sold event in the last 90 days, each with the matching
sale rows attached: the date and the price.

Usage: python recent_home_sales.py gb eng manchester
"""

import datetime
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


# A listing row attached by expand=listings. The event is Listed, Sold and so on.
class ListingEvent(TypedDict, total=False):
    expand_listing_date: str
    expand_listing_event: str
    expand_estimate_list_price: int


# A row always has address and property_id. A field with no value for a home is left out of the row.
class SoldHome(TypedDict, total=False):
    address: str
    property_id: str
    property_type: str
    interior_sq_m: float
    listings: list[ListingEvent]


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[SoldHome]
    result_total: int
    pagination: Pagination


country = sys.argv[1] if len(sys.argv) > 1 else "gb"
province = sys.argv[2] if len(sys.argv) > 2 else "eng"
city = sys.argv[3] if len(sys.argv) > 3 else "manchester"

# Dates are written yyyy-mm-dd.
since = (datetime.date.today() - datetime.timedelta(days=90)).isoformat()

answer: PropertiesAnswer = houski(
    "properties",
    country_abbreviation=country,
    province_abbreviation=province,
    city=city,
    expand="listings",
    # These two filters choose which listing rows count.
    expand_listing_event_eq="Sold",
    expand_listing_date_gte=since,
    # all keeps only the properties that have a matching row.
    filter_expand_match="all",
    select="property_type,interior_sq_m",
    results_per_page=10,
)

for home in answer["data"]:
    for sale in home.get("listings", []):
        print(f"{sale.get('expand_listing_date')}: {home['address']} ({home.get('property_type')}, {home.get('interior_sq_m')} square metres) sold for {sale.get('expand_estimate_list_price')}")

print(f"{answer['result_total']} homes sold since {since}. Cost of this page: {answer['cost_cents']} cents")
