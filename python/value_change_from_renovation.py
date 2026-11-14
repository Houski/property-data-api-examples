"""Estimate how a renovation changes a home's value with the Houski property data API.

Finds a home by its address, then asks /predict for its estimated sale price
twice: as it is, and with one more bedroom. Other facts can be overridden the
same way, such as bathroom_full, interior_sq_m and construction_year.

Usage: python value_change_from_renovation.py "100 main calgary"
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
class HomeAsItIs(TypedDict, total=False):
    address: str
    property_id: str
    bedroom: int


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[HomeAsItIs]
    match_meta: list[MatchMeta]
    result_total: int


class Prediction(TypedDict, total=False):
    date: str
    estimate_sale_price: float
    estimate_list_price: float
    estimate_rent_monthly: float


class PropertyPredictions(TypedDict):
    property_id: str
    predictions: list[Prediction]


# /predict: one entry per property, each with one prediction per date.
class PredictAnswer(AnswerEnvelope):
    data: list[PropertyPredictions]
    result_total: int


def latest_sale_price(answer: PredictAnswer):
    """The estimated sale price of the most recent date in the answer."""
    predictions = sorted(answer["data"][0]["predictions"], key=lambda prediction: prediction["date"])
    return predictions[-1].get("estimate_sale_price")


address = " ".join(sys.argv[1:]) or "100 main calgary"

# exclude=inferred is left off here: /predict values the home by its bedroom count whether stated or
# worked out, so the example needs a count for every home.
found: SearchAnswer = houski("search", query=address, max_results=1, select="bedroom")
if not found["data"]:
    sys.exit("No property matched that address.")
home: HomeAsItIs = found["data"][0]
bedrooms = home.get("bedroom")
if bedrooms is None:
    sys.exit("The number of bedrooms of that home is not known.")

as_it_is: PredictAnswer = houski("predict", property_id=home["property_id"], fields="estimate_sale_price", period="month", last=1)

# An override is passed by its bare field name. Here the same home is valued with one more bedroom.
renovated: PredictAnswer = houski("predict", property_id=home["property_id"], fields="estimate_sale_price", period="month", last=1, bedroom=bedrooms + 1)

before, after = latest_sale_price(as_it_is), latest_sale_price(renovated)
print(f"{home['address']} with {bedrooms} bedrooms: {before}")
print(f"The same home with {bedrooms + 1} bedrooms: {after}")
if before and after:
    print(f"Difference: {after - before}")

print(f"Cost: {found['cost_cents'] + as_it_is['cost_cents'] + renovated['cost_cents']} cents")
