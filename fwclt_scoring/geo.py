"""Geocoding and census tract lookup (FCC) for Fort Worth / DFW sites."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from geopy.geocoders import Nominatim
from geopy.location import Location


@dataclass
class GeocodeResult:
    address: str
    lat: float
    lon: float
    display_name: str
    raw: dict[str, Any]


@dataclass
class TractLookupResult:
    tract_geoid: str
    county_fips: str
    state_fips: str
    block_fips: str
    raw: dict[str, Any]


def geocode_address(address: str, *, user_agent: str = "fwclt-property-scorer/1.0") -> GeocodeResult | None:
    """Forward geocode with Nominatim (OpenStreetMap). Rate-limit friendly: one call per user action."""
    q = address.strip()
    if not q:
        return None
    if "fort worth" not in q.lower() and "tx" not in q.lower() and "texas" not in q.lower():
        q = f"{q}, Fort Worth, Texas"
    geolocator = Nominatim(user_agent=user_agent, timeout=15)
    loc: Location | None = geolocator.geocode(q)
    if loc is None:
        return None
    raw = getattr(loc, "raw", {}) or {}
    return GeocodeResult(
        address=q,
        lat=float(loc.latitude),
        lon=float(loc.longitude),
        display_name=str(loc.address or q),
        raw=raw if isinstance(raw, dict) else {},
    )


def tract_from_lat_lon(lat: float, lon: float) -> TractLookupResult | None:
    """
    Census block → tract GEOID (11 digits) via FCC Census Block API.
    https://geo.fcc.gov/api/census/block/find
    """
    url = "https://geo.fcc.gov/api/census/block/find?" + urlencode(
        {"latitude": lat, "longitude": lon, "format": "json", "showall": "false"}
    )
    req = Request(url, headers={"User-Agent": "fwclt-property-scorer/1.0"})
    try:
        with urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    block = payload.get("Block") or {}
    fips = str(block.get("FIPS") or "").strip()
    if len(fips) < 11:
        return None
    tract_geoid = fips[:11]
    return TractLookupResult(
        tract_geoid=tract_geoid,
        county_fips=fips[2:5] if len(fips) >= 5 else "",
        state_fips=fips[:2] if len(fips) >= 2 else "",
        block_fips=fips,
        raw=payload,
    )


def normalize_geoid_for_merge(geoid: str) -> str:
    """Match pandas GEOID column (may be int-like string without leading zeros)."""
    g = str(geoid).strip().replace(".0", "")
    if g.isdigit() and len(g) < 11:
        g = g.zfill(11)
    return g
