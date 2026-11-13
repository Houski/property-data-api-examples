"""Page through every home in a city with the Houski property data API.

Walks the result of one search page by page, following has_next_page, which
is how to pull a whole city or load a database. Each page is billed for the
values it returns, so this program stops after a set number of pages. Raise
MOST_PAGES to pull more.

Usage: python page_through_homes_in_a_city.py ca ab calgary
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
class PricedHome(TypedDict, total=False):
    address: str
    property_id: str
    estimate_list_price: float


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[PricedHome]
    result_total: int
    pagination: Pagination


MOST_PAGES = 3

country = sys.argv[1] if len(sys.argv) > 1 else "ca"
province = sys.argv[2] if len(sys.argv) > 2 else "ab"
city = sys.argv[3] if len(sys.argv) > 3 else "calgary"

page = 1
homes_read = 0
cents_spent = 0.0

while page <= MOST_PAGES:
    answer: PropertiesAnswer = houski(
        "properties",
        country_abbreviation=country,
        province_abbreviation=province,
        city=city,
        select="estimate_list_price",
        # results_per_page goes up to 1000. One response holds at most 10,000 values,
        # counted as rows times columns with address and property_id included.
        results_per_page=50,
        page=page,
    )

    for home in answer["data"]:
        print(f"{home['property_id']} {home['address']}: {home.get('estimate_list_price')}")

    homes_read += len(answer["data"])
    cents_spent += answer["cost_cents"]

    # has_next_page says whether another page follows this one.
    if not answer["pagination"]["has_next_page"]:
        break
    page += 1

print(f"Read {homes_read} of {answer['result_total']} homes. Cost: {cents_spent} cents")
