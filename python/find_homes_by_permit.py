"""Find homes by building permit history with the Houski property data API.

Lists homes in a city that had a roofing permit since a given date, with the
matching permits attached. Change the pattern to find any other kind of work,
such as solar, furnace or basement.

Usage: python find_homes_by_permit.py roof 2024-01-01
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


# A permit row attached by expand=permits.
class Permit(TypedDict, total=False):
    expand_permit_id: str
    expand_permit_application_date: str
    expand_permit_type: str
    expand_permit_content: str
    expand_permit_value: int


# A row always has address and property_id. A field with no value for a home is left out of the row.
class HomeWithPermits(TypedDict, total=False):
    address: str
    property_id: str
    construction_year: int
    permits: list[Permit]


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[HomeWithPermits]
    result_total: int
    pagination: Pagination


word = sys.argv[1] if len(sys.argv) > 1 else "roof"
since = sys.argv[2] if len(sys.argv) > 2 else "2024-01-01"

answer: PropertiesAnswer = houski(
    "properties",
    country_abbreviation="ca",
    province_abbreviation="ab",
    city="calgary",
    # expand attaches each property's permit rows to it.
    expand="permits",
    # These two filters choose which permit rows count. (?i) ignores case.
    expand_permit_application_date_gte=since,
    expand_permit_content_regex=f"(?i){word}",
    # all keeps only the properties that have a matching permit.
    filter_expand_match="all",
    select="construction_year",
    results_per_page=20,
)

for home in answer["data"]:
    print(f"{home['address']} (built {home.get('construction_year', 'year not known')})")
    for permit in home.get("permits", []):
        print(f"  {permit['expand_permit_application_date']} {permit['expand_permit_type']}: {permit['expand_permit_content']}")

print(f"{answer['result_total']} homes matched. Cost of this page: {answer['cost_cents']} cents")
