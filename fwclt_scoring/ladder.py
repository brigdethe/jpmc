"""
Level-ladder score: raw points from a -10 friction base, good-factor tiers (+50..0),
bad-factor tiers (0..-50), then linear scale to 0–100.

Bounds use fixed counts of good vs risk factors in the rubric (see scoring_engine.FACTOR_LADDER_KINDS).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

LadderKind = Literal["good", "bad"]

# Fine-grained tiers (optional); three-tier demo maps into these.
GOOD_LADDER_POINTS: dict[str, int] = {
    "excellent": 50,
    "strong": 40,
    "moderate": 30,
    "weak": 20,
    "minimal": 10,
    "none": 0,
}

BAD_LADDER_POINTS: dict[str, int] = {
    "none": 0,
    "low": -10,
    "moderate": -20,
    "high": -30,
    "severe": -40,
    "critical": -50,
}


@dataclass(frozen=True)
class LadderBounds:
    min_raw: float
    max_raw: float
    n_good: int
    n_bad: int


def ladder_bounds(n_good: int, n_bad: int) -> LadderBounds:
    """Theoretical min/max raw for scaling (spec: all good at 0..50, all bad at -50..0)."""
    min_raw = -10.0 + (n_good * 0) + (n_bad * -50)
    max_raw = -10.0 + (n_good * 50) + (n_bad * 0)
    return LadderBounds(min_raw=min_raw, max_raw=max_raw, n_good=n_good, n_bad=n_bad)


def fwclt_tier_to_good_ladder_points(tier: str) -> int:
    """FWCLT row tier → good-style ladder points (High / Baseline / Low opportunity)."""
    t = tier.strip().lower()
    if t in ("high", "high opportunity"):
        return GOOD_LADDER_POINTS["excellent"]
    if t in ("baseline",):
        return GOOD_LADDER_POINTS["moderate"]
    if t in ("low", "low opportunity"):
        return GOOD_LADDER_POINTS["minimal"]
    raise ValueError(f"Unknown FWCLT tier for good ladder: {tier!r}")


def fwclt_tier_to_bad_ladder_points(tier: str) -> int:
    """
    FWCLT tier on a *risk* row (investment risk): High opportunity → none risk (0);
    Baseline → low risk; Low → high risk.
    """
    t = tier.strip().lower()
    if t in ("high", "high opportunity"):
        return BAD_LADDER_POINTS["none"]
    if t in ("baseline",):
        return BAD_LADDER_POINTS["low"]
    if t in ("low", "low opportunity"):
        return BAD_LADDER_POINTS["high"]
    raise ValueError(f"Unknown FWCLT tier for bad ladder: {tier!r}")


def scale_raw_to_0_100(raw: float, bounds: LadderBounds) -> float:
    span = bounds.max_raw - bounds.min_raw
    if span <= 0:
        return 0.0
    scaled = 100.0 * (raw - bounds.min_raw) / span
    return max(0.0, min(100.0, scaled))


def compute_ladder_raw(
    good_point_list: list[int],
    bad_point_list: list[int],
) -> float:
    return -10.0 + float(sum(good_point_list) + sum(bad_point_list))
