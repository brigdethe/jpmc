from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fwclt_scoring.amenities_map import attach_osrm_distances, fetch_amenities_overpass, summarize_for_scoring
from fwclt_scoring.geo import GeocodeResult, geocode_address, normalize_geoid_for_merge, tract_from_lat_lon
from fwclt_scoring.scoring_engine import compute_scores
from fwclt_scoring.suggest import find_similar_tracts, find_top_tracts, score_all_tracts
from fwclt_scoring.tract_derive import merged_row_to_parcel_input

ROOT = Path(__file__).resolve().parent
FULL_PIPELINE_CSV = ROOT / "fort_worth_full_pipeline.csv"
MERGED_CSV = ROOT / "fort_worth_merged.csv"

FWCLT_FACTOR_NAMES = {
    1: "Neighborhood & Special Designations",
    2: "Nearby Amenities (Grocery, Pharmacy, Health Care, Conveniences)",
    3: "City Services (Roads, Utilities, Parks)",
    4: "Vacant Lots & Dilapidated Housing in the Area",
    5: "Site Safety, Lighting, Sidewalks & Walk Score",
    6: "Land Use (Zoning, Floodplain, Environmental, Negative Adjacencies)",
    7: "Construction & Development Cost Impacts",
    8: "Development Plans (Renovation, New Construction, Grading, Utilities)",
    9: "Community & Government Factors (Political Will, Neighborhood Sentiment)",
    10: "Displacement Risk & Gentrification Measures",
    11: "Neighborhood Strategy (Stability, Crime, Property Condition, Market Tier)",
    12: "Financial Projections & Project Pricing",
    13: "Investment Risk Assessment (Dealbreakers & Feasibility)",
}

app = FastAPI(title="FWCLT Acquisition Scorer API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

data_csv = FULL_PIPELINE_CSV if FULL_PIPELINE_CSV.exists() else MERGED_CSV
_df: pd.DataFrame | None = None
_scored: pd.DataFrame | None = None


def _load_df() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = pd.read_csv(str(data_csv), dtype={"GEOID": str})
        _df["GEOID"] = _df["GEOID"].apply(lambda x: normalize_geoid_for_merge(str(x)))
    return _df


def _load_scored() -> pd.DataFrame:
    global _scored
    if _scored is None:
        _scored = score_all_tracts(_load_df())
    return _scored


def _safe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _clean_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{k: _safe(v) for k, v in row.items()} for row in records]


class ScoreRequest(BaseModel):
    address: str
    parcel_type: str = "vacant"
    flood_zone: str = "none"
    brownfield: bool = False
    channel_city: bool = False
    channel_fannie: bool = False
    channel_institution: bool = False
    radius_m: int = 8000


@app.post("/api/score")
def score_property(req: ScoreRequest):
    addr = req.address.strip()
    use_coords = False
    lat_in, lon_in = None, None
    if "," in addr:
        parts = addr.split(",")
        if len(parts) == 2:
            try:
                lat_in = float(parts[0].strip())
                lon_in = float(parts[1].strip())
                if -90 <= lat_in <= 90 and -180 <= lon_in <= 180:
                    use_coords = True
            except ValueError:
                pass

    if use_coords:
        geo = GeocodeResult(address=addr, lat=lat_in, lon=lon_in, display_name=f"{lat_in}, {lon_in}", raw={})
    else:
        geo = geocode_address(addr)
        if geo is None:
            return {"error": "Could not geocode address. Try adding a ZIP code or use lat,lon coordinates."}

    tract = tract_from_lat_lon(geo.lat, geo.lon)
    if tract is None:
        return {"error": "Could not look up census tract. FCC API may be temporarily down."}

    geoid = normalize_geoid_for_merge(tract.tract_geoid)
    df = _load_df()
    row_series = df.loc[df["GEOID"] == geoid]
    merged_row = row_series.iloc[0].to_dict() if len(row_series) else None

    report = fetch_amenities_overpass(geo.lat, geo.lon, radius_m=req.radius_m)
    report = attach_osrm_distances(report)
    summary = summarize_for_scoring(report)
    summary["uses_osrm"] = not any("OSRM" in e for e in report.errors)

    parcel = merged_row_to_parcel_input(
        parcel_id="WEB-1",
        tract_geoid=geoid,
        display_name=geo.display_name,
        merged_row=merged_row,
        amenity_summary=summary,
        flood_zone=req.flood_zone,
        parcel_type=req.parcel_type,
        brownfield_flag=req.brownfield,
        channel_city=req.channel_city,
        channel_fannie=req.channel_fannie,
        channel_institution=req.channel_institution,
    )

    factors, scorecard, ladder = compute_scores(parcel, pass_threshold=50.0)

    factors_json = []
    for f in factors:
        factors_json.append({
            "id": f.factor_id,
            "name": FWCLT_FACTOR_NAMES.get(f.factor_id, f.label),
            "tier": f.tier_label,
            "weight_pct": round(f.weight_pct, 1),
            "score_0_20": f.numerical_0_20,
            "contribution": round(f.scorecard_contribution, 1),
            "confidence": f.confidence,
            "notes": (f.comments_evidence or f.why)[:300],
        })

    amenities_json = []
    for p in sorted(report.points, key=lambda x: x.straight_line_mi or 99)[:60]:
        dm = p.driving_m
        dmi = round(dm / 1609.344, 2) if dm is not None else None
        dmin = round(p.driving_min, 1) if p.driving_min is not None else None
        amenities_json.append({
            "name": p.name,
            "kind": p.kind,
            "lat": p.lat,
            "lon": p.lon,
            "distance_miles": dmi or _safe(p.straight_line_mi),
            "drive_minutes": dmin,
            "route_geometry": p.route_geometry,
        })

    clean_summary = {k: _safe(v) for k, v in summary.items()}

    scored_df = _load_scored()
    similar = find_similar_tracts(scored_df, geoid, scorecard.composite_0_100, score_range=12.0, max_results=6)
    similar_json = _clean_records(similar.to_dict("records"))

    tract_data = None
    if merged_row:
        tract_data = {k: _safe(v) for k, v in merged_row.items()}

    return {
        "composite_score": scorecard.composite_0_100,
        "letter_grade": scorecard.letter,
        "opportunity_label": scorecard.opportunity_label,
        "pass_fail": scorecard.pass_fail,
        "hard_excluded": scorecard.hard_excluded,
        "exclusion_reason": scorecard.exclusion_reason,
        "channel_bonus": scorecard.channel_bonus,
        "ladder_score": ladder.scaled_0_100,
        "address": geo.display_name,
        "lat": geo.lat,
        "lon": geo.lon,
        "tract_geoid": geoid,
        "factors": factors_json,
        "amenities": amenities_json,
        "amenity_summary": clean_summary,
        "similar_tracts": similar_json,
        "tract_data": tract_data,
        "errors": report.errors,
    }


@app.get("/api/suggestions")
def get_suggestions(top: int = Query(12, ge=1, le=50)):
    scored = _load_scored()
    result = find_top_tracts(scored, min_score=60.0, max_results=top)
    return _clean_records(result.to_dict("records"))


@app.get("/api/tract/{geoid}")
def get_tract(geoid: str):
    df = _load_df()
    normalized = normalize_geoid_for_merge(geoid)
    rows = df.loc[df["GEOID"] == normalized]
    if len(rows) == 0:
        return {"error": f"GEOID {normalized} not found"}
    row = rows.iloc[0].to_dict()
    return {k: _safe(v) for k, v in row.items()}
