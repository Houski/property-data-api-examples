"""List the countries, provinces or states, and cities the Houski property data API covers.

Places are never written into code. /location returns the ones that hold
data, so menus and validation stay right as coverage grows. This program
prints every country, then the provinces or states of one country, then the
first cities of one province or state.

Usage: python list_countries_provinces_and_cities.py ca ab
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


country = sys.argv[1] if len(sys.argv) > 1 else "ca"
province = sys.argv[2] if len(sys.argv) > 2 else "ab"

# resolution says which level to list. flat=true returns a plain list instead of a nested tree.
countries: LocationAnswer = houski("location", resolution="country", flat="true")
print("Countries:")
for place in countries["data"]["flat"]:
    print(f"  {place.get('country')} ({place.get('country_abbreviation')})")

# Each level needs every level above it, so provinces need their country.
provinces: LocationAnswer = houski("location", resolution="province", flat="true", country_abbreviation=country)
print(f"Provinces or states of {country}:")
for place in provinces["data"]["flat"]:
    print(f"  {place.get('province')} ({place.get('province_abbreviation')})")

# /location has no paging, so always scope it. The slug of a city works as the city value of other requests.
cities: LocationAnswer = houski("location", resolution="city", flat="true", country_abbreviation=country, province_abbreviation=province)
print(f"{cities['result_total']} cities in {province}. The first ten:")
for place in cities["data"]["flat"][:10]:
    print(f"  {place.get('city')} (city={place.get('city_slug')})")

print(f"Cost: {countries['cost_cents'] + provinces['cost_cents'] + cities['cost_cents']} cents")
