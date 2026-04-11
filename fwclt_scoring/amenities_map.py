"""
OpenStreetMap (Overpass) + OSRM public routing for amenity points and driving distances.

OSRM demo: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
Overpass: public instances; respect usage policy (no bulk hammering).
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


@dataclass
class AmenityPoint:
    name: str
    kind: str
    lat: float
    lon: float
    osm_type: str
    osm_id: int
    driving_m: float | None = None
    driving_min: float | None = None
    straight_line_mi: float | None = None
    route_geometry: list[tuple[float, float]] | None = None  # [(lat, lon), ...]


@dataclass
class AmenityFetchReport:
    origin_lat: float
    origin_lon: float
    points: list[AmenityPoint] = field(default_factory=list)
    overpass_url: str = ""
    osrm_note: str = ""
    errors: list[str] = field(default_factory=list)


def _overpass_query(lat: float, lon: float, radius_m: int) -> str:
    # radius ~5mi default for suburban DFW
    r = radius_m
    return f"""[out:json][timeout:45];
(
  node["shop"="supermarket"](around:{r},{lat},{lon});
  way["shop"="supermarket"](around:{r},{lat},{lon});
  node["shop"="convenience"](around:{r},{lat},{lon});
  way["shop"="convenience"](around:{r},{lat},{lon});
  node["amenity"="pharmacy"](around:{r},{lat},{lon});
  node["amenity"="hospital"](around:{r},{lat},{lon});
  node["amenity"="clinic"](around:{r},{lat},{lon});
  node["amenity"="doctors"](around:{r},{lat},{lon});
  node["public_transport"="platform"](around:{r},{lat},{lon});
  node["highway"="bus_stop"](around:{r},{lat},{lon});
  node["leisure"="park"](around:{r},{lat},{lon});
  way["leisure"="park"](around:{r},{lat},{lon});
);
out center;"""


def _element_center(el: dict[str, Any]) -> tuple[float, float] | None:
    if "lat" in el and "lon" in el:
        return float(el["lat"]), float(el["lon"])
    c = el.get("center") or {}
    if "lat" in c and "lon" in c:
        return float(c["lat"]), float(c["lon"])
    return None


def _element_kind(tags: dict[str, Any]) -> str:
    if tags.get("shop") in ("supermarket", "convenience"):
        return f"grocery:{tags.get('shop')}"
    if tags.get("amenity") == "pharmacy":
        return "pharmacy"
    if tags.get("amenity") in ("hospital", "clinic", "doctors"):
        return f"health:{tags.get('amenity')}"
    if tags.get("highway") == "bus_stop" or tags.get("public_transport") == "platform":
        return "transit"
    if tags.get("leisure") == "park":
        return "park"
    return "other"


OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]


def fetch_amenities_overpass(
    lat: float,
    lon: float,
    *,
    radius_m: int = 8000,
    overpass_url: str = "https://overpass-api.de/api/interpreter",
) -> AmenityFetchReport:
    report = AmenityFetchReport(origin_lat=lat, origin_lon=lon, overpass_url=overpass_url)
    body = _overpass_query(lat, lon, radius_m).encode("utf-8")

    urls_to_try = [overpass_url]
    for mirror in OVERPASS_MIRRORS:
        if mirror != overpass_url:
            urls_to_try.append(mirror)

    data = None
    last_err = ""
    for url in urls_to_try:
        req = Request(url, data=body, method="POST", headers={"User-Agent": "fwclt-property-scorer/1.0"})
        try:
            with urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            report.overpass_url = url
            break
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = str(e)
            time.sleep(1)
            continue

    if data is None:
        report.errors.append(f"All Overpass servers failed (last error: {last_err}). Amenity data unavailable.")
        return report

    elements = data.get("elements") or []
    seen: set[tuple[str, int]] = set()
    for el in elements:
        et = el.get("type")
        eid = el.get("id")
        if et not in ("node", "way", "relation") or eid is None:
            continue
        key = (str(et), int(eid))
        if key in seen:
            continue
        center = _element_center(el)
        if center is None:
            continue
        tags = el.get("tags") or {}
        kind = _element_kind(tags if isinstance(tags, dict) else {})
        if kind == "other":
            continue
        name = str(tags.get("name") or tags.get("brand") or kind).strip() or kind
        plat, plon = center
        sl_mi = _haversine_m(lat, lon, plat, plon) / 1609.344
        report.points.append(
            AmenityPoint(
                name=name,
                kind=kind,
                lat=plat,
                lon=plon,
                osm_type=str(et),
                osm_id=int(eid),
                straight_line_mi=round(sl_mi, 3),
            )
        )
        seen.add(key)

    return report


def _osrm_table_distances(
    origin_lon: float,
    origin_lat: float,
    destinations: list[tuple[float, float]],
    *,
    base_url: str = "https://router.project-osrm.org",
) -> tuple[list[float | None], list[float | None]] | None:
    """Returns (meters_list, seconds_list) aligned to destinations; None if OSRM fails."""
    if not destinations:
        return [], []
    coords = [(origin_lon, origin_lat)] + [(lon, lat) for lat, lon in destinations]
    coord_str = ";".join(f"{lon:.6f},{lat:.6f}" for lon, lat in coords)
    n = len(coords)
    dest_idx = ";".join(str(i) for i in range(1, n))
    url = (
        f"{base_url}/table/v1/driving/{coord_str}"
        f"?sources=0&destinations={dest_idx}&annotations=distance,duration"
    )
    req = Request(url, headers={"User-Agent": "fwclt-property-scorer/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            j = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None
    if j.get("code") != "Ok":
        return None
    dists = (j.get("distances") or [[]])[0]
    durs = (j.get("durations") or [[]])[0]
    out_m: list[float | None] = []
    out_s: list[float | None] = []
    for i in range(1, n):
        dm = dists[i] if i < len(dists) else None
        ds = durs[i] if i < len(durs) else None
        out_m.append(float(dm) if dm is not None else None)
        out_s.append(float(ds) if ds is not None else None)
    return out_m, out_s


def _osrm_route_geometry(
    origin_lon: float,
    origin_lat: float,
    dest_lon: float,
    dest_lat: float,
    *,
    base_url: str = "https://router.project-osrm.org",
) -> list[tuple[float, float]] | None:
    url = (
        f"{base_url}/route/v1/driving/{origin_lon:.6f},{origin_lat:.6f};{dest_lon:.6f},{dest_lat:.6f}"
        "?overview=full&geometries=geojson"
    )
    req = Request(url, headers={"User-Agent": "fwclt-property-scorer/1.0"})
    try:
        with urlopen(req, timeout=25) as resp:
            j = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None
    if j.get("code") != "Ok":
        return None
    routes = j.get("routes") or []
    if not routes:
        return None
    geom = (routes[0].get("geometry") or {}).get("coordinates") or []
    # GeoJSON is [lon, lat]
    return [(float(c[1]), float(c[0])) for c in geom if len(c) >= 2]


def attach_osrm_distances(
    report: AmenityFetchReport,
    *,
    max_table_destinations: int = 80,
    osrm_base: str = "https://router.project-osrm.org",
    pause_s: float = 1.0,
) -> AmenityFetchReport:
    """
    Fill driving_m / driving_min on each point via OSRM table.
    Optionally adds route_geometry for the nearest grocery and nearest pharmacy (extra calls).
    """
    if not report.points:
        report.osrm_note = "No OSM amenities to route."
        return report

    # Sort by straight-line distance, cap for public OSRM limits
    pts = sorted(report.points, key=lambda p: p.straight_line_mi or 1e9)[:max_table_destinations]
    dests = [(p.lat, p.lon) for p in pts]
    table = _osrm_table_distances(report.origin_lon, report.origin_lat, dests, base_url=osrm_base)
    if table is None:
        report.errors.append("OSRM table request failed; showing straight-line distances only.")
        report.osrm_note = "OSRM unavailable — straight-line miles shown."
        return report

    meters, seconds = table
    for p, m, s in zip(pts, meters, seconds):
        p.driving_m = m
        p.driving_min = (s / 60.0) if s is not None else None

    # Copy back into full list
    by_id = {(p.osm_type, p.osm_id): p for p in pts}
    for p in report.points:
        k = (p.osm_type, p.osm_id)
        if k in by_id:
            u = by_id[k]
            p.driving_m = u.driving_m
            p.driving_min = u.driving_min

    report.osrm_note = f"Driving distances via OSRM ({osrm_base})."

    # Route lines for map: nearest grocery + pharmacy
    def nearest_of(predicate) -> AmenityPoint | None:
        cands = [p for p in report.points if predicate(p) and p.driving_m is not None]
        if not cands:
            cands = [p for p in report.points if predicate(p)]
        if not cands:
            return None
        return min(cands, key=lambda x: x.driving_m if x.driving_m is not None else (x.straight_line_mi or 1e9) * 1609.344)

    g = nearest_of(lambda p: p.kind.startswith("grocery"))
    ph = nearest_of(lambda p: p.kind == "pharmacy")
    time.sleep(pause_s)
    for target in (g, ph):
        if target is None:
            continue
        geom = _osrm_route_geometry(
            report.origin_lon,
            report.origin_lat,
            target.lon,
            target.lat,
            base_url=osrm_base,
        )
        if geom:
            target.route_geometry = geom
        time.sleep(pause_s)

    return report


def summarize_for_scoring(report: AmenityFetchReport) -> dict[str, Any]:
    """Distances in miles / minutes for tract_rules / UI."""
    def miles(m: float | None) -> float | None:
        if m is None:
            return None
        return round(m / 1609.344, 3)

    groceries = [p for p in report.points if p.kind.startswith("grocery")]
    pharm = [p for p in report.points if p.kind == "pharmacy"]
    health = [p for p in report.points if p.kind.startswith("health")]
    parks = [p for p in report.points if p.kind == "park"]
    transit = [p for p in report.points if p.kind == "transit"]

    def best_drive_mi(items: list[AmenityPoint]) -> float | None:
        with_d = [p for p in items if p.driving_m is not None]
        pool = with_d or items
        if not pool:
            return None
        if with_d:
            return miles(min(with_d, key=lambda p: p.driving_m or 1e15).driving_m or 0)
        return min((p.straight_line_mi or 1e9) for p in pool)

    def best_drive_min(items: list[AmenityPoint]) -> float | None:
        with_t = [p for p in items if p.driving_min is not None]
        if not with_t:
            return None
        return round(min(p.driving_min for p in with_t if p.driving_min is not None), 2)

    def count_within_mi(items: list[AmenityPoint], mi: float) -> int:
        m_m = mi * 1609.344
        n = 0
        for p in items:
            d = p.driving_m
            if d is not None and d <= m_m:
                n += 1
            elif d is None and p.straight_line_mi is not None and p.straight_line_mi <= mi:
                n += 1
        return n

    nearest_park_mi = best_drive_mi(parks)
    park_min = best_drive_min(parks)

    def name_of_nearest(items: list[AmenityPoint]) -> str:
        with_d = [p for p in items if p.driving_m is not None]
        pool = with_d or items
        if not pool:
            return "None found"
        if with_d:
            return min(with_d, key=lambda p: p.driving_m or 1e15).name
        return min(pool, key=lambda p: p.straight_line_mi or 1e9).name

    return {
        "nearest_grocery_store": name_of_nearest(groceries),
        "nearest_grocery_distance_miles": best_drive_mi(groceries),
        "nearest_grocery_drive_minutes": best_drive_min(groceries),
        "nearest_pharmacy": name_of_nearest(pharm),
        "nearest_pharmacy_distance_miles": best_drive_mi(pharm),
        "nearest_pharmacy_drive_minutes": best_drive_min(pharm),
        "nearest_health_care": name_of_nearest(health),
        "nearest_health_care_distance_miles": best_drive_mi(health),
        "nearest_health_care_drive_minutes": best_drive_min(health),
        "nearest_park": name_of_nearest(parks),
        "nearest_park_distance_miles": nearest_park_mi,
        "nearest_park_drive_minutes": park_min,
        "grocery_stores_within_1_mile": count_within_mi(groceries, 1.0),
        "grocery_stores_within_3_miles": count_within_mi(groceries, 3.0),
        "total_grocery_stores_found": len(groceries),
        "total_pharmacies_found": len(pharm),
        "total_health_care_found": len(health),
        "total_parks_found": len(parks),
        "bus_stops_and_transit_nearby": len(transit),
        "uses_osrm": not any("OSRM" in e for e in report.errors),
    }
