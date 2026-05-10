from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SearchIntent:
    min_score: float | None = None
    require_qct: bool | None = None
    require_opportunity_zone: bool | None = None
    priorities: list[str] = field(default_factory=list)
    avoid: list[str] = field(default_factory=list)
    max_flood_pct: float | None = None
    max_land_value: float | None = None
    notes: str = ""

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> "SearchIntent":
        def _float(name: str) -> float | None:
            value = data.get(name)
            if value is None or value == "":
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        def _bool(name: str) -> bool | None:
            value = data.get(name)
            if value is None:
                return None
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                v = value.strip().lower()
                if v in {"true", "yes", "required", "require"}:
                    return True
                if v in {"false", "no"}:
                    return False
            return None

        def _list(name: str) -> list[str]:
            value = data.get(name)
            if isinstance(value, list):
                return [str(v).strip().lower() for v in value if str(v).strip()]
            if isinstance(value, str) and value.strip():
                return [v.strip().lower() for v in value.split(",") if v.strip()]
            return []

        return cls(
            min_score=_float("min_score"),
            require_qct=_bool("require_qct"),
            require_opportunity_zone=_bool("require_opportunity_zone"),
            priorities=_list("priorities"),
            avoid=_list("avoid"),
            max_flood_pct=_float("max_flood_pct"),
            max_land_value=_float("max_land_value"),
            notes=str(data.get("notes") or ""),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "min_score": self.min_score,
            "require_qct": self.require_qct,
            "require_opportunity_zone": self.require_opportunity_zone,
            "priorities": self.priorities,
            "avoid": self.avoid,
            "max_flood_pct": self.max_flood_pct,
            "max_land_value": self.max_land_value,
            "notes": self.notes,
        }
