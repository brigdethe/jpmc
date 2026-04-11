"""
Org-style weighted scorecard: normalized row weights, 0–20 numerics, composite 0–100.
"""

from __future__ import annotations

from dataclasses import dataclass

# Example section weights from FWCLT-style scorecard (sum > 100 → normalize).
RAW_SECTION_WEIGHTS_PCT: dict[str, float] = {
    "Marketability": 20.0,
    "Constructability": 30.0,
    "Financial / Project Economics": 20.0,
    "Project Complexity / Planning": 30.0,
    "Investment Risk Assessment": 10.0,
}


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("Weight sum must be positive")
    return {k: (v / total) * 100.0 for k, v in weights.items()}


def fwclt_tier_to_scorecard_0_20(tier: str) -> float:
    """Map three-tier FWCLT label to 0–20 row score (plan table)."""
    t = tier.strip().lower()
    if t in ("high", "high opportunity"):
        # Top of FWCLT 18–20 band so a fully “High” scorecard can reach composite 100.
        return 20.0
    if t in ("baseline",):
        return 14.0
    if t in ("low", "low opportunity"):
        return 8.0
    raise ValueError(f"Unknown FWCLT tier: {tier!r}")


def row_contribution(weight_pct: float, numerical_0_20: float) -> float:
    """Contribution = weight_pct * (numerical / 20); sum over rows = composite 0–100 if weights sum to 100."""
    return weight_pct * (numerical_0_20 / 20.0)


def composite_to_letter(composite_0_100: float) -> str:
    """Letter bands on composite 0–100 (aligned with weighted 0–20 average on 0–100 scale)."""
    if composite_0_100 >= 90:
        return "A"
    if composite_0_100 >= 75:
        return "B"
    if composite_0_100 >= 50:
        return "C"
    return "D"


def letter_to_opportunity_label(letter: str) -> str:
    return {
        "A": "High Opportunity",
        "B": "Baseline",
        "C": "Low Opportunity",
        "D": "Very Low Opportunity",
    }.get(letter, "Unknown")


@dataclass(frozen=True)
class ChannelBonusConfig:
    """Below-market acquisition channel modifiers (cap applied in engine)."""
    max_bonus_points_on_composite: float = 5.0  # add at most +5 on 0–100 scale
    per_channel_increment: float = 1.5  # each active channel


def channel_bonus_score(
    channel_city: bool,
    channel_fannie: bool,
    channel_institution: bool,
    cfg: ChannelBonusConfig | None = None,
) -> float:
    cfg = cfg or ChannelBonusConfig()
    n = sum(1 for x in (channel_city, channel_fannie, channel_institution) if x)
    raw = n * cfg.per_channel_increment
    return min(cfg.max_bonus_points_on_composite, raw)
