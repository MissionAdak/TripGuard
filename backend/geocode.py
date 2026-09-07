import json
import urllib.parse
import urllib.request
from typing import Optional, Tuple

CITY_COORDS: dict[str, Tuple[float, float]] = {
    "mumbai": (19.076, 72.8777),
    "bom": (19.0896, 72.8656),
    "delhi": (28.6139, 77.209),
    "new delhi": (28.6139, 77.209),
    "del": (28.5562, 77.1),
    "jaipur": (26.9124, 75.7873),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "blr": (13.1986, 77.7066),
    "hyderabad": (17.385, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "goa": (15.2993, 74.124),
    "ahmedabad": (23.0225, 72.5714),
    "london": (51.5074, -0.1278),
    "paris": (48.8566, 2.3522),
    "dubai": (25.2048, 55.2708),
    "singapore": (1.3521, 103.8198),
    "new york": (40.7128, -74.006),
    "nyc": (40.6413, -73.7781),
}


def _lookup_known(query: str) -> Optional[Tuple[float, float]]:
    q = query.lower()
    for key, coords in CITY_COORDS.items():
        if key in q:
            return coords
    return None


def geocode_location(query: str) -> Optional[Tuple[float, float]]:
    if not query or not query.strip():
        return None

    known = _lookup_known(query)
    if known:
        return known

    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "TripGuard/1.0 (itinerary-map)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return known
    return None
