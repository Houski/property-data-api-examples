"""Address autocomplete with the Houski property data API.

Prints address suggestions for a partly typed address, best match first. Call
this from your own server as the visitor types, so the API key never reaches
the browser.

Usage: python address_autocomplete.py "100 main cal"
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


# A row always has address and property_id. A field with no value for a home is left out of the row.
class AddressSuggestion(TypedDict, total=False):
    address: str
    property_id: str


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[AddressSuggestion]
    match_meta: list[MatchMeta]
    result_total: int


def suggest_addresses(typed_text, country_abbreviation=None):
    """Return up to five suggestions as (address, property_id, match score)."""
    parameters = {"query": typed_text, "max_results": 5}
    if country_abbreviation:
        parameters["country_abbreviation"] = country_abbreviation

    # With no select, a result carries only address and property_id, the least expensive answer.
    answer: SearchAnswer = houski("search", **parameters)

    # match_meta holds one match score per result, keyed by property_id.
    scores = {meta["property_id"]: meta["match_value"] for meta in answer["match_meta"]}
    return [(home["address"], home["property_id"], scores.get(home["property_id"])) for home in answer["data"]]


typed_text = " ".join(sys.argv[1:]) or "100 main cal"

for address, property_id, score in suggest_addresses(typed_text):
    print(f"{address}  (property_id {property_id}, match {score})")
