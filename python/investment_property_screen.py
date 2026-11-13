"""Screen homes for sale as investments with the Houski property data API.

Lists the houses for sale in a city with the highest cap rate first, and marks
the ones whose list price sits below the estimated list price.

Usage: python investment_property_screen.py ca ab calgary
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
class ForSaleHome(TypedDict, total=False):
    address: str
    property_id: str
    list_price: float
    estimate_list_price: float
    estimate_rent_monthly: float
    cap_rate: float


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[ForSaleHome]
    result_total: int
    pagination: Pagination


country, province, city = (sys.argv[1:4] + ["ca", "ab", "calgary"][len(sys.argv) - 1 :])[:3]

answer: PropertiesAnswer = houski(
    "properties",
    country_abbreviation=country,
    province_abbreviation=province,
    city=city,
    # Filters are a field name, an operator suffix and a value.
    for_sale_eq="true",
    property_type_eq="House",
    # One sort per request. Homes with no cap rate sort last.
    cap_rate_sort="desc",
    select="list_price,estimate_list_price,estimate_rent_monthly,cap_rate",
    results_per_page=25,
)

for home in answer["data"]:
    list_price, estimate = home.get("list_price"), home.get("estimate_list_price")
    below_estimate = "  below estimate" if list_price and estimate and list_price < estimate else ""
    print(f"{home['address']}: cap rate {home.get('cap_rate')}, list price {list_price}, estimate {estimate}, rent {home.get('estimate_rent_monthly')}{below_estimate}")

print(f"{answer['result_total']} houses for sale. Cost of this page: {answer['cost_cents']} cents")
