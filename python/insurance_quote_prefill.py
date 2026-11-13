"""Pre-fill an insurance quote form from an address with the Houski property data API.

One request returns the facts an insurer asks a home owner for: property type,
construction year, floor area, roof material, and the flood and fire scores of
the area. Each score runs from 0 to 10 and higher is better, so a high
score_flood means the area floods less often.

Usage: python insurance_quote_prefill.py "100 main calgary"
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

QUOTE_FORM_FIELDS = ["property_type", "construction_year", "interior_sq_m", "roof_material", "score_flood", "score_fire"]


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
class QuoteFormHome(TypedDict, total=False):
    address: str
    property_id: str
    property_type: str
    construction_year: int
    interior_sq_m: float
    roof_material: str
    score_flood: float
    score_fire: float


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[QuoteFormHome]
    match_meta: list[MatchMeta]
    result_total: int


address = " ".join(sys.argv[1:]) or "100 main calgary"

answer: SearchAnswer = houski("search", query=address, max_results=1, select=",".join(QUOTE_FORM_FIELDS))

if not answer["data"]:
    sys.exit("No property matched that address.")

home: QuoteFormHome = answer["data"][0]
print(f"Address: {home['address']}")

# A field with no value for this home is left out of the row. Leave that form box
# empty for the applicant to fill in.
for field in QUOTE_FORM_FIELDS:
    print(f"{field}: {home.get(field, '(not known, ask the applicant)')}")

print(f"Cost: {answer['cost_cents']} cents")
