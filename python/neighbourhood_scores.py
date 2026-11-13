"""Get the neighbourhood scores of an address with the Houski property data API.

Prints how the area around a home rates for walkability, transit, schools,
safety and quiet. Each score runs from 0 to 10 and higher is always better.

Usage: python neighbourhood_scores.py "100 main calgary"
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


SCORES = ["score_total", "score_walkability", "score_transit", "score_education", "score_safety", "score_quiet"]


# A row always has address and property_id. A field with no value for a home is left out of the row.
class ScoredHome(TypedDict, total=False):
    address: str
    property_id: str
    score_total: float
    score_walkability: float
    score_transit: float
    score_education: float
    score_safety: float
    score_quiet: float


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[ScoredHome]
    match_meta: list[MatchMeta]
    result_total: int


address = " ".join(sys.argv[1:]) or "100 main calgary"

answer: SearchAnswer = houski("search", query=address, max_results=1, select=",".join(SCORES))

if not answer["data"]:
    sys.exit("No property matched that address.")

home: ScoredHome = answer["data"][0]
print(f"Address: {home['address']}")
for score in SCORES:
    print(f"{score}: {home.get(score, '(not known)')} out of 10")

print(f"Cost: {answer['cost_cents']} cents")
