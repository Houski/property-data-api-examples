"""Median home price and home count by community with the Houski property data API.

Reads the communities of a city from /location, then asks /aggregate for the
median estimated list price and the number of houses in each one, all in a
single batched request.

Usage: python market_statistics_by_community.py ca ab calgary
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


# /location with flat=true: one entry per place. Keys of levels below the resolution are absent.
class FlatLocation(TypedDict, total=False):
    country: str
    country_abbreviation: str
    province: str
    province_abbreviation: str
    city: str
    city_slug: str
    community: str
    community_slug: str


class LocationData(TypedDict):
    flat: list[FlatLocation]


class LocationAnswer(AnswerEnvelope):
    data: LocationData
    result_total: int


country, province, city = (sys.argv[1:4] + ["ca", "ab", "calgary"][len(sys.argv) - 1 :])[:3]
place = {"country_abbreviation": country, "province_abbreviation": province, "city": city}

# Step 1: the communities of the city. Places always come from /location, never
# from a list written into the code.
locations: LocationAnswer = houski("location", resolution="community", flat="true", **place)
communities = [location["community"] for location in locations["data"]["flat"] if location.get("community")][:5]

# Step 2: two statistics per community in one request. In a batch, every
# parameter carries the agg0_, agg1_ prefix of the statistic it belongs to,
# numbered from 0 with no gaps.
parameters = {}
for index, community in enumerate(communities):
    for number, (field, aggregation) in enumerate([("estimate_list_price", "median"), ("property_id", "count")]):
        prefix = f"agg{index * 2 + number}_"
        for name, value in place.items():
            parameters[prefix + name] = value
        parameters[prefix + "community_eq"] = community
        parameters[prefix + "property_type_eq"] = "House"
        parameters[prefix + "field"] = field
        parameters[prefix + "aggregation"] = aggregation

statistics: AggregateAnswer = houski("aggregate", **parameters)

# The answers come back in the order they were asked, and every value is a string.
for index, community in enumerate(communities):
    median, count = statistics["data"][index * 2], statistics["data"][index * 2 + 1]
    print(f"{community}: median estimated list price {median['value']}, {count['value']} houses")

print(f"Cost: {locations['cost_cents'] + statistics['cost_cents']} cents")
