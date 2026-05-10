"""
FWCLT property acquisition scorer — Streamlit UI.

Run:  streamlit run app.py --server.headless true
"""

from __future__ import annotations

from pathlib import Path

import folium
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from fwclt_scoring.amenities_map import (
    AmenityFetchReport,
    attach_osrm_distances,
    fetch_amenities_overpass,
    summarize_for_scoring,
)
from fwclt_scoring.geo import geocode_address, normalize_geoid_for_merge, reverse_geocode, tract_from_lat_lon
from fwclt_scoring.scoring_engine import compute_scores
from fwclt_scoring.suggest import find_similar_tracts, find_top_tracts, score_all_tracts
from fwclt_scoring.tract_derive import merged_row_to_parcel_input

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
FULL_PIPELINE_CSV = DATA_DIR / "fort_worth_full_pipeline.csv"
MERGED_CSV = DATA_DIR / "fort_worth_merged.csv"

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


def score_color(pct: float) -> tuple[str, str, str]:
    if pct < 50:
        return "#fde8e8", "#b91c1c", "Low — below 50%"
    if pct < 75:
        return "#fef9c3", "#a16207", "Moderate — between 50% and 75%"
    return "#dcfce7", "#166534", "Strong — above 75%"


def score_dot(pct: float) -> str:
    if pct < 50:
        return "🔴"
    if pct < 75:
        return "🟡"
    return "🟢"


@st.cache_data
def load_tract_table(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"GEOID": str})
    df["GEOID"] = df["GEOID"].apply(lambda x: normalize_geoid_for_merge(str(x)))
    return df


@st.cache_data
def prescore_tracts(path: str) -> pd.DataFrame:
    df = load_tract_table(path)
    return score_all_tracts(df)


AMENITY_PRETTY_KIND = {
    "grocery:supermarket": "Grocery Store",
    "grocery:convenience": "Convenience Store",
    "pharmacy": "Pharmacy",
    "health:hospital": "Hospital",
    "health:clinic": "Clinic",
    "health:doctors": "Doctor's Office",
    "transit": "Bus Stop / Transit",
    "park": "Park",
}


def build_map(report: AmenityFetchReport) -> str:
    m = folium.Map(
        location=[report.origin_lat, report.origin_lon],
        zoom_start=13,
        tiles="OpenStreetMap",
        dragging=True,
        scroll_wheel_zoom=True,
    )
    folium.Marker(
        [report.origin_lat, report.origin_lon],
        tooltip="Property Site",
        icon=folium.Icon(color="red"),
    ).add_to(m)

    kind_colors = {
        "grocery": "green",
        "pharmacy": "blue",
        "health": "purple",
        "park": "darkgreen",
        "transit": "orange",
    }

    for p in sorted(report.points, key=lambda x: x.straight_line_mi or 99)[:60]:
        color = "gray"
        for prefix, c in kind_colors.items():
            if p.kind.startswith(prefix):
                color = c
                break

        pretty = AMENITY_PRETTY_KIND.get(p.kind, p.kind.replace(":", " - ").title())
        dm = p.driving_m
        dmi = (dm / 1609.344) if dm is not None else None
        dmin = p.driving_min

        if dmi is not None and dmin is not None:
            dist_line = f"Driving: {dmi:.2f} miles, ~{dmin:.1f} min"
        elif p.straight_line_mi is not None:
            dist_line = f"Straight-line: ~{p.straight_line_mi:.2f} miles"
        else:
            dist_line = "Distance unknown"

        popup_html = f"<b>{p.name}</b><br><i>{pretty}</i><br>{dist_line}"
        folium.CircleMarker(
            location=[p.lat, p.lon],
            radius=7,
            color=color,
            fill=True,
            fill_opacity=0.75,
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=f"{p.name} ({pretty})",
        ).add_to(m)

        if p.route_geometry:
            folium.PolyLine(
                locations=p.route_geometry,
                color="#2563eb",
                weight=4,
                opacity=0.85,
                tooltip=f"Route to {p.name}",
            ).add_to(m)

    map_var = m.get_name()
    click_js = f"""
    <script>
    document.addEventListener("DOMContentLoaded", function() {{
        var checkMap = setInterval(function() {{
            if (typeof {map_var} !== 'undefined') {{
                clearInterval(checkMap);
                var map_obj = {map_var};
                map_obj.on('click', function(e) {{
                    var lat = e.latlng.lat.toFixed(6);
                    var lon = e.latlng.lng.toFixed(6);
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent("<b>Clicked location</b><br>" + lat + ", " + lon + "<br><small>Copy these coordinates into the Address field to score this spot.</small>")
                        .openOn(map_obj);
                }});
            }}
        }}, 200);
    }});
    </script>
    """
    return m._repr_html_() + click_js


def format_summary_table(summary: dict) -> list[dict]:
    def fmt_mi(key: str) -> str:
        v = summary.get(key)
        if v is None:
            return "Not found nearby"
        return f"{float(v):.2f} miles"

    def fmt_min(key: str) -> str:
        v = summary.get(key)
        if v is None:
            return "---"
        return f"~{float(v):.1f} min drive"

    def fmt_name(key: str) -> str:
        v = summary.get(key)
        if v is None or v == "None found":
            return "None found in search area"
        return str(v)

    def fmt_int(key: str) -> str:
        v = summary.get(key)
        if v is None:
            return "0"
        return str(int(v))

    return [
        {"Amenity Type": "Nearest Grocery Store", "Name": fmt_name("nearest_grocery_store"), "Distance": fmt_mi("nearest_grocery_distance_miles"), "Drive Time": fmt_min("nearest_grocery_drive_minutes")},
        {"Amenity Type": "Nearest Pharmacy", "Name": fmt_name("nearest_pharmacy"), "Distance": fmt_mi("nearest_pharmacy_distance_miles"), "Drive Time": fmt_min("nearest_pharmacy_drive_minutes")},
        {"Amenity Type": "Nearest Health Care", "Name": fmt_name("nearest_health_care"), "Distance": fmt_mi("nearest_health_care_distance_miles"), "Drive Time": fmt_min("nearest_health_care_drive_minutes")},
        {"Amenity Type": "Nearest Park", "Name": fmt_name("nearest_park"), "Distance": fmt_mi("nearest_park_distance_miles"), "Drive Time": fmt_min("nearest_park_drive_minutes")},
        {"Amenity Type": "Grocery Stores within 1 mile", "Name": fmt_int("grocery_stores_within_1_mile"), "Distance": "---", "Drive Time": "---"},
        {"Amenity Type": "Grocery Stores within 3 miles", "Name": fmt_int("grocery_stores_within_3_miles"), "Distance": "---", "Drive Time": "---"},
        {"Amenity Type": "Bus Stops / Transit Stops Nearby", "Name": fmt_int("bus_stops_and_transit_nearby"), "Distance": "---", "Drive Time": "---"},
    ]


def render_suggestion_card(row: pd.Series, idx: int, context: str = "top") -> None:
    score = row["composite_score"]
    bg, fg, label = score_color(score)
    dot = score_dot(score)
    geoid = row["GEOID"]
    med_val = row.get("median_home_value")
    est_val = row.get("est_land_value")
    med_inc = row.get("median_income")
    pov = row.get("poverty_pct")
    lmi = row.get("lmi_pct")
    strengths = row.get("top_strengths", "")
    weaknesses = row.get("weaknesses", "")
    lat = row.get("approx_lat")
    lon = row.get("approx_lon")

    price_str = f"${med_val:,.0f}" if pd.notna(med_val) else "N/A"
    land_str = f"${est_val:,.0f}" if pd.notna(est_val) else "N/A"
    income_str = f"${med_inc:,.0f}" if pd.notna(med_inc) else "N/A"
    pov_str = f"{pov:.1f}%" if pd.notna(pov) else "N/A"
    lmi_str = f"{lmi:.1f}%" if pd.notna(lmi) else "N/A"

    qct_badge = " | QCT" if row.get("is_qct", 0) else ""
    oz_badge = " | Opportunity Zone" if row.get("is_oz", 0) else ""

    coord_str = f"{lat}, {lon}" if pd.notna(lat) and pd.notna(lon) else "N/A"

    st.markdown(
        f"""<div style="background:{bg};color:{fg};padding:0.85rem 1.1rem;border-radius:10px;margin-bottom:0.6rem;border:1px solid {fg}22;">
<div style="display:flex;justify-content:space-between;align-items:center;">
  <div><b>{dot} Fort Worth Area — Tract {geoid}</b></div>
  <div style="font-size:1.3rem;font-weight:700;">{score:.1f}%</div>
</div>
<div style="font-size:0.95rem;margin-top:0.3rem;">Grade: {row['letter_grade']} ({row['opportunity']}){qct_badge}{oz_badge}</div>
<div style="font-size:0.88rem;margin-top:0.25rem;">
  Median home: {price_str} | Land value: {land_str} | Median income: {income_str}<br>
  Poverty: {pov_str} | LMI: {lmi_str}
</div>
<div style="font-size:0.85rem;margin-top:0.3rem;"><b>Why it scores well:</b> {strengths}</div>
<div style="font-size:0.85rem;opacity:0.8;"><b>Areas to watch:</b> {weaknesses}</div>
<div style="font-size:0.82rem;margin-top:0.25rem;opacity:0.7;">Coordinates: {coord_str} (paste into Address field to get full score with amenities)</div>
</div>""",
        unsafe_allow_html=True,
    )

    btn_key = f"score_{context}_{geoid}_{idx}"
    if pd.notna(lat) and pd.notna(lon):
        if st.button(f"Score this area ({geoid})", key=btn_key):
            st.session_state["auto_address"] = coord_str
            st.rerun()


def main() -> None:
    st.set_page_config(page_title="FWCLT Acquisition Scorer", layout="wide")
    st.title("Fort Worth Community Land Trust — Property Scoring")
    st.caption("Evaluates properties for affordable homeownership acquisition using FWCLT acquisition factors and Fort Worth tract-level data.")

    data_csv = FULL_PIPELINE_CSV if FULL_PIPELINE_CSV.exists() else MERGED_CSV
    if not data_csv.exists():
        st.error(f"Cannot find data file. Expected {FULL_PIPELINE_CSV} or {MERGED_CSV}")
        return

    df = load_tract_table(str(data_csv))

    with st.spinner("Pre-scoring all tracts for suggestions (runs once, then cached)..."):
        scored_tracts = prescore_tracts(str(data_csv))

    with st.sidebar:
        with st.form("score_form"):
            st.header("Property Details")
            default_addr = st.session_state.pop("auto_address", "3500 Sycamore School Rd, Fort Worth, TX")
            address = st.text_input(
                "Address or Coordinates",
                value=default_addr,
                help="Type a street address in Fort Worth / Tarrant County, or paste latitude,longitude from clicking the map.",
            )
            st.markdown("---")
            st.subheader("Site Conditions")
            st.caption("Describe the physical property based on a site visit or city records.")
            parcel_type = st.selectbox(
                "What is on the lot?",
                ["vacant", "improved"],
                help="'Vacant' = empty lot. 'Improved' = has an existing structure.",
            )
            flood_zone = st.selectbox(
                "Flood zone designation",
                ["none", "500yr", "100yr", "floodway_critical"],
                help="From FEMA flood maps or City GIS. 'none' = no flood risk. 'floodway_critical' = major risk, likely disqualifies the site.",
            )
            brownfield = st.checkbox(
                "Brownfield / environmental concern",
                help="Known contamination or EPA brownfield listing. Adds cleanup cost and lowers score.",
            )
            st.markdown("---")
            st.subheader("Acquisition Channels")
            st.caption("Check if the land is available below market price through any of these. Each gives a small score bonus.")
            ch_city = st.checkbox("City / land bank (below-market)")
            ch_fannie = st.checkbox("Fannie Mae / similar program")
            ch_inst = st.checkbox("Local institution donation/discount")
            st.markdown("---")
            radius_m = st.slider("Amenity search radius (meters)", 2000, 16000, 8000, 500, help="How far to search for grocery stores, pharmacies, parks, transit.")
            run_btn = st.form_submit_button("Score This Property", type="primary")

    tab_score, tab_suggest = st.tabs(["Property Score", "Suggested Areas"])

    with tab_suggest:
        st.subheader("Top-Scoring Areas in Fort Worth")
        st.caption("These are the census tracts in our dataset with the highest acquisition scores based on tract-level data (affordability, cost burden, displacement risk, construction era, designations). Amenity distances are not included in this pre-score — score a specific address for the full picture.")
        top = find_top_tracts(scored_tracts, min_score=60.0, max_results=12)
        if len(top) == 0:
            st.info("No tracts scored above 60%. Try lowering the threshold.")
        else:
            for i, (_, row) in enumerate(top.iterrows()):
                render_suggestion_card(row, i, "top")

    with tab_score:
        if not run_btn:
            st.info("Fill in the property details in the sidebar and click **Score This Property**.")
            return

        addr = address.strip()
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
            from fwclt_scoring.geo import GeocodeResult
            display = reverse_geocode(lat_in, lon_in) or f"{lat_in}, {lon_in}"
            geo = GeocodeResult(address=addr, lat=lat_in, lon=lon_in, display_name=display, raw={})
        else:
            with st.spinner("Finding the address on the map..."):
                geo = geocode_address(addr)
            if geo is None:
                st.error("Could not find that address. Try adding a ZIP code, or paste coordinates (lat, lon) from the map.")
                return

        with st.spinner("Looking up census tract..."):
            tract = tract_from_lat_lon(geo.lat, geo.lon)
        if tract is None:
            st.error("Could not look up the census tract. The FCC API may be down — try again in a minute.")
            return

        geoid = normalize_geoid_for_merge(tract.tract_geoid)
        row_series = df.loc[df["GEOID"] == geoid]
        merged_row = row_series.iloc[0].to_dict() if len(row_series) else None
        if merged_row is None:
            st.warning(f"Census tract {geoid} is not in our dataset. Some factors will default to Baseline.")

        with st.spinner("Searching for nearby amenities (grocery stores, pharmacies, parks, transit)..."):
            report = fetch_amenities_overpass(geo.lat, geo.lon, radius_m=radius_m)

        if report.errors:
            for e in report.errors:
                st.warning(e)

        with st.spinner("Calculating driving distances to amenities..."):
            report = attach_osrm_distances(report)

        summary = summarize_for_scoring(report)
        summary["uses_osrm"] = not any("OSRM" in e for e in report.errors)

        parcel = merged_row_to_parcel_input(
            parcel_id="WEB-1",
            tract_geoid=geoid,
            display_name=geo.display_name,
            merged_row=merged_row,
            amenity_summary=summary,
            flood_zone=flood_zone,
            parcel_type=parcel_type,
            brownfield_flag=brownfield,
            channel_city=ch_city,
            channel_fannie=ch_fannie,
            channel_institution=ch_inst,
        )

        factors, scorecard, ladder = compute_scores(parcel, pass_threshold=50.0)
        pct = scorecard.composite_0_100
        bg, fg, label = score_color(pct)

        st.markdown(
            f"""
<div style="background:{bg};color:{fg};padding:1.25rem 1.5rem;border-radius:12px;margin-bottom:1.25rem;border:1px solid {fg}33;">
  <div style="font-size:2rem;font-weight:700;">{pct:.1f}% — {label}</div>
  <div style="font-size:1.1rem;margin-top:0.4rem;">Grade: {scorecard.letter} ({scorecard.opportunity_label})</div>
  <div style="margin-top:0.5rem;font-size:1rem;">
    Pass/Fail (50% threshold): <b>{'PASS' if scorecard.pass_fail else 'FAIL'}</b>
    {(' — ' + scorecard.exclusion_reason) if scorecard.hard_excluded else ''}
  </div>
</div>
""",
            unsafe_allow_html=True,
        )

        st.subheader("What makes this score")
        top_up = sorted(factors, key=lambda r: r.scorecard_contribution, reverse=True)[:3]
        top_down = sorted(factors, key=lambda r: r.scorecard_contribution)[:3]

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Strongest factors (helping the score):**")
            for r in top_up:
                name = FWCLT_FACTOR_NAMES.get(r.factor_id, r.label)
                st.markdown(f"- {name} — **{r.tier_label}** tier (+{r.scorecard_contribution:.1f} points)")
        with col2:
            st.markdown("**Weakest factors (dragging the score down):**")
            for r in top_down:
                name = FWCLT_FACTOR_NAMES.get(r.factor_id, r.label)
                st.markdown(f"- {name} — **{r.tier_label}** tier (+{r.scorecard_contribution:.1f} points)")

        with st.expander("All 13 Acquisition Factors (full breakdown)", expanded=False):
            rows = []
            for r in factors:
                name = FWCLT_FACTOR_NAMES.get(r.factor_id, r.label)
                rows.append({
                    "#": r.factor_id,
                    "Acquisition Factor": name,
                    "Tier (High / Baseline / Low)": r.tier_label,
                    "Weight %": round(r.weight_pct, 1),
                    "Score (0-20)": r.numerical_0_20,
                    "Points Earned": round(r.scorecard_contribution, 1),
                    "Confidence": r.confidence.title(),
                    "Evidence / Notes": (r.comments_evidence or r.why)[:250],
                })
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

        st.subheader("Nearby Amenities")
        st.caption("Distances are actual driving distances when available, otherwise straight-line estimates.")
        summary_rows = format_summary_table(summary)
        st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)

        if merged_row:
            with st.expander("Tract-Level Data (from dataset)", expanded=False):
                display_cols = {}
                nice = {
                    "median_home_value": "Median Home Value",
                    "est_land_value": "Est. Land Value",
                    "median_hh_income": "Median Household Income",
                    "median_income": "Median Income",
                    "median_year_built": "Median Year Built",
                    "lmi_pct": "LMI Population %",
                    "poverty_pct": "Poverty Rate %",
                    "unemployment_pct": "Unemployment %",
                    "pct_obesity": "Obesity %",
                    "pct_diabetes": "Diabetes %",
                    "pct_asthma": "Asthma %",
                    "pct_high_bp": "High Blood Pressure %",
                    "pct_depression": "Depression %",
                    "is_qct": "Qualified Census Tract",
                    "is_opportunity_zone": "Opportunity Zone",
                    "flood_zone_pct": "Flood Zone %",
                    "vacant_lot_pct": "Vacant Lot %",
                    "total_population": "Total Population",
                }
                for k, label in nice.items():
                    v = merged_row.get(k)
                    if v is not None and not (isinstance(v, float) and pd.isna(v)):
                        if isinstance(v, float) and v == int(v) and k not in ("lmi_pct", "poverty_pct", "unemployment_pct", "pct_obesity", "pct_diabetes", "pct_asthma", "pct_high_bp", "pct_depression", "flood_zone_pct", "vacant_lot_pct"):
                            display_cols[label] = f"{int(v):,}" if v > 100 else str(int(v))
                        elif isinstance(v, float):
                            display_cols[label] = f"{v:.1f}" if v < 100 else f"${v:,.0f}"
                        else:
                            display_cols[label] = str(v)
                st.json(display_cols)

        st.subheader("Map — Amenities Around the Property")
        st.caption("Click anywhere on the map to see coordinates you can paste into the Address field. Green = grocery, blue = pharmacy, purple = health care, dark green = park, orange = transit.")
        map_html = build_map(report)
        components.html(map_html, height=560, scrolling=False)

        with st.expander("Location details", expanded=False):
            st.write({
                "Address searched": geo.display_name,
                "Latitude": geo.lat,
                "Longitude": geo.lon,
                "Census tract (GEOID)": geoid,
                "Block FIPS": tract.block_fips,
            })

        st.markdown("---")
        st.subheader("Areas With Similar Scores")
        st.caption(f"Other census tracts in Fort Worth that scored close to this property's {pct:.1f}%. These could be alternative locations worth investigating.")
        similar = find_similar_tracts(scored_tracts, geoid, pct, score_range=12.0, max_results=6)
        if len(similar) == 0:
            st.info("No similar-scoring tracts found.")
        else:
            for i, (_, srow) in enumerate(similar.iterrows()):
                render_suggestion_card(srow, i, "sim")


if __name__ == "__main__":
    main()
