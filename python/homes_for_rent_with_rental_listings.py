"""Find homes for rent with their rental listing history with the Houski property data API.

Lists homes that are for rent in a city, each with its rental listing events
attached: the date, the event and the monthly rent asked.

Usage: python homes_for_rent_with_rental_listings.py ca bc vancouver
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


# A rental listing row attached by expand=listings_rent.
class RentalListing(TypedDict, total=False):
    expand_listing_rent_date: str
    expand_listing_rent_event: str
    expand_estimate_rent_monthly: int
    expand_for_rent_what_is: str


# A row always has address and property_id. A field with no value for a home is left out of the row.
class HomeForRent(TypedDict, total=False):
    address: str
    property_id: str
    property_type: str
    bedroom: int
    estimate_rent_monthly: float
    listings_rent: list[RentalListing]


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[HomeForRent]
    result_total: int
    pagination: Pagination


country = sys.argv[1] if len(sys.argv) > 1 else "ca"
province = sys.argv[2] if len(sys.argv) > 2 else "bc"
city = sys.argv[3] if len(sys.argv) > 3 else "vancouver"

answer: PropertiesAnswer = houski(
    "properties",
    country_abbreviation=country,
    province_abbreviation=province,
    city=city,
    for_rent_eq="true",
    # expand attaches each property's rental listing rows to it. Each row is billed.
    expand="listings_rent",
    select="property_type,bedroom,estimate_rent_monthly",
    results_per_page=5,
)

for home in answer["data"]:
    print(f"{home['address']}: {home.get('property_type')}, {home.get('bedroom')} bedrooms, estimated rent {home.get('estimate_rent_monthly')}")
    for listing in home.get("listings_rent", []):
        print(f"  {listing.get('expand_listing_rent_date')} {listing.get('expand_listing_rent_event')}: {listing.get('expand_estimate_rent_monthly')} a month")

print(f"{answer['result_total']} homes for rent. Cost of this page: {answer['cost_cents']} cents")
