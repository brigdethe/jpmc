from __future__ import annotations

import json
from typing import Any


SEARCH_INTENT_SYSTEM = (
    "You convert natural-language community land trust acquisition searches into "
    "structured preferences. Return only valid JSON. Do not rank properties."
)


def build_search_intent_prompt(query: str) -> str:
    schema = {
        "min_score": "number or null, 0-100",
        "require_qct": "boolean or null",
        "require_opportunity_zone": "boolean or null",
        "priorities": [
            "high_score",
            "low_land_value",
            "low_home_value",
            "high_lmi",
            "low_poverty",
            "high_walkability",
            "high_transit",
            "high_bike_score",
            "parks",
            "vacant_lots",
            "low_flood_risk",
            "low_crime",
            "qct",
            "opportunity_zone",
        ],
        "avoid": ["high_flood_risk", "high_crime", "high_land_value", "low_score"],
        "max_flood_pct": "number or null",
        "max_land_value": "number or null",
        "notes": "short explanation of interpreted intent",
    }
    return (
        "Interpret this search for Fort Worth CLT acquisition areas.\n\n"
        f"Allowed JSON shape:\n{json.dumps(schema, indent=2)}\n\n"
        f"User search: {query!r}\n\n"
        "Return JSON only."
    )


CHAT_SYSTEM = (
    "You are a careful acquisition analyst for a community land trust. Answer using only "
    "the supplied scored-property context. Do not invent facts, parcels, amenities, or "
    "change the computed score. If data is missing, say what is missing and suggest due "
    "diligence. Keep answers practical and concise."
)


def build_chat_prompt(question: str, property_context: dict[str, Any], history: list[dict[str, str]]) -> str:
    compact_context = {
        "score": property_context.get("composite_score"),
        "grade": property_context.get("letter_grade"),
        "opportunity_label": property_context.get("opportunity_label"),
        "pass_fail": property_context.get("pass_fail"),
        "hard_excluded": property_context.get("hard_excluded"),
        "exclusion_reason": property_context.get("exclusion_reason"),
        "address": property_context.get("address"),
        "tract_geoid": property_context.get("tract_geoid"),
        "amenity_summary": property_context.get("amenity_summary"),
        "factors": property_context.get("factors", [])[:13],
        "similar_tracts": property_context.get("similar_tracts", [])[:6],
        "tract_data": _compact_mapping(property_context.get("tract_data") or {}),
        "errors": property_context.get("errors", []),
    }
    recent_history = history[-8:]
    return (
        "Scored-property context:\n"
        f"{json.dumps(compact_context, ensure_ascii=False, default=str)[:18000]}\n\n"
        "Recent conversation:\n"
        f"{json.dumps(recent_history, ensure_ascii=False, default=str)[:4000]}\n\n"
        f"User question: {question}\n"
    )


def _compact_mapping(data: dict[str, Any]) -> dict[str, Any]:
    keep = {
        "GEOID",
        "median_home_value",
        "median_home_value_owner",
        "median_hh_income",
        "median_income",
        "lmi_pct",
        "poverty_pct",
        "unemployment_pct",
        "walk_score",
        "transit_score",
        "bike_score",
        "crime_incidents",
        "parks_count",
        "vacant_lot_pct",
        "flood_zone_pct",
        "median_land_value",
        "est_land_value",
        "is_qct",
        "is_opportunity_zone",
        "total_population",
    }
    return {k: v for k, v in data.items() if k in keep}
