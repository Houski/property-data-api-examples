"""Check that a Houski API key works.

Calls /auth, which says whether the key exists and is enabled. It is free, so
it is the right first request to make with a new key.

Usage: python check_api_key.py
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


# /auth: the one answer with no cost, since it is never billed.
class AuthAnswer(TypedDict):
    api_key_authorized: bool
    error: str
    time_ms: int


answer: AuthAnswer = houski("auth")

if not answer["api_key_authorized"]:
    sys.exit(f"The key was refused: {answer['error']}")

print("The key works.")
