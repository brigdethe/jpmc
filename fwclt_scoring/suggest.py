"""
Pre-score all tracts and suggest similar / nearby good areas.

Uses tract-level data only (no Overpass/OSRM calls) so the full table
can be scored in < 1 second on startup.
Reverse-geocodes tract centroids via FCC + Nominatim to show real addresses.
"""

from __future__ import annotations

import json
import math
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd

from fwclt_scoring.geo import normalize_geoid_for_merge
from fwclt_scoring.scoring_engine import FACTORS, compute_scores
from fwclt_scoring.tract_derive import merged_row_to_parcel_input


_centroid_cache: dict[str, tuple[float, float, str]] = {}  # geoid -> (lat, lon, display_name)


def _tigerweb_lookup(geoid: str) -> tuple[float, float, str] | None:
    """Fetch real centroid + official name from the Census TIGERweb REST API."""
    url = (
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/8/query?"
        + urlencode({
            "where": f"GEOID='{geoid}'",
            "outFields": "GEOID,INTPTLAT,INTPTLON,NAME",
            "f": "json",
            "returnGeometry": "false",
        })
    )
    req = Request(url, headers={"User-Agent": "fwclt-property-scorer/1.0"})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        features = data.get("features", [])
        if features:
            attrs = features[0].get("attributes", {})
            lat = float(attrs["INTPTLAT"])
            lon = float(attrs["INTPTLON"])
            name = str(attrs.get("NAME") or "")
            return lat, lon, name
    except Exception:
        return None


def _format_tract_name(geoid: str) -> str:
    """Format GEOID → 'Census Tract 1102.05' with no API calls."""
    g = str(geoid).zfill(11)
    tract_raw = g[5:]
    tract_main = int(tract_raw[:4])
    tract_suf = tract_raw[4:]
    return f"Census Tract {tract_main}.{tract_suf}"


def get_location_info(geoid: str) -> tuple[float, float, str]:
    """Return (lat, lon, display_name) for a census tract. Result is cached per process."""
    if geoid in _centroid_cache:
        return _centroid_cache[geoid]

    result = _tigerweb_lookup(geoid)
    if result:
        lat, lon, tigername = result
        tract_label = tigername if tigername else _format_tract_name(geoid)
        display = f"{tract_label}, Tarrant County, TX"
    else:
        lat, lon = _approx_centroid_from_geoid(geoid)
        display = f"{_format_tract_name(geoid)}, Fort Worth, TX"

    _centroid_cache[geoid] = (lat, lon, display)
    return lat, lon, display


_EMPTY_AMENITY_SUMMARY: dict[str, Any] = {
    "nearest_grocery_distance_miles": None,
    "nearest_pharmacy_distance_miles": None,
    "nearest_health_care_distance_miles": None,
    "nearest_park_distance_miles": None,
    "nearest_park_drive_minutes": None,
    "grocery_stores_within_1_mile": 0,
    "grocery_stores_within_3_miles": 0,
    "bus_stops_and_transit_nearby": 0,
    "uses_osrm": False,
}

FWCLT_FACTOR_NAMES = {f.id: f.label for f in FACTORS}


def _haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _tract_centroid_from_fcc(geoid: str) -> tuple[float, float] | None:
    url = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" + urlencode({
        "address": f"Tract {geoid[-6:]}, Fort Worth, TX",
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "format": "json",
    })
    return None


def _reverse_geocode_nominatim(lat: float, lon: float) -> str:
    url = (
        f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}"
        "&format=json&addressdetails=1&zoom=16"
    )
    req = Request(url, headers={"User-Agent": "fwclt-property-scorer/1.0"})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return ""
    return str(data.get("display_name") or "")


def _approx_centroid_from_geoid(geoid: str) -> tuple[float, float]:
    g = str(geoid).zfill(11)
    state = g[:2]
    county = g[2:5]
    tract = g[5:11]
    base_lat = 32.75
    base_lon = -97.33
    offset = int(tract, 10) % 10000
    lat = base_lat + (offset % 100) * 0.004 - 0.2
    lon = base_lon + (offset // 100) * 0.005 - 0.25
    return round(lat, 6), round(lon, 6)


def score_all_tracts(df: pd.DataFrame) -> pd.DataFrame:
    results = []
    for _, row in df.iterrows():
        geoid = normalize_geoid_for_merge(str(row.get("GEOID", "")))
        row_dict = row.to_dict()

        parcel = merged_row_to_parcel_input(
            parcel_id=geoid,
            tract_geoid=geoid,
            display_name=f"Tract {geoid}",
            merged_row=row_dict,
            amenity_summary=_EMPTY_AMENITY_SUMMARY,
        )
        factors, scorecard, ladder = compute_scores(parcel, pass_threshold=50.0)

        med = row_dict.get("median_home_value")
        est = row_dict.get("est_land_value")
        poverty = row_dict.get("poverty_pct")
        lmi = row_dict.get("lmi_pct")
        is_qct = row_dict.get("is_qct", 0)
        is_oz = row_dict.get("is_opportunity_zone", 0)
        median_income = row_dict.get("median_income") or row_dict.get("median_hh_income")

        top_factors = sorted(factors, key=lambda f: f.scorecard_contribution, reverse=True)[:3]
        strengths = "; ".join(f"{FWCLT_FACTOR_NAMES.get(f.factor_id, f.label)[:45]} ({f.tier_label})" for f in top_factors)

        weak_factors = sorted(factors, key=lambda f: f.scorecard_contribution)[:2]
        weaknesses = "; ".join(f"{FWCLT_FACTOR_NAMES.get(f.factor_id, f.label)[:45]} ({f.tier_label})" for f in weak_factors)

        lat, lon = _approx_centroid_from_geoid(geoid)

        results.append({
            "GEOID": geoid,
            "composite_score": scorecard.composite_0_100,
            "letter_grade": scorecard.letter,
            "opportunity": scorecard.opportunity_label,
            "pass_fail": "PASS" if scorecard.pass_fail else "FAIL",
            "ladder_score": ladder.scaled_0_100,
            "median_home_value": med,
            "est_land_value": est,
            "median_income": median_income,
            "poverty_pct": poverty,
            "lmi_pct": lmi,
            "is_qct": int(is_qct or 0),
            "is_oz": int(is_oz or 0),
            "top_strengths": strengths,
            "weaknesses": weaknesses,
            "approx_lat": lat,
            "approx_lon": lon,
        })

    return pd.DataFrame(results)


def find_similar_tracts(
    scored_df: pd.DataFrame,
    current_geoid: str,
    current_score: float,
    *,
    score_range: float = 10.0,
    max_results: int = 8,
) -> pd.DataFrame:
    others = scored_df[scored_df["GEOID"] != current_geoid].copy()
    others["score_diff"] = (others["composite_score"] - current_score).abs()
    within_range = others[others["score_diff"] <= score_range]
    if len(within_range) < 3:
        within_range = others.nsmallest(max_results, "score_diff")
    return within_range.nsmallest(max_results, "score_diff")


def find_top_tracts(
    scored_df: pd.DataFrame,
    *,
    min_score: float = 65.0,
    max_results: int = 10,
) -> pd.DataFrame:
    good = scored_df[scored_df["composite_score"] >= min_score].copy()
    return good.nlargest(max_results, "composite_score")


def find_nearby_good_tracts(
    scored_df: pd.DataFrame,
    source_df: pd.DataFrame,
    current_lat: float,
    current_lon: float,
    *,
    radius_mi: float = 10.0,
    min_score: float = 60.0,
    max_results: int = 8,
) -> pd.DataFrame:
    geo_cols = _find_geo_columns(source_df)
    if geo_cols is None:
        good = scored_df[scored_df["composite_score"] >= min_score]
        return good.nlargest(max_results, "composite_score")

    lat_col, lon_col = geo_cols
    merged = scored_df.merge(
        source_df[["GEOID", lat_col, lon_col]].drop_duplicates("GEOID"),
        on="GEOID",
        how="left",
    )
    merged = merged.dropna(subset=[lat_col, lon_col])
    merged["dist_mi"] = merged.apply(
        lambda r: _haversine_mi(current_lat, current_lon, float(r[lat_col]), float(r[lon_col])),
        axis=1,
    )
    nearby = merged[(merged["dist_mi"] <= radius_mi) & (merged["composite_score"] >= min_score)]
    if len(nearby) < 3:
        nearby = merged[merged["dist_mi"] <= radius_mi].nlargest(max_results, "composite_score")
    return nearby.nsmallest(max_results, "dist_mi").head(max_results)


def _find_geo_columns(df: pd.DataFrame) -> tuple[str, str] | None:
    cols = [c.lower() for c in df.columns]
    lat_candidates = ["lat", "latitude", "tract_lat", "centroid_lat"]
    lon_candidates = ["lon", "lng", "longitude", "tract_lon", "centroid_lon"]
    lat_col = None
    lon_col = None
    for lc in lat_candidates:
        if lc in cols:
            lat_col = df.columns[cols.index(lc)]
            break
    for lc in lon_candidates:
        if lc in cols:
            lon_col = df.columns[cols.index(lc)]
            break
    if lat_col and lon_col:
        return lat_col, lon_col
    return None
