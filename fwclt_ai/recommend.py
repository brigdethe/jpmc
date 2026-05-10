from __future__ import annotations

import json
import math
import re
from typing import Any

import pandas as pd

from .prompts import SEARCH_INTENT_SYSTEM, build_search_intent_prompt
from .providers import AIProviderError, generate_text, is_ai_enabled
from .schemas import SearchIntent


PRIORITY_ALIASES: dict[str, set[str]] = {
    "high_score": {"high score", "strong score", "best score", "top score", "pass"},
    "low_land_value": {"cheap land", "affordable land", "low land", "low cost", "inexpensive"},
    "low_home_value": {"low home value", "affordable homes", "low property value"},
    "high_lmi": {"lmi", "low moderate income", "low-income", "equity"},
    "low_poverty": {"low poverty", "stable income"},
    "high_walkability": {"walkable", "walk score", "sidewalk"},
    "high_transit": {"transit", "bus", "transportation"},
    "high_bike_score": {"bike", "bikeable"},
    "parks": {"park", "parks", "green space"},
    "vacant_lots": {"vacant", "vacant lots", "infill"},
    "low_flood_risk": {"low flood", "avoid flood", "not flood", "flood risk"},
    "low_crime": {"safe", "safety", "low crime"},
    "qct": {"qct", "qualified census tract"},
    "opportunity_zone": {"opportunity zone", "oz"},
}


def recommend_tracts(
    *,
    query: str,
    scored_df: pd.DataFrame,
    source_df: pd.DataFrame,
    top: int = 8,
) -> dict[str, Any]:
    intent, provider, warnings = parse_search_intent(query)
    merged = scored_df.merge(source_df.drop_duplicates("GEOID"), on="GEOID", how="left", suffixes=("", "_source"))
    ranked = _rank(merged, intent).head(max(1, min(top, 25))).copy()

    results: list[dict[str, Any]] = []
    for _, row in ranked.iterrows():
        record = _public_record(row)
        record["match_score"] = round(float(row.get("_ai_match_score", 0)), 1)
        record["match_reasons"] = _reasons(row, intent)
        record["matched_preferences"] = intent.priorities[:]
        results.append(record)

    return {
        "query": query,
        "provider": provider,
        "intent": intent.to_dict(),
        "results": results,
        "warnings": warnings,
    }


def parse_search_intent(query: str) -> tuple[SearchIntent, str, list[str]]:
    warnings: list[str] = []
    if is_ai_enabled():
        try:
            text, provider = generate_text(
                system=SEARCH_INTENT_SYSTEM,
                prompt=build_search_intent_prompt(query),
                temperature=0,
                max_tokens=500,
            )
            data = _extract_json(text)
            intent = SearchIntent.from_mapping(data)
            _enrich_intent_from_query(intent, query)
            return intent, provider, warnings
        except (AIProviderError, ValueError, json.JSONDecodeError) as exc:
            warnings.append(f"AI intent parsing unavailable; used local keyword parsing. {exc}")
    else:
        warnings.append("AI is disabled; used local keyword parsing.")

    intent = SearchIntent()
    _enrich_intent_from_query(intent, query)
    return intent, "local", warnings


def _rank(df: pd.DataFrame, intent: SearchIntent) -> pd.DataFrame:
    ranked = df.copy()
    if intent.min_score is not None:
        ranked = ranked[ranked["composite_score"] >= intent.min_score]
    if intent.require_qct is True and "is_qct" in ranked:
        ranked = ranked[ranked["is_qct"] == 1]
    if intent.require_opportunity_zone is True and "is_oz" in ranked:
        ranked = ranked[ranked["is_oz"] == 1]
    if intent.max_flood_pct is not None and "flood_zone_pct" in ranked:
        ranked = ranked[_num(ranked["flood_zone_pct"]).fillna(0) <= intent.max_flood_pct]
    if intent.max_land_value is not None and "est_land_value" in ranked:
        ranked = ranked[_num(ranked["est_land_value"]).fillna(math.inf) <= intent.max_land_value]

    if len(ranked) == 0:
        ranked = df.copy()

    score = _norm_high(ranked, "composite_score") * 55.0
    weights = {
        "high_score": ("composite_score", "high", 14.0),
        "low_land_value": ("est_land_value", "low", 12.0),
        "low_home_value": ("median_home_value", "low", 8.0),
        "high_lmi": ("lmi_pct", "high", 8.0),
        "low_poverty": ("poverty_pct", "low", 6.0),
        "high_walkability": ("walk_score", "high", 8.0),
        "high_transit": ("transit_score", "high", 8.0),
        "high_bike_score": ("bike_score", "high", 5.0),
        "parks": ("parks_count", "high", 7.0),
        "vacant_lots": ("vacant_lot_pct", "high", 6.0),
        "low_flood_risk": ("flood_zone_pct", "low", 10.0),
        "low_crime": ("crime_incidents", "low", 8.0),
        "qct": ("is_qct", "high", 5.0),
        "opportunity_zone": ("is_oz", "high", 5.0),
    }

    selected = intent.priorities or ["high_score"]
    for priority in selected:
        spec = weights.get(priority)
        if not spec:
            continue
        col, direction, weight = spec
        score += (_norm_low(ranked, col) if direction == "low" else _norm_high(ranked, col)) * weight

    for avoided in intent.avoid:
        if avoided == "high_flood_risk":
            score -= _norm_high(ranked, "flood_zone_pct") * 12.0
        elif avoided == "high_crime":
            score -= _norm_high(ranked, "crime_incidents") * 8.0
        elif avoided == "high_land_value":
            score -= _norm_high(ranked, "est_land_value") * 8.0
        elif avoided == "low_score":
            score -= _norm_low(ranked, "composite_score") * 20.0

    ranked["_ai_match_score"] = score
    return ranked.sort_values(["_ai_match_score", "composite_score"], ascending=False)


def _enrich_intent_from_query(intent: SearchIntent, query: str) -> None:
    q = query.lower()
    numbers = [float(n) for n in re.findall(r"\b(?:score\s*(?:of|over|above|>=?)?\s*)?(\d{2})(?:\s*/\s*100|\s*score|\s*%)?\b", q)]
    plausible_scores = [n for n in numbers if 40 <= n <= 100]
    if intent.min_score is None and plausible_scores:
        intent.min_score = max(plausible_scores)
    if intent.min_score is None and any(term in q for term in ("strong", "high opportunity", "best", "top")):
        intent.min_score = 65.0

    priorities = set(intent.priorities)
    avoid = set(intent.avoid)
    for priority, terms in PRIORITY_ALIASES.items():
        if any(term in q for term in terms):
            priorities.add(priority)
    if any(term in q for term in ("avoid flood", "low flood", "not flood", "flood risk")):
        priorities.add("low_flood_risk")
        avoid.add("high_flood_risk")
    if any(term in q for term in ("safe", "low crime", "safety")):
        priorities.add("low_crime")
        avoid.add("high_crime")
    if any(term in q for term in ("affordable land", "cheap land", "low land")):
        avoid.add("high_land_value")

    if intent.require_qct is None and "qct" in priorities:
        intent.require_qct = True
    if intent.require_opportunity_zone is None and "opportunity_zone" in priorities:
        intent.require_opportunity_zone = True

    intent.priorities = sorted(priorities) or ["high_score"]
    intent.avoid = sorted(avoid)


def _extract_json(text: str) -> dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
    start = clean.find("{")
    end = clean.rfind("}")
    if start < 0 or end < start:
        raise ValueError("AI response did not contain JSON.")
    return json.loads(clean[start : end + 1])


def _num(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _norm_high(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df:
        return pd.Series(0.5, index=df.index)
    s = _num(df[col])
    mn, mx = s.min(skipna=True), s.max(skipna=True)
    if pd.isna(mn) or pd.isna(mx) or mx == mn:
        return pd.Series(0.5, index=df.index)
    return ((s - mn) / (mx - mn)).fillna(0.0).clip(0, 1)


def _norm_low(df: pd.DataFrame, col: str) -> pd.Series:
    return 1.0 - _norm_high(df, col)


def _public_record(row: pd.Series) -> dict[str, Any]:
    keys = [
        "GEOID",
        "composite_score",
        "letter_grade",
        "opportunity",
        "pass_fail",
        "ladder_score",
        "median_home_value",
        "est_land_value",
        "median_income",
        "poverty_pct",
        "lmi_pct",
        "is_qct",
        "is_oz",
        "top_strengths",
        "weaknesses",
        "approx_lat",
        "approx_lon",
    ]
    extra = [
        "walk_score",
        "transit_score",
        "bike_score",
        "crime_incidents",
        "parks_count",
        "vacant_lot_pct",
        "flood_zone_pct",
    ]
    out = {k: _safe(row.get(k)) for k in keys + extra if k in row.index}
    return out


def _reasons(row: pd.Series, intent: SearchIntent) -> list[str]:
    reasons = [
        f"Composite score {float(row.get('composite_score') or 0):.1f}/100",
    ]
    if "low_land_value" in intent.priorities and _has(row, "est_land_value"):
        reasons.append(f"Estimated land value ${float(row['est_land_value']):,.0f}")
    if "high_transit" in intent.priorities and _has(row, "transit_score"):
        reasons.append(f"Transit score {float(row['transit_score']):.0f}")
    if "high_walkability" in intent.priorities and _has(row, "walk_score"):
        reasons.append(f"Walk score {float(row['walk_score']):.0f}")
    if "parks" in intent.priorities and _has(row, "parks_count"):
        reasons.append(f"{float(row['parks_count']):.0f} parks counted in tract data")
    if "low_flood_risk" in intent.priorities and _has(row, "flood_zone_pct"):
        reasons.append(f"Flood-zone share {float(row['flood_zone_pct']):.1f}%")
    if "low_crime" in intent.priorities and _has(row, "crime_incidents"):
        reasons.append(f"Crime incidents {float(row['crime_incidents']):.0f}")
    if row.get("is_qct") == 1:
        reasons.append("Qualified Census Tract")
    if row.get("is_oz") == 1:
        reasons.append("Opportunity Zone")
    return reasons[:5]


def _has(row: pd.Series, key: str) -> bool:
    value = row.get(key)
    return value is not None and not (isinstance(value, float) and math.isnan(value))


def _safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "item"):
        try:
            return _safe(value.item())
        except ValueError:
            pass
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value
