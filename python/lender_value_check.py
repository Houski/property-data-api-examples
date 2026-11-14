"""Check a home's value for a mortgage file with the Houski property data API.

Prints the estimated sale price beside the assessed value and the property
taxes, then two years of monthly value history for the same home.

Usage: python lender_value_check.py "100 main calgary"
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
class ValuedHome(TypedDict, total=False):
    address: str
    property_id: str
    estimate_sale_price: float
    assessment_value: float
    assessment_value_source: str
    property_taxes: float


# /search: the best matches first, with one match score per result in match_meta.
class SearchAnswer(AnswerEnvelope):
    data: list[ValuedHome]
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


address = " ".join(sys.argv[1:]) or "100 main calgary"

# Step 1: find the home and read its values. Money is in the currency of the
# property's country and is never converted. assessment_value_source says where
# the assessed value came from, often a link to the roll.
# exclude=inferred leaves out an assessed value or property taxes Houski worked out. estimate_sale_price
# has no source field, so it is untouched. Remove exclude to get the inferred values back.
found: SearchAnswer = houski(
    "search",
    query=address,
    max_results=1,
    select="estimate_sale_price,assessment_value,assessment_value_source,property_taxes",
    exclude="inferred",
)

if not found["data"]:
    sys.exit("No property matched that address, or Houski inferred both its assessed value and its property taxes.")

home: ValuedHome = found["data"][0]
print(f"Address: {home['address']}")
for field in ["estimate_sale_price", "assessment_value", "assessment_value_source", "property_taxes"]:
    print(f"{field}: {home.get(field, '(not known)')}")

# Step 2: the modelled sale value of that home for each of the last 24 months.
# /predict covers 2021-01-01 to today. It does not forecast.
history: PredictAnswer = houski("predict", property_id=home["property_id"], fields="estimate_sale_price", period="month", last=24)

predictions = sorted(history["data"][0]["predictions"], key=lambda prediction: prediction["date"])
for prediction in predictions:
    print(f"{prediction['date']}: {prediction.get('estimate_sale_price')}")

first, latest = predictions[0].get("estimate_sale_price"), predictions[-1].get("estimate_sale_price")
if first and latest:
    print(f"Change over the period: {(latest - first) / first:.1%}")

print(f"Cost: {found['cost_cents'] + history['cost_cents']} cents")
