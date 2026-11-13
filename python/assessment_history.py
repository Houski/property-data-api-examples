"""Get the tax assessment history of a home with the Houski property data API.

Finds a home by its address, then reads its assessed value for each year on
record, beside its current assessed value and property taxes.

Usage: python assessment_history.py "100 main calgary"
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


class Pagination(TypedDict):
    current_page: int
    page_total: int
    has_next_page: bool
    has_previous_page: bool


# With no select, a row carries only address and property_id.
class FoundHome(TypedDict):
    address: str
    property_id: str


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[FoundHome]
    match_meta: list[MatchMeta]
    result_total: int


# An assessment row attached by expand=assessments.
class Assessment(TypedDict):
    expand_assessment_year: int
    expand_assessment_value: int


# A row always has address and property_id. A field with no value for a home is left out of the row.
class AssessedHome(TypedDict, total=False):
    address: str
    property_id: str
    assessment_value: float
    property_taxes: float
    assessments: list[Assessment]


# /properties: one row per property.
class PropertiesAnswer(AnswerEnvelope):
    data: list[AssessedHome]
    result_total: int
    pagination: Pagination


address = " ".join(sys.argv[1:]) or "100 main calgary"

found: SearchAnswer = houski("search", query=address, max_results=1)
if not found["data"]:
    sys.exit("No property matched that address.")

# property_id_eq reads one property. expand attaches its assessment rows, one per year.
answer: PropertiesAnswer = houski(
    "properties",
    property_id_eq=found["data"][0]["property_id"],
    expand="assessments",
    select="assessment_value,property_taxes",
)

home: AssessedHome = answer["data"][0]
print(f"{home['address']}: assessed at {home.get('assessment_value', '(not known)')}, property taxes {home.get('property_taxes', '(not known)')}")
for assessment in sorted(home.get("assessments", []), key=lambda assessment: assessment["expand_assessment_year"]):
    print(f"  {assessment['expand_assessment_year']}: {assessment['expand_assessment_value']}")

print(f"Cost: {found['cost_cents'] + answer['cost_cents']} cents")
