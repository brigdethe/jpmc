"""
Pure scoring logic: parcel inputs → scorecard composite, ladder scaled score, per-factor QA metadata.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from fwclt_scoring import ladder as ladder_mod
from fwclt_scoring import scorecard as sc

Confidence = Literal["high", "medium", "low"]
Method = Literal["network_simulated", "straight_line_fallback", "manual", "tract_aggregate"]
Pillar = Literal[
    "cost_burden",
    "displacement_risk",
    "access_thrive",
    "vacant_redev",
    "city_investment",
]

N_GOOD_LADDER_FACTORS = 12
N_BAD_LADDER_FACTORS = 1
LADDER_BOUNDS = ladder_mod.ladder_bounds(N_GOOD_LADDER_FACTORS, N_BAD_LADDER_FACTORS)


@dataclass
class FactorDefinition:
    id: int
    label: str
    section: str
    raw_weight: float
    pillars: tuple[Pillar, ...]
    ladder_kind: Literal["good", "bad"]
    dataset_placeholder: str
    vintage_placeholder: str
    owner_note: str = ""


FACTORS: list[FactorDefinition] = [
    FactorDefinition(
        1,
        "Neighborhood / special designations",
        "Marketability",
        8.0,
        ("city_investment", "cost_burden"),
        "good",
        "PLACEHOLDER: City of Fort Worth TIF/PIA/NIP GIS layers",
        "2024 (demo)",
        "",
    ),
    FactorDefinition(
        2,
        "Nearby amenities (grocery, pharmacy, health care, conveniences)",
        "Marketability",
        8.0,
        ("access_thrive",),
        "good",
        "PLACEHOLDER: ODC business + network routing",
        "2024 (demo)",
        "Jobs/transit scored separately from retail amenities.",
    ),
    FactorDefinition(
        3,
        "City services (roads, utilities, parks, etc.)",
        "Project Complexity / Planning",
        7.0,
        ("access_thrive", "city_investment"),
        "good",
        "PLACEHOLDER: City utilities + park polygons + network distance",
        "2024 (demo)",
        "Park access: prefer official polygons + network distance within policy boundary.",
    ),
    FactorDefinition(
        4,
        "Other vacant lots / dilapidated housing / blight (block + neighborhood scale)",
        "Constructability",
        7.0,
        ("vacant_redev", "displacement_risk"),
        "good",
        "PLACEHOLDER: Code enforcement / vacancy survey",
        "2024 (demo)",
        "Low tier assumption: severe concentrated blight (demo definition).",
    ),
    FactorDefinition(
        5,
        "Site & surrounding criteria (safety; lighting; sidewalks; bike; greenways; walk score)",
        "Marketability",
        8.0,
        ("access_thrive",),
        "good",
        "PLACEHOLDER: Walk Score API or licensed extract (proxy only)",
        "2024 (demo)",
        "Walk Score is a third-party proxy (medium confidence); not equivalent to park access.",
    ),
    FactorDefinition(
        6,
        "Land use issues (zoning, overlays, floodplain, environmental, negative adjacencies)",
        "Constructability",
        10.0,
        ("vacant_redev", "displacement_risk"),
        "good",
        "PLACEHOLDER: City zoning + FEMA NFHL",
        "2024 (demo)",
        "Flood: verify with survey; critical floodway can hard-exclude.",
    ),
    FactorDefinition(
        7,
        "Construction / development cost impacts",
        "Constructability",
        8.0,
        ("vacant_redev",),
        "good",
        "PLACEHOLDER: RSMeans / local cost index",
        "2024 (demo)",
        "Demo uses cost_index + topography proxies.",
    ),
    FactorDefinition(
        8,
        "Development plans (renovation vs new; grading; utilities; neighborhood stability)",
        "Constructability",
        8.0,
        ("vacant_redev", "city_investment"),
        "good",
        "PLACEHOLDER: Staff site visit checklist",
        "2024 (demo)",
        "Renovation N/A when parcel_type=vacant.",
    ),
    FactorDefinition(
        9,
        "Special neighborhood classifications / community & government factors",
        "Project Complexity / Planning",
        7.0,
        ("city_investment",),
        "good",
        "PLACEHOLDER: Qualitative stakeholder log",
        "2024 (demo)",
        "Qualitative input — verify; low confidence by default.",
    ),
    FactorDefinition(
        10,
        "Displacement risk / gentrification",
        "Financial / Project Economics",
        9.0,
        ("displacement_risk", "cost_burden"),
        "good",
        "PLACEHOLDER: TCAD assessed value trend + demographic change (responsible use)",
        "2022–2024 (demo)",
        "OWNS assessed value % change and price-escalation hooks; do not reuse in row 11.",
    ),
    FactorDefinition(
        11,
        "Neighborhood strategy measures (stability, crime, property condition, market tiers, sales)",
        "Financial / Project Economics",
        8.0,
        ("cost_burden", "displacement_risk"),
        "good",
        "PLACEHOLDER: FBI UCR / local crime dashboard; MLS stats",
        "2024 (demo)",
        "Uses crime percentile + submarket price band; NOT assessed value CAGR (see row 10).",
    ),
    FactorDefinition(
        12,
        "Financial projections & pricing (project-level)",
        "Financial / Project Economics",
        10.0,
        ("cost_burden", "vacant_redev"),
        "good",
        "PLACEHOLDER: Pro forma template",
        "2024 (demo)",
        "",
    ),
    FactorDefinition(
        13,
        "Investment risk assessment (rollup of dealbreakers / feasibility)",
        "Investment Risk Assessment",
        12.0,
        ("displacement_risk", "vacant_redev"),
        "bad",
        "PLACEHOLDER: Staff investment memo",
        "2024 (demo)",
        "Risk-style ladder mapping: High opportunity → low investment risk.",
    ),
]


def normalized_row_weights() -> dict[int, float]:
    total = sum(f.raw_weight for f in FACTORS)
    return {f.id: (f.raw_weight / total) * 100.0 for f in FACTORS}


ROW_WEIGHTS = normalized_row_weights()


@dataclass
class ParcelInput:
    parcel_id: str
    tract_geoid: str = ""
    policy_neighborhood_id: str = ""
    amenity_neighborhood_id: str = ""
    use_network_for_amenities: bool = True
    network_min_to_park: float | None = None
    straight_line_mi_to_park: float | None = None
    flood_zone: Literal["none", "500yr", "100yr", "floodway_critical"] = "none"
    parcel_type: Literal["vacant", "improved"] = "vacant"
    renovation_condition_tier: str = ""
    assessed_value_yoy_pct: float | None = None
    crime_tract_percentile: float | None = None
    submarket_price_band: str = ""
    cost_index_proxy: float | None = None
    dataset_year: int | None = 2024
    brownfield_flag: bool = False
    channel_city: bool = False
    channel_fannie: bool = False
    channel_institution: bool = False
    factor_tiers: dict[int, str] = field(default_factory=dict)
    factor_comments: dict[int, str] = field(default_factory=dict)
    jobs_access_tier: str = ""
    transit_access_tier: str = ""
    school_quality_tier: str = ""
    ami_cost_burden_tier: str = ""

    @classmethod
    def from_csv_row(cls, row: dict[str, Any]) -> ParcelInput:
        def b(key: str) -> bool:
            v = row.get(key, False)
            if isinstance(v, bool):
                return v
            s = str(v).strip().lower()
            return s in ("1", "true", "yes", "y")

        def f(key: str) -> float | None:
            v = row.get(key)
            if v is None or v == "":
                return None
            return float(v)

        tiers: dict[int, str] = {}
        comments: dict[int, str] = {}
        for i in range(1, 14):
            t = row.get(f"factor_{i:02d}_tier", row.get(f"factor_{i}_tier", ""))
            if t:
                tiers[i] = str(t).strip()
            c = row.get(f"factor_{i:02d}_comment", row.get(f"factor_{i}_comment", ""))
            if c:
                comments[i] = str(c)

        fy = str(row.get("flood_zone", "none")).strip().lower().replace(" ", "_") or "none"
        fz: Literal["none", "500yr", "100yr", "floodway_critical"]
        if fy in ("none", "500yr", "100yr", "floodway_critical"):
            fz = fy  # type: ignore[assignment]
        else:
            fz = "none"
        pt_raw = str(row.get("parcel_type", "vacant")).strip().lower() or "vacant"
        pt: Literal["vacant", "improved"] = "improved" if pt_raw == "improved" else "vacant"

        return cls(
            parcel_id=str(row.get("parcel_id", "")),
            tract_geoid=str(row.get("tract_geoid", "")),
            policy_neighborhood_id=str(row.get("policy_neighborhood_id", "")),
            amenity_neighborhood_id=str(row.get("amenity_neighborhood_id", "")),
            use_network_for_amenities=b("use_network_for_amenities"),
            network_min_to_park=f("network_min_to_park"),
            straight_line_mi_to_park=f("straight_line_mi_to_park"),
            flood_zone=fz,
            parcel_type=pt,
            renovation_condition_tier=str(row.get("renovation_condition_tier", "")),
            assessed_value_yoy_pct=f("assessed_value_yoy_pct"),
            crime_tract_percentile=f("crime_tract_percentile"),
            submarket_price_band=str(row.get("submarket_price_band", "")),
            cost_index_proxy=f("cost_index_proxy"),
            dataset_year=int(row["dataset_year"]) if row.get("dataset_year") not in (None, "") else None,
            brownfield_flag=b("brownfield_flag"),
            channel_city=b("channel_city"),
            channel_fannie=b("channel_fannie"),
            channel_institution=b("channel_institution"),
            factor_tiers=tiers,
            factor_comments=comments,
            jobs_access_tier=str(row.get("jobs_access_tier", "")),
            transit_access_tier=str(row.get("transit_access_tier", "")),
            school_quality_tier=str(row.get("school_quality_tier", "")),
            ami_cost_burden_tier=str(row.get("ami_cost_burden_tier", "")),
        )


@dataclass
class FactorResult:
    factor_id: int
    label: str
    section: str
    pillars: tuple[Pillar, ...]
    tier_label: str
    numerical_0_20: float
    weight_pct: float
    scorecard_contribution: float
    ladder_points: int
    why: str
    method: Method
    dataset: str
    vintage: str
    confidence: Confidence
    qa_flags: list[str]
    comments_evidence: str


@dataclass
class ScorecardResult:
    composite_0_100: float
    letter: str
    opportunity_label: str
    pass_fail: bool
    pass_threshold: float
    channel_bonus: float
    hard_excluded: bool
    exclusion_reason: str


@dataclass
class LadderResult:
    raw: float
    scaled_0_100: float
    bounds: ladder_mod.LadderBounds


def _canon_tier(t: str) -> str:
    x = t.strip().lower()
    if x in ("high", "high opportunity"):
        return "High"
    if x in ("baseline",):
        return "Baseline"
    if x in ("low", "low opportunity"):
        return "Low"
    return t.strip()


def _amenity_method(p: ParcelInput) -> Method:
    return "network_simulated" if p.use_network_for_amenities else "straight_line_fallback"


def _base_qa(p: ParcelInput) -> list[str]:
    flags: list[str] = []
    if p.policy_neighborhood_id and p.amenity_neighborhood_id:
        if p.policy_neighborhood_id != p.amenity_neighborhood_id:
            flags.append("Amenity matched outside policy boundary")
    if not p.use_network_for_amenities:
        flags.append("Straight-line distance used—overstates access")
    if p.dataset_year is not None and p.dataset_year < 2020:
        flags.append("Stale dataset year")
    return flags


def _build_why(fid: int, p: ParcelInput, tier: str) -> str:
    t = _canon_tier(tier)
    if fid == 2:
        j, tr = p.jobs_access_tier, p.transit_access_tier
        extra = f" Jobs access tier {j!r}; transit {tr!r} (separate from Walk Score)." if (j or tr) else ""
        return f"Amenities tier {t} from proximity proxies; school quality tier {p.school_quality_tier!r}.{extra}"
    if fid == 3:
        nm = p.network_min_to_park
        sl = p.straight_line_mi_to_park
        return (
            f"City services/parks tier {t}; park network minutes={nm}, straight-line mi={sl} (policy-radius QA)."
        )
    if fid == 8 and p.parcel_type == "vacant":
        return f"Development plans tier {t}; renovation/condition N/A for vacant parcel."
    if fid == 9:
        return f"Community/government tier {t}; qualitative stakeholder input—verify before decisions."
    if fid == 10:
        y = p.assessed_value_yoy_pct
        return f"Displacement/gentrification tier {t}; assessed value YoY {y}% (row 10 owns this indicator)."
    if fid == 11:
        c = p.crime_tract_percentile
        b = p.submarket_price_band
        return (
            f"Neighborhood strategy tier {t}; crime tract percentile {c}, submarket band {b!r} (no price CAGR here)."
        )
    if fid == 12:
        return f"Financial tier {t}; AMI/cost burden context {p.ami_cost_burden_tier!r}."
    if fid == 6 and p.brownfield_flag:
        return f"Land use tier {t}; brownfield flag set—environmental verification required."
    if fid == 7 and p.cost_index_proxy is not None:
        return f"Construction cost tier {t}; demo cost index proxy {p.cost_index_proxy}."
    return f"Factor scored {t} per FWCLT acquisition factors rubric (demo)."


def _confidence_for(fid: int, p: ParcelInput) -> Confidence:
    if fid == 5:
        return "medium"
    if fid == 9:
        return "low"
    if fid in (2, 3) and not p.use_network_for_amenities:
        return "medium"
    if p.policy_neighborhood_id and p.amenity_neighborhood_id and p.policy_neighborhood_id != p.amenity_neighborhood_id:
        return "medium"
    return "high"


def evaluate_parcel(
    p: ParcelInput,
    pass_threshold: float = 50.0,
) -> tuple[list[FactorResult], ScorecardResult, LadderResult]:
    global_qa = _base_qa(p)
    hard = p.flood_zone == "floodway_critical"

    good_pts: list[int] = []
    bad_pts: list[int] = []
    results: list[FactorResult] = []

    for fd in FACTORS:
        tier_raw = p.factor_tiers.get(fd.id, "Baseline")
        tier = _canon_tier(tier_raw)
        num = sc.fwclt_tier_to_scorecard_0_20(tier)
        w = ROW_WEIGHTS[fd.id]
        contrib = sc.row_contribution(w, num)

        if fd.ladder_kind == "good":
            lp = ladder_mod.fwclt_tier_to_good_ladder_points(tier)
            good_pts.append(lp)
        else:
            lp = ladder_mod.fwclt_tier_to_bad_ladder_points(tier)
            bad_pts.append(lp)

        method: Method = "manual"
        if fd.id in (2,):
            method = _amenity_method(p)
        elif fd.id in (3,):
            method = _amenity_method(p)
        elif fd.id in (10, 11):
            method = "tract_aggregate"
        elif fd.id in (1, 12):
            method = "tract_aggregate"

        qa = list(global_qa)
        if fd.id in (2, 3, 5) and "Amenity matched outside policy boundary" not in qa:
            if p.policy_neighborhood_id and p.amenity_neighborhood_id and p.policy_neighborhood_id != p.amenity_neighborhood_id:
                qa.append("Amenity matched outside policy boundary")
        if fd.id == 3 and p.network_min_to_park is not None and p.straight_line_mi_to_park is not None:
            if p.network_min_to_park > 15 and (p.straight_line_mi_to_park or 99) < 1.0:
                qa.append("Park distance mismatch: network time high vs straight-line mi low")

        if fd.id == 9:
            qa.append("Qualitative stakeholder input—verify")

        qa = list(dict.fromkeys(qa))

        why = _build_why(fd.id, p, tier)
        conf = _confidence_for(fd.id, p)
        comment = p.factor_comments.get(fd.id, "")

        results.append(
            FactorResult(
                factor_id=fd.id,
                label=fd.label,
                section=fd.section,
                pillars=fd.pillars,
                tier_label=tier,
                numerical_0_20=num,
                weight_pct=w,
                scorecard_contribution=contrib,
                ladder_points=lp,
                why=why,
                method=method,
                dataset=fd.dataset_placeholder,
                vintage=fd.vintage_placeholder,
                confidence=conf,
                qa_flags=qa,
                comments_evidence=comment,
            )
        )

    base_composite = sum(r.scorecard_contribution for r in results)
    bonus = sc.channel_bonus_score(p.channel_city, p.channel_fannie, p.channel_institution)
    composite = min(100.0, base_composite + bonus)

    exclusion_reason = ""
    if hard:
        composite = 0.0
        exclusion_reason = "Critical flood (floodway / org-defined): hard exclude — verify with FEMA NFHL and survey."

    letter = sc.composite_to_letter(composite) if not hard else "D"
    opp = sc.letter_to_opportunity_label(letter)
    passed = (composite >= pass_threshold) and not hard

    sc_res = ScorecardResult(
        composite_0_100=round(composite, 2),
        letter=letter,
        opportunity_label=opp,
        pass_fail=passed,
        pass_threshold=pass_threshold,
        channel_bonus=round(bonus, 2),
        hard_excluded=hard,
        exclusion_reason=exclusion_reason,
    )

    raw = ladder_mod.compute_ladder_raw(good_pts, bad_pts)
    scaled = ladder_mod.scale_raw_to_0_100(raw, LADDER_BOUNDS)
    if hard:
        scaled = 0.0

    ld_res = LadderResult(raw=raw, scaled_0_100=round(scaled, 2), bounds=LADDER_BOUNDS)

    if hard:
        for r in results:
            r.qa_flags = list(dict.fromkeys(r.qa_flags + ["Critical flood hard exclude applied"]))

    return results, sc_res, ld_res


def compute_scores(
    p: ParcelInput,
    pass_threshold: float = 50.0,
) -> tuple[list[FactorResult], ScorecardResult, LadderResult]:
    """Public API: evaluate one parcel."""
    return evaluate_parcel(p, pass_threshold=pass_threshold)


def pillar_map_rows() -> list[tuple[int, str, tuple[Pillar, ...]]]:
    return [(f.id, f.label, f.pillars) for f in FACTORS]


def normalized_section_weights() -> dict[str, float]:
    return sc.normalize_weights(sc.RAW_SECTION_WEIGHTS_PCT)
