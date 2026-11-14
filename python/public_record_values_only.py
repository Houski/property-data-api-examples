"""Return only values from public records with the Houski property data API.

Houski estimates a value where no record states it, so nearly every home has
one. Many fields have a matching _source field that says where the value came
from: a link to the public record it was read from, Observed, Estimate or
User. exclude=estimates leaves the estimated values out of the answer, and a
value that is left out is not billed.

Usage: python public_record_values_only.py
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
class MeasuredHome(TypedDict, total=False):
    address: str
    property_id: str
    interior_sq_m: float
    interior_sq_m_source: str


# /properties with exclude: checked_fields lists the selected fields whose source was checked.
class PropertiesAnswer(AnswerEnvelope):
    data: list[MeasuredHome]
    result_total: int
    pagination: Pagination
    checked_fields: list[str]


answer: PropertiesAnswer = houski(
    "properties",
    country_abbreviation="us",
    province_abbreviation="tx",
    city="austin",
    select="interior_sq_m,interior_sq_m_source",
    # estimates leaves out the values Houski worked out. exclude=estimates,observed
    # keeps only the values read from a linked public record.
    exclude="estimates",
    results_per_page=5,
)

print(f"Fields checked for their source: {', '.join(answer.get('checked_fields', []))}")

for home in answer["data"]:
    # A home whose floor area was an estimate is left out of the answer, and is not counted or billed.
    print(f"{home['address']}: {home.get('interior_sq_m', 'no recorded floor area')} square metres, source {home.get('interior_sq_m_source', 'none')}")

print(f"Cost: {answer['cost_cents']} cents")
