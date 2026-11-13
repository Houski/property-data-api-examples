"""Count homes and find the median price inside a polygon with the Houski property data API.

Draw any area as a list of points, such as a sales territory, a flood zone or
a school catchment, and /aggregate answers for the homes inside it.

Usage: python statistics_inside_a_polygon.py
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


class Statistic(TypedDict):
    field: str
    aggregation: str
    value: str


# /aggregate: one entry per statistic, in the order asked. Every value is a string.
class AggregateAnswer(AnswerEnvelope):
    data: list[Statistic]


# The corners of the area as (latitude, longitude), here a few blocks of central Calgary. At most 100 points.
CORNERS = [(51.050, -114.090), (51.050, -114.050), (51.030, -114.050), (51.030, -114.090)]

# A polygon is written lat_lng,lat_lng,lat_lng with an underscore inside each point and commas between points.
polygon = ",".join(f"{latitude}_{longitude}" for latitude, longitude in CORNERS)

# Two statistics in one request. In a batch, every parameter carries the agg0_, agg1_
# prefix of its statistic. Only polygon and price_quote stay bare.
answer: AggregateAnswer = houski(
    "aggregate",
    polygon=polygon,
    agg0_field="property_id",
    agg0_aggregation="count",
    agg1_field="estimate_list_price",
    agg1_aggregation="median",
)

count, median = answer["data"][0], answer["data"][1]
print(f"Homes inside the polygon: {count['value']}")
print(f"Median estimated list price: {median['value']}")
print(f"Cost: {answer['cost_cents']} cents")
