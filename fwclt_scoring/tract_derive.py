"""Build ParcelInput from tract-level data + amenity summaries.

Supports both fort_worth_merged.csv (old column names with _pct_ami suffix)
and fort_worth_full_pipeline.csv (new names with _ami suffix + extra columns).
"""

from __future__ import annotations

import math
from typing import Any

from fwclt_scoring.scoring_engine import ParcelInput


def _sf(x: Any) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def _col(row: dict[str, Any], *keys: str) -> float | None:
    for k in keys:
        v = _sf(row.get(k))
        if v is not None:
            return v
    return None


def price_band_from_median(median_home: float | None) -> str:
    if median_home is None:
        return ""
    if median_home <= 200_000:
        return "160k_200k"
    if median_home <= 250_000:
        return "200k_250k"
    if median_home <= 300_000:
        return "250k_300k"
    return "300k_plus"


def _am(s: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        v = s.get(k)
        if v is not None:
            return v
    return None


def tier_amenities(summary: dict[str, Any]) -> str:
    g1 = int(_am(summary, "grocery_stores_within_1_mile", "grocery_within_1mi") or 0)
    g3 = int(_am(summary, "grocery_stores_within_3_miles", "grocery_within_3mi") or 0)
    ng = _am(summary, "nearest_grocery_distance_miles", "nearest_grocery_drive_mi")
    if g1 >= 1 or (ng is not None and ng <= 1.0):
        return "High"
    if g3 >= 2 or (ng is not None and ng <= 3.0):
        return "Baseline"
    return "Low"


def tier_parks(summary: dict[str, Any]) -> str:
    pm = _am(summary, "nearest_park_drive_minutes", "nearest_park_drive_min")
    dmi = _am(summary, "nearest_park_distance_miles", "nearest_park_drive_mi")
    if pm is not None and pm <= 10:
        return "High"
    if dmi is not None and dmi <= 1.25:
        return "High"
    if pm is not None and pm <= 18:
        return "Baseline"
    if dmi is not None and dmi <= 3.0:
        return "Baseline"
    return "Low"


def tier_walk_transit(summary: dict[str, Any]) -> str:
    t = int(_am(summary, "bus_stops_and_transit_nearby", "transit_stops_nearby") or 0)
    g = _am(summary, "nearest_grocery_distance_miles", "nearest_grocery_drive_mi")
    if t >= 5 and g is not None and g <= 2.0:
        return "High"
    if t >= 2 or (g is not None and g <= 3.0):
        return "Baseline"
    return "Low"


def tier_neighborhood_designations(row: dict[str, Any]) -> str:
    is_qct = _sf(row.get("is_qct"))
    is_oz = _sf(row.get("is_opportunity_zone"))
    if (is_qct and is_qct > 0) or (is_oz and is_oz > 0):
        return "High"
    poverty = _sf(row.get("poverty_pct"))
    if poverty is not None and poverty >= 25:
        return "High"
    return "Baseline"


def tier_vacant_blight(row: dict[str, Any]) -> str:
    vac = _sf(row.get("vacant_lot_pct"))
    if vac is not None:
        if vac <= 5:
            return "High"
        if vac <= 15:
            return "Baseline"
        return "Low"
    return "Baseline"


def tier_displacement(row: dict[str, Any]) -> str:
    lmi = _col(row, "lmi_pct")
    med = _col(row, "median_home_value")
    poverty = _col(row, "poverty_pct")
    if lmi is not None and lmi >= 58:
        return "High"
    if poverty is not None and poverty >= 30:
        return "High"
    if med is not None and med >= 280_000 and (lmi is None or lmi < 42):
        return "Low"
    return "Baseline"


def tier_neighborhood_strategy(row: dict[str, Any]) -> str:
    med = _col(row, "median_home_value")
    lmi = _col(row, "lmi_pct")
    poverty = _col(row, "poverty_pct")
    unemployment = _col(row, "unemployment_pct")
    if med is not None and med <= 200_000 and lmi is not None and lmi >= 45:
        return "High"
    if med is not None and med > 300_000:
        return "Low"
    if unemployment is not None and unemployment >= 15:
        return "High"
    if med is not None and 200_000 < med <= 300_000:
        return "Baseline"
    if lmi is not None and lmi < 35 and (poverty is None or poverty < 10):
        return "Low"
    return "Baseline"


def tier_financial_projections(row: dict[str, Any]) -> str:
    med = _col(row, "median_home_value")
    hh80 = _col(row, "hh_at_80pct_ami")
    b80 = _col(row, "cost_burdened_80ami", "cost_burdened_80pct_ami")
    ratio = (b80 / hh80) if hh80 and hh80 > 0 and b80 is not None else None
    est_land = _col(row, "est_land_value")
    if med is not None and med <= 220_000:
        if ratio is not None and ratio >= 0.35:
            return "High"
        if est_land is not None and est_land <= 50_000:
            return "High"
    if med is not None and med > 320_000:
        return "Low"
    return "Baseline"


def tier_ami_burden(row: dict[str, Any]) -> str:
    hh50 = _col(row, "hh_at_50pct_ami")
    b50 = _col(row, "cost_burdened_50ami", "cost_burdened_50pct_ami")
    ratio = (b50 / hh50) if hh50 and hh50 > 0 and b50 is not None else None
    if ratio is not None and ratio >= 0.45:
        return "High"
    if ratio is not None and ratio <= 0.22:
        return "Low"
    return "Baseline"


def tier_construction_cost(row: dict[str, Any]) -> str:
    y = _col(row, "median_year_built")
    if y is None:
        return "Baseline"
    if y >= 1995:
        return "High"
    if y >= 1975:
        return "Baseline"
    return "Low"


def tier_investment_risk(
    flood_zone: str,
    brownfield: bool,
    summary: dict[str, Any],
    row: dict[str, Any],
) -> str:
    if flood_zone == "floodway_critical":
        return "Low"
    flood_pct = _sf(row.get("flood_zone_pct"))
    if flood_pct is not None and flood_pct > 40:
        return "Low"
    if flood_zone == "100yr" or brownfield:
        return "Baseline"
    med = _col(row, "median_home_value")
    g = _am(summary, "nearest_grocery_distance_miles", "nearest_grocery_drive_mi")
    if med is not None and med > 350_000:
        return "Baseline"
    if g is not None and g > 4.0:
        return "Baseline"
    return "High"


def tier_land_use(flood_zone: str, brownfield: bool, row: dict[str, Any] | None = None) -> str:
    if flood_zone == "floodway_critical":
        return "Low"
    flood_pct = _sf((row or {}).get("flood_zone_pct"))
    if flood_pct is not None and flood_pct > 40:
        return "Low"
    if flood_zone in ("100yr", "500yr"):
        return "Baseline"
    if brownfield:
        return "Baseline"
    return "High"


def tier_site_safety(row: dict[str, Any]) -> str:
    obesity = _col(row, "pct_obesity")
    diabetes = _col(row, "pct_diabetes")
    health_risk = False
    if obesity is not None and obesity > 40:
        health_risk = True
    if diabetes is not None and diabetes > 15:
        health_risk = True
    if health_risk:
        return "Low"
    if obesity is not None and obesity < 28 and diabetes is not None and diabetes < 9:
        return "High"
    return "Baseline"


def build_factor_comments(
    tract_geoid: str,
    row: dict[str, Any],
    summary: dict[str, Any],
    display_name: str,
) -> dict[int, str]:
    med = _col(row, "median_home_value")
    lmi = _col(row, "lmi_pct")
    poverty = _col(row, "poverty_pct")
    unemp = _col(row, "unemployment_pct")
    est = _col(row, "est_land_value")
    is_qct = _sf(row.get("is_qct"))
    is_oz = _sf(row.get("is_opportunity_zone"))

    parts = [f"Tract {tract_geoid}", f"Site: {display_name[:100]}"]
    if med is not None:
        parts.append(f"Median home value ~${med:,.0f}")
    if est is not None:
        parts.append(f"Est. land value ~${est:,.0f}")
    if lmi is not None:
        parts.append(f"LMI population {lmi:.1f}%")
    if poverty is not None:
        parts.append(f"Poverty rate {poverty:.1f}%")
    if unemp is not None:
        parts.append(f"Unemployment {unemp:.1f}%")
    if is_qct and is_qct > 0:
        parts.append("Qualified Census Tract (QCT)")
    if is_oz and is_oz > 0:
        parts.append("Opportunity Zone")

    g = _am(summary, "nearest_grocery_distance_miles")
    p = _am(summary, "nearest_pharmacy_distance_miles")
    pk = _am(summary, "nearest_park_distance_miles")
    if g is not None:
        parts.append(f"Nearest grocery ~{g} mi")
    if p is not None:
        parts.append(f"Nearest pharmacy ~{p} mi")
    if pk is not None:
        parts.append(f"Nearest park ~{pk} mi")

    line = "; ".join(parts)
    return {1: line, 2: line, 3: line, 10: line, 11: line, 12: line}


def merged_row_to_parcel_input(
    *,
    parcel_id: str,
    tract_geoid: str,
    display_name: str,
    merged_row: dict[str, Any] | None,
    amenity_summary: dict[str, Any],
    flood_zone: str = "none",
    parcel_type: str = "vacant",
    brownfield_flag: bool = False,
    channel_city: bool = False,
    channel_fannie: bool = False,
    channel_institution: bool = False,
    assessed_value_yoy_pct: float | None = None,
    crime_tract_percentile: float | None = None,
) -> ParcelInput:
    fz_ok = ("none", "500yr", "100yr", "floodway_critical")
    flood_zone_norm = flood_zone if flood_zone in fz_ok else "none"

    row = dict(merged_row or {})
    med = _col(row, "median_home_value")
    band = price_band_from_median(med)

    f1 = tier_neighborhood_designations(row)
    f2 = tier_amenities(amenity_summary)
    f3 = tier_parks(amenity_summary)
    f4 = tier_vacant_blight(row)
    f5 = tier_walk_transit(amenity_summary)
    f5_safety = tier_site_safety(row)
    if f5_safety == "Low":
        f5 = "Low" if f5 != "High" else "Baseline"
    f6 = tier_land_use(flood_zone_norm, brownfield_flag, row)
    f7 = tier_construction_cost(row)
    f10 = tier_displacement(row)
    f11 = tier_neighborhood_strategy(row)
    f12 = tier_financial_projections(row)
    f13 = tier_investment_risk(flood_zone_norm, brownfield_flag, amenity_summary, row)

    park_min = _am(amenity_summary, "nearest_park_drive_minutes", "nearest_park_drive_min")
    network_min_to_park = float(park_min) if park_min is not None else None
    straight_park = _am(amenity_summary, "nearest_park_distance_miles", "nearest_park_drive_mi")

    yoy = assessed_value_yoy_pct
    if yoy is None:
        aff = _col(row, "affordability_pctile_moderate")
        if aff is not None:
            yoy = min(40.0, max(-5.0, (aff - 50.0) * 0.4))

    crime = crime_tract_percentile
    if crime is None:
        lmi = _col(row, "lmi_pct")
        if lmi is not None:
            crime = min(95.0, max(5.0, lmi * 1.1))

    comments = build_factor_comments(tract_geoid, row, amenity_summary, display_name)

    cost_idx = 1.0
    if med:
        cost_idx = round(0.85 + min(0.35, max(0.0, (med - 120_000) / 400_000)), 3)

    transit_count = int(_am(amenity_summary, "bus_stops_and_transit_nearby", "transit_stops_nearby") or 0)

    return ParcelInput(
        parcel_id=parcel_id,
        tract_geoid=tract_geoid,
        policy_neighborhood_id=tract_geoid,
        amenity_neighborhood_id=tract_geoid,
        use_network_for_amenities=bool(amenity_summary.get("uses_osrm", True)),
        network_min_to_park=network_min_to_park,
        straight_line_mi_to_park=straight_park,
        flood_zone=flood_zone_norm,  # type: ignore[arg-type]
        parcel_type="improved" if parcel_type.lower() == "improved" else "vacant",
        renovation_condition_tier="Baseline",
        assessed_value_yoy_pct=yoy,
        crime_tract_percentile=crime,
        submarket_price_band=band,
        cost_index_proxy=cost_idx,
        dataset_year=2024,
        brownfield_flag=brownfield_flag,
        channel_city=channel_city,
        channel_fannie=channel_fannie,
        channel_institution=channel_institution,
        factor_tiers={
            1: f1,
            2: f2,
            3: f3,
            4: f4,
            5: f5,
            6: f6,
            7: f7,
            8: "High" if parcel_type.lower() == "vacant" else "Baseline",
            9: "Baseline",
            10: f10,
            11: f11,
            12: f12,
            13: f13,
        },
        factor_comments=comments,
        jobs_access_tier="Baseline",
        transit_access_tier="High" if transit_count >= 4 else "Baseline",
        school_quality_tier="Baseline",
        ami_cost_burden_tier=tier_ami_burden(row),
    )
