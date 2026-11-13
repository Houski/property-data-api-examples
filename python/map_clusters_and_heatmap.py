"""Property map clusters and a price heatmap with the Houski property data API.

For one bounding box, prints the clusters a zoomed out map would draw, then
the cells of a heatmap shaded by median estimated list price.

Usage: python map_clusters_and_heatmap.py
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

# The north east and south west corners of the map view, here central Calgary.
BOUNDING_BOX = {"bbox_ne_lat": 51.10, "bbox_ne_lng": -113.90, "bbox_sw_lat": 50.90, "bbox_sw_lng": -114.20}


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


class Cluster(TypedDict):
    latitude: float
    longitude: float
    number_of_properties: int


class HeatmapCell(TypedDict, total=False):
    latitude: float
    longitude: float
    intensity: float
    number_of_properties: int
    aggregation_value: float


class MapData(TypedDict):
    properties: list[dict[str, Any]]
    clusters: list[Cluster]
    heatmap: list[HeatmapCell]


# /map: pins, clusters or heatmap cells, depending on the request.
class MapAnswer(AnswerEnvelope):
    data: MapData


# Clusters: at most ten, each with a centre and the number of properties in it.
clustered: MapAnswer = houski("map", cluster="true", property_type_eq="House", **BOUNDING_BOX)
for cluster in clustered["data"]["clusters"]:
    print(f"Cluster at {cluster['latitude']}, {cluster['longitude']}: {cluster['number_of_properties']} houses")

# Heatmap: one cell per patch of the box. aggregation_value is the median price
# of the cell, and intensity is that value scaled from 0 to 1 for shading.
heatmap: MapAnswer = houski(
    "map",
    heatmap="true",
    heatmap_aggregation_field="estimate_list_price",
    heatmap_aggregation_type="median",
    heatmap_cell_limit=100,
    **BOUNDING_BOX,
)
for cell in heatmap["data"]["heatmap"][:10]:
    print(f"Cell at {cell['latitude']}, {cell['longitude']}: median {cell.get('aggregation_value')}, intensity {cell['intensity']}")

print(f"Cost: {clustered['cost_cents'] + heatmap['cost_cents']} cents")
