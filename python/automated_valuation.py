"""Get an automated valuation of a home with the Houski property data API.

Finds a home by its address, quotes the valuation for free, and runs it only
when --yes is given, because a valuation costs $5.00. The valuation holds the
estimated sale price, list price and monthly rent, each with a confidence
score, plus warning flags and a link to a report.

Usage: python automated_valuation.py "100 main calgary"
       python automated_valuation.py "100 main calgary" --yes
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


# With no select, a row carries only address and property_id.
class FoundHome(TypedDict):
    address: str
    property_id: str


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[FoundHome]
    match_meta: list[MatchMeta]
    result_total: int


# One of the three valuations of a home.
class SingleValuation(TypedDict):
    value: float
    confidence_score: float


class WarningFlag(TypedDict):
    warning: str
    description: str


# The valuation itself. It holds more keys than these, such as the facts of the home, a price history and the area's scores.
class Valuation(TypedDict):
    property_id: str
    valuation_date: str
    estimate_sale_price: SingleValuation
    estimate_list_price: SingleValuation
    estimate_rent_monthly: SingleValuation
    property_warning_flags: list[WarningFlag]


# /avm: url is the link to the report of this valuation.
class AvmAnswer(AnswerEnvelope):
    data: Valuation
    url: str


arguments = [argument for argument in sys.argv[1:] if argument != "--yes"]
approved = "--yes" in sys.argv[1:]
address = " ".join(arguments) or "100 main calgary"

found: SearchAnswer = houski("search", query=address, max_results=1)
if not found["data"]:
    sys.exit("No property matched that address.")
home: FoundHome = found["data"][0]

# price_quote=true returns what the valuation would cost, and charges nothing.
quote: AvmAnswer = houski("avm", property_id=home["property_id"], price_quote="true")
print(f"A valuation of {home['address']} costs {quote['cost_cents']} cents.")

# Never run a valuation without the yes of the person who pays for it.
if not approved:
    sys.exit("Run again with --yes to buy the valuation.")

answer: AvmAnswer = houski("avm", property_id=home["property_id"])
valuation: Valuation = answer["data"]

print(f"Valued on {valuation['valuation_date']}")
for field in ["estimate_sale_price", "estimate_list_price", "estimate_rent_monthly"]:
    print(f"{field}: {valuation[field]['value']} (confidence {valuation[field]['confidence_score']})")
for flag in valuation["property_warning_flags"]:
    print(f"Warning, {flag['warning']}: {flag['description']}")
print(f"Report: {answer['url']}")
print(f"Cost: {answer['cost_cents']} cents")
