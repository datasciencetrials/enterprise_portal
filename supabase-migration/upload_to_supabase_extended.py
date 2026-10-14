"""
Uganda National Roads Management Platform
ETL Script (extension): Upload remaining app_data/*.json → Supabase

This is a companion to the existing `upload_to_supabase.py` (which already
loads traffic_count_stations, tis_counts, atc_monthly_summary,
aadt_projections, drive_inventory). This script covers the next batch of
tables — the ones with a verified, direct field-for-field match against a
real file in app_data/, checked by inspecting the actual JSON before writing
any mapping below. No table here is populated with guessed or fabricated
field names.

Tables covered (16):
  road_links                 <- network_links.json
  road_link_condition        <- link_condition_lookup.json
  maintenance_programme      <- maintenance_programme.json -> all_links
  regional_pms_performance   <- regional_performance.json
  maintenance_stations       <- maintenance_stations.json
  budget_alignment           <- budget_alignment.json
  network_stats              <- network_stats.json  (singleton row, id=1)
  traffic_growth_factors     <- growth_factors_summary.json -> monthly_factors
  bridge_works                <- bridge_works_2026.json
  ml_model_metrics           <- ml_model_metrics.json
  image_defect_detections    <- image_defects_summary.json -> top_damaged_links
  image_defect_summary       <- image_defects_summary.json (top-level)
  romdas_calibration_summary <- romdas_calibration.json (top-level + .calibration)
  romdas_maintenance_events  <- romdas_calibration.json -> maintenance_events
  link_iri_predictions       <- romdas_predictions.json -> link_predictions
  surveyed_link_condition    <- bot_results.json -> Q01[]  (only Q01's shape
                                 matches this table's columns; Q03/Q09/Q10/Q11/
                                 Q16/Q20 are other bot queries with different
                                 shapes and are intentionally NOT loaded here)
  structures                 <- bridges_summary.json -> bridges_geojson.features[]
                                 + culverts_geojson.features[]  (see NOTE below)
  overloading_by_link        <- overloading_summary.json -> link_risk_map{},
                                 joined against network_links.json for
                                 link_name/region  (see NOTE below)

NOTE on `structures`: the source `id` property is literally "-" (a placeholder,
not a real id) for many bridges — it is NOT usable as the table's primary key
as-is. This script builds a synthetic id from real, already-present fields
(`{type}_{road}_{index}`, e.g. "bridge_A002_0") wherever the source id is
missing or "-", and uses the real source id otherwise. This is a constructed
key from real attributes, not a fabricated fact — flagged here so it's an
informed choice, not a silent one.

A SEPARATE, genuine data-quality issue was found while verifying this
mapping: 19 bridge records and 2 culvert records in bridges_summary.json
share the same real (non-"-") source id across 2-3 physically distinct
structures (e.g. "B010" appears 3 times, each a different bridge). Rather
than let a plain upsert silently overwrite two of every three, this script
keeps the real id on the first occurrence and appends "#2"/"#3" to later
ones — visible and traceable, not hidden. Whoever owns the source data may
want to investigate why those ids repeat. `condition_rating` is derived from the
source's text band (Critical/Poor/Fair/Good) via the 1-5 scale documented in
the table's own SQL comment; no "Very Good"/5 band exists in this source data
so 5 is never emitted by this mapping. Columns with no equivalent in the
source (no_of_spans, no_of_lanes, no_of_piers, material, crossing_type,
surface_type, maintenance_area, river, next_inspection, inspection_due,
traffic_level, strategic_importance, priority_score, priority_rank,
estimated_replacement_cost, defects, notes) are left NULL, not guessed.

NOTE on `overloading_by_link`: the source's `link_risk_map` values are
{rc, idx, hpct, esal} — `rc` (risk category) and `idx` (a 0-100 risk index)
map cleanly to `risk_category` and `risk_score`. `hpct` (HGV %) and `esal`
(an absolute daily-ESAL magnitude) do NOT semantically match the table's
`overload_pct` / `esal_factor` columns (which read as a percentage-overloaded
and a per-vehicle-class multiplier, respectively) — rather than force a
wrong-unit value into those columns, this script leaves them NULL.

Tables intentionally NOT covered (need more work before they can be ETL'd
safely — see NOT_YET_MAPPED.md written alongside this script):
  structure_condition_history, inspections, work_orders,
  bridge_documents, project_tracker, budget_fy_summary,
  ppp_projects, maintenance_cost_matrix, road_reserve_records,
  road_reserve_encroachments, road_reserve_gazette, global_case_studies,
  lifecycle_links, lifecycle_interventions, hdm4_calibration,
  hdm4_iri_thresholds

Tables intentionally EXCLUDED from any live/public wiring (PII):
  road_reserve_applicants, road_reserve_applications

Prerequisites:
  1. supabase_schema.sql already run in the Supabase SQL editor.
  2. Set two environment variables before running (never hardcode them here):
       SUPABASE_URL="https://<your-ref>.supabase.co"
       SUPABASE_KEY="<your CURRENT anon key, after rotation>"
  3. Python 3.8+, standard library only.

Usage:
    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_KEY="xxxx"
    python upload_to_supabase_extended.py --data-dir /path/to/app_data
"""

import json
import os
import sys
import time
import argparse
import urllib.request
import urllib.error
from pathlib import Path

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "Missing SUPABASE_URL / SUPABASE_KEY environment variables.\n"
        "Set them before running, e.g.:\n"
        '  export SUPABASE_URL="https://your-ref.supabase.co"\n'
        '  export SUPABASE_KEY="your-current-anon-key"\n'
    )

REST_BASE = f"{SUPABASE_URL}/rest/v1"
BATCH_SIZE = 500
RETRY_WAIT = 5
MAX_RETRIES = 3


def _headers(prefer: str = "return=minimal,resolution=merge-duplicates") -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def post_batch(table: str, rows: list, attempt: int = 1) -> int:
    url = f"{REST_BASE}/{table}"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=_headers(), method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        if e.code == 429 and attempt <= MAX_RETRIES:
            print(f"    Rate-limited — waiting {RETRY_WAIT}s (attempt {attempt}/{MAX_RETRIES})")
            time.sleep(RETRY_WAIT)
            return post_batch(table, rows, attempt + 1)
        body_txt = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} on {table}: {body_txt[:400]}") from e


def upsert_table(table: str, records: list):
    if not records:
        print(f"  [SKIP] No records for {table}")
        return
    total = len(records)
    uploaded = 0
    for i in range(0, total, BATCH_SIZE):
        chunk = records[i : i + BATCH_SIZE]
        status = post_batch(table, chunk)
        uploaded += len(chunk)
        pct = uploaded / total * 100
        print(f"  {table:<28} {uploaded:>7,}/{total:,}  ({pct:.0f}%)  HTTP {status}")
    print(f"  ✓ {table} — {uploaded:,} rows done")


def load_json(path: Path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        n = len(data) if hasattr(data, "__len__") else 1
        print(f"  Loaded {n:>7,} from {path.name}")
        return data
    except FileNotFoundError:
        print(f"  [SKIP] {path.name} not found")
        return None
    except Exception as e:
        print(f"  [ERROR] {path.name}: {e}")
        return None


# ── road_links --------------------------------------------------------------
def upload_road_links(data_dir: Path):
    records = load_json(data_dir / "network_links.json") or []
    rows = [
        {
            "link_id": r.get("link_id", ""),
            "road_no": r.get("road_no", ""),
            "road_class": r.get("road_class", ""),
            "link_name": r.get("link_name", ""),
            "chainage_from": r.get("chainage_from"),
            "chainage_to": r.get("chainage_to"),
            "length_km": r.get("length_km"),
            "surface_type": r.get("surface_type", ""),
            "maintenance_station": r.get("maintenance_station", ""),
            "maintenance_region": r.get("maintenance_region", ""),
            "completion_year": r.get("completion_year"),
            "rehab_year": r.get("rehab_year"),
            "last_intervention": r.get("last_intervention"),
            "funder": r.get("funder"),
            "ndpiv_1": r.get("ndpiv_1"),
            "ndpiv_2": r.get("ndpiv_2"),
            "oprc": r.get("oprc"),
            "ndpiv_oprc": r.get("ndpiv_oprc"),
            "comments": r.get("comments"),
        }
        for r in records if r.get("link_id")
    ]
    upsert_table("road_links", rows)


# ── road_link_condition -------------------------------------------------------
def upload_road_link_condition(data_dir: Path):
    lookup = load_json(data_dir / "link_condition_lookup.json") or {}
    rows = []
    for link_id, rec in lookup.items():
        if not isinstance(rec, dict) or not rec.get("year"):
            continue
        rows.append({
            "link_id": link_id,
            "survey_year": rec.get("year"),
            "iri": rec.get("iri"),
            "rut_mm": rec.get("rut_mm"),
            "cracking": rec.get("cracking"),
            "pci": rec.get("pci"),
            "vci": rec.get("vci"),
            "surface": rec.get("surface"),
        })
    upsert_table("road_link_condition", rows)


# ── maintenance_programme -----------------------------------------------------
def upload_maintenance_programme(data_dir: Path):
    data = load_json(data_dir / "maintenance_programme.json") or {}
    records = data.get("all_links", [])
    rows = [
        {
            "link_id": r.get("link_id", ""),
            "intervention_year": r.get("intervention_year"),
            "intervention_type": r.get("intervention_type"),
            "length_km": r.get("length_km"),
            "estimated_cost_usd": r.get("estimated_cost_usd"),
            "priority_rank": r.get("priority_rank"),
            "priority_score": r.get("priority_score"),
            "current_iri": r.get("current_iri"),
            "condition_now": r.get("condition_now"),
            "condition_3yr": r.get("condition_3yr"),
            "data_source": r.get("data_source"),
        }
        for r in records if r.get("link_id") and r.get("intervention_year")
    ]
    upsert_table("maintenance_programme", rows)


# ── regional_pms_performance ---------------------------------------------------
def upload_regional_pms_performance(data_dir: Path):
    records = load_json(data_dir / "regional_performance.json") or []
    rows = [
        {
            "region_id": r.get("region_id"),
            "region": r.get("region", ""),
            "links": r.get("links"),
            "length_km": r.get("length_km"),
            "avg_iri": r.get("avg_iri"),
            "measured_links": r.get("measured_links"),
            "measured_pct": r.get("measured_pct"),
            "pms_cost_million": r.get("pms_cost_million"),
            "maintenance_stations": r.get("maintenance_stations"),
        }
        for r in records if r.get("region_id") is not None
    ]
    upsert_table("regional_pms_performance", rows)


# ── maintenance_stations -------------------------------------------------------
def upload_maintenance_stations(data_dir: Path):
    records = load_json(data_dir / "maintenance_stations.json") or []
    rows = [
        {"id": r.get("id"), "name": r.get("name", ""), "region_id": r.get("region_id"), "region": r.get("region", "")}
        for r in records if r.get("id") is not None
    ]
    upsert_table("maintenance_stations", rows)


# ── budget_alignment ------------------------------------------------------------
def upload_budget_alignment(data_dir: Path):
    records = load_json(data_dir / "budget_alignment.json") or []
    rows = [
        {
            "region_id": r.get("region_id"),
            "region_name": r.get("region_name", ""),
            "pms_links": r.get("pms_links"),
            "pms_need_million": r.get("pms_need_million"),
            "budget_allocated_million": r.get("budget_allocated_million"),
            "coverage_pct": r.get("coverage_pct"),
        }
        for r in records if r.get("region_id") is not None
    ]
    upsert_table("budget_alignment", rows)


# ── network_stats (singleton row) -----------------------------------------------
def upload_network_stats(data_dir: Path):
    d = load_json(data_dir / "network_stats.json")
    if not d:
        return
    by_class = d.get("by_class", {})
    by_region = d.get("by_region", {})
    row = {
        "id": 1,
        "total_links": d.get("total_links"),
        "total_km": d.get("total_km"),
        "official_km": d.get("official_km"),
        "paved_km": d.get("paved_km"),
        "unpaved_km": d.get("unpaved_km"),
        "paved_pct": d.get("paved_pct"),
        "total_bridges": d.get("bridges_total"),
        "class_km": {code: v.get("km") for code, v in by_class.items()},
        "class_links": {code: v.get("links") for code, v in by_class.items()},
        "region_km": {reg: v.get("km") for reg, v in by_region.items()},
        "region_links": {reg: v.get("links") for reg, v in by_region.items()},
        "data_vintage": d.get("generated_at") or d.get("data_vintage"),
    }
    upsert_table("network_stats", [row])


# ── traffic_growth_factors -------------------------------------------------------
def upload_traffic_growth_factors(data_dir: Path):
    d = load_json(data_dir / "growth_factors_summary.json") or {}
    records = d.get("monthly_factors", [])
    rows = [
        {
            "region": r.get("region", ""),
            "year": r.get("year"),
            "month": r.get("month"),
            "vehicle_class": r.get("vehicle_class", ""),
            "mef": r.get("mef"),
            "monthly_aadt": r.get("monthly_aadt"),
            "annual_aadt": r.get("annual_aadt"),
            "sample_days": r.get("sample_days"),
            # annual_growth_rate intentionally omitted: the source's
            # annual_growth[] array is keyed by (region, vehicle_class,
            # year_from, year_to) -- a different grain than this table's
            # (region, year, month, vehicle_class) rows. Left NULL rather
            # than guessed; a follow-up pass can join it in properly.
        }
        for r in records if r.get("region") and r.get("year") and r.get("month")
    ]
    upsert_table("traffic_growth_factors", rows)


# ── bridge_works -------------------------------------------------------------
def upload_bridge_works(data_dir: Path):
    records = load_json(data_dir / "bridge_works_2026.json") or []
    rows = [
        {
            "id": r.get("id", ""),
            "lot": r.get("lot"),
            "funder": r.get("funder"),
            "contractor": r.get("contractor"),
            "supervisor": r.get("supervisor"),
            "project_manager": r.get("project_manager"),
            "project_engineer": r.get("project_engineer"),
            "contract_sum_ugx": r.get("contract_sum_ugx"),
            "amount_certified_ugx": r.get("amount_certified_ugx"),
            "amount_paid_ugx": r.get("amount_paid_ugx"),
            "outstanding_ugx": r.get("outstanding_ugx"),
            "physical_progress_pct": r.get("physical_progress_pct"),
            "status": r.get("status"),
            "compensation": r.get("compensation"),
            "report_period": r.get("report_period"),
        }
        for r in records if r.get("id")
    ]
    upsert_table("bridge_works", rows)


# ── ml_model_metrics -------------------------------------------------------------
def upload_ml_model_metrics(data_dir: Path):
    d = load_json(data_dir / "ml_model_metrics.json")
    if not d:
        return
    row = {
        "model_name": d.get("model_name"),
        "model_type": d.get("model_type"),
        "r2_score": d.get("r2_score"),
        "rmse": d.get("rmse"),
        "mae": d.get("mae"),
        "baseline_rmse": d.get("baseline_rmse"),
        "improvement_pct": d.get("improvement_pct"),
        "training_samples": d.get("training_samples"),
        "test_samples": d.get("test_samples"),
        "features": d.get("features"),
        "training_date": d.get("training_date"),
        "status": d.get("status"),
    }
    upsert_table("ml_model_metrics", [row])


# ── image_defect_detections / image_defect_summary --------------------------------
def upload_image_defects(data_dir: Path):
    d = load_json(data_dir / "image_defects_summary.json")
    if not d:
        return
    detections = [
        {
            "link_id": r.get("link_id", ""),
            "dominant_defect": r.get("dominant_defect", ""),
            "image_count": r.get("image_count"),
            "avg_severity": r.get("avg_severity"),
        }
        for r in d.get("top_damaged_links", []) if r.get("link_id") and r.get("dominant_defect")
    ]
    upsert_table("image_defect_detections", detections)

    summary_row = {
        "model": d.get("model"),
        "images_processed": d.get("images_processed"),
        "defect_distribution": d.get("defect_distribution"),
        "severity_distribution": d.get("severity_distribution"),
        "generated_at": d.get("generated_at"),
    }
    upsert_table("image_defect_summary", [summary_row])


# ── romdas_calibration_summary / romdas_maintenance_events -----------------------
def upload_romdas_calibration(data_dir: Path):
    d = load_json(data_dir / "romdas_calibration.json")
    if not d:
        return
    calib = d.get("calibration", {})
    summary_row = {
        "generated_at": d.get("generated_at"),
        "links_analysed": d.get("links_analysed"),
        "maintenance_detected": d.get("maintenance_detected"),
        "naturally_deteriorating": d.get("naturally_deteriorating"),
        "hdm4_factor_current": calib.get("hdm4_factor_current"),
        "observed_calib_factor": calib.get("observed_calib_factor"),
        "prediction_rmse_m_km_yr": calib.get("prediction_rmse_m_km_yr"),
        "mean_error_m_km_yr": calib.get("mean_error_m_km_yr"),
        "note": calib.get("note"),
    }
    upsert_table("romdas_calibration_summary", [summary_row])

    events = [
        {
            "link_id": r.get("link_id", ""),
            "road_name": r.get("road_name"),
            "iri_2020": r.get("iri_2020"),
            "iri_2021": r.get("iri_2021"),
            "delta_iri": r.get("delta_iri"),
            "likely_treatment": r.get("likely_treatment"),
        }
        for r in d.get("maintenance_events", []) if r.get("link_id")
    ]
    upsert_table("romdas_maintenance_events", events)


# ── link_iri_predictions -------------------------------------------------------
def upload_link_iri_predictions(data_dir: Path):
    d = load_json(data_dir / "romdas_predictions.json")
    if not d:
        return
    generated_at = d.get("generated_at")
    records = d.get("link_predictions", [])
    rows = [
        {
            "link_id": r.get("link_id", ""),
            "predicted_iri_1yr": r.get("predicted_iri_1yr"),
            "predicted_iri_3yr": r.get("predicted_iri_3yr"),
            "predicted_iri_5yr": r.get("predicted_iri_5yr"),
            "predicted_condition_1yr": r.get("predicted_condition_1yr"),
            "predicted_condition_3yr": r.get("predicted_condition_3yr"),
            "deterioration_rate": r.get("deterioration_rate"),
            "intervention_year": r.get("intervention_year"),
            "generated_at": generated_at,
        }
        for r in records if r.get("link_id")
    ]
    upsert_table("link_iri_predictions", rows)


# ── structures (bridges_summary.json geojson features) ----------------------------
_CONDITION_RATING = {"Critical": 1, "Poor": 2, "Fair": 3, "Good": 4}


def _structure_rows_from_features(features, structure_type_label):
    # Two passes: first count how often each real (non-"-") source id
    # recurs. The bridges_summary.json source has genuine duplicate ids —
    # e.g. "B010" is reused across 2-3 physically distinct bridges, not a
    # placeholder collision like "-". Silently upserting these would drop
    # all but one record per id. Instead: the first occurrence keeps the
    # real id, and every later occurrence gets a visible "#2", "#3" suffix
    # so the collision is traceable rather than hidden.
    id_counts = {}
    for feat in features:
        raw_id = (feat.get("properties") or {}).get("id")
        if raw_id and raw_id != "-":
            id_counts[raw_id] = id_counts.get(raw_id, 0) + 1

    rows = []
    counters = {}
    seen_real_id = {}
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None]
        lon, lat = (coords + [None, None])[:2]

        raw_id = props.get("id")
        road = props.get("road", "")
        if raw_id and raw_id != "-":
            if id_counts[raw_id] > 1:
                seen_real_id[raw_id] = seen_real_id.get(raw_id, 0) + 1
                struct_id = raw_id if seen_real_id[raw_id] == 1 else f"{raw_id}#{seen_real_id[raw_id]}"
            else:
                struct_id = raw_id
        else:
            # Source id is a placeholder ("-") for this record; build a stable
            # synthetic key from real fields already on the record rather than
            # collide every "-" bridge onto one primary key.
            counters[(structure_type_label, road)] = counters.get((structure_type_label, road), -1) + 1
            struct_id = f"{structure_type_label}_{road or 'unknown'}_{counters[(structure_type_label, road)]}"

        rows.append({
            "id": struct_id,
            "name": props.get("name") or None,
            "structure_type": structure_type_label,   # 'bridge' | 'culvert'
            "road": road,
            "region": props.get("region"),
            "latitude": lat,
            "longitude": lon,
            "span_length_m": props.get("span_m"),
            "width_m": props.get("width_m"),
            "year_built": props.get("year_built"),
            "condition_rating": _CONDITION_RATING.get(props.get("condition")),
            "last_inspection": props.get("last_inspection"),
            "notes": props.get("road_name"),  # closest available descriptive text
        })
    return rows


def upload_structures(data_dir: Path):
    d = load_json(data_dir / "bridges_summary.json")
    if not d:
        return
    bridge_feats = (d.get("bridges_geojson") or {}).get("features", [])
    culvert_feats = (d.get("culverts_geojson") or {}).get("features", [])
    rows = (
        _structure_rows_from_features(bridge_feats, "bridge")
        + _structure_rows_from_features(culvert_feats, "culvert")
    )
    upsert_table("structures", rows)


# ── overloading_by_link (overloading_summary.json link_risk_map) ------------------
def upload_overloading_by_link(data_dir: Path):
    links = load_json(data_dir / "network_links.json") or []
    name_by_id = {r.get("link_id"): r.get("link_name") for r in links if r.get("link_id")}
    region_by_id = {r.get("link_id"): r.get("maintenance_region") for r in links if r.get("link_id")}

    d = load_json(data_dir / "overloading_summary.json")
    if not d:
        return
    risk_map = d.get("link_risk_map", {})
    rows = []
    for link_id, r in risk_map.items():
        if not isinstance(r, dict):
            continue
        rows.append({
            "link_id": link_id,
            "link_name": name_by_id.get(link_id),
            "region": region_by_id.get(link_id),
            "esal_factor": None,     # see module docstring NOTE — no unit-matching source field
            "overload_pct": None,    # see module docstring NOTE — no unit-matching source field
            "risk_score": r.get("idx"),
            "risk_category": r.get("rc"),
        })
    upsert_table("overloading_by_link", rows)


# ── surveyed_link_condition (bot_results.json -> Q01 only) ------------------------
def upload_surveyed_link_condition(data_dir: Path):
    d = load_json(data_dir / "bot_results.json")
    if not d:
        return
    q01 = d.get("Q01", [])
    rows = [
        {
            "query_code": "Q01",
            "link_id": r.get("link_id", ""),
            "road_name": r.get("road_name"),
            "region": r.get("region"),
            "surface": r.get("surface"),
            "length_km": r.get("length_km"),
            "iri": r.get("iri"),
            "pci": r.get("pci"),
        }
        for r in q01 if r.get("link_id")
    ]
    upsert_table("surveyed_link_condition", rows)
    if len(d.keys()) > 1:
        skipped = [k for k in d.keys() if k != "Q01"]
        print(f"  [NOTE] bot_results.json also has {skipped} — not loaded here, "
              f"different column shapes than surveyed_link_condition.")


# ── Main ------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Upload the next batch of Uganda Roads JSON data to Supabase")
    parser.add_argument("--data-dir", default=str(Path(__file__).parent), help="Folder containing app_data/*.json")
    args = parser.parse_args()
    data_dir = Path(args.data_dir)

    print(f"\nUganda National Roads — Supabase ETL (extension batch)")
    print(f"  Data directory : {data_dir.resolve()}")
    print(f"  Supabase URL   : {SUPABASE_URL}\n")

    steps = [
        ("road_links",               upload_road_links),
        ("road_link_condition",      upload_road_link_condition),
        ("maintenance_programme",    upload_maintenance_programme),
        ("regional_pms_performance", upload_regional_pms_performance),
        ("maintenance_stations",     upload_maintenance_stations),
        ("budget_alignment",         upload_budget_alignment),
        ("network_stats",            upload_network_stats),
        ("traffic_growth_factors",   upload_traffic_growth_factors),
        ("bridge_works",             upload_bridge_works),
        ("ml_model_metrics",         upload_ml_model_metrics),
        ("image_defect_detections/summary", upload_image_defects),
        ("romdas_calibration_summary/events", upload_romdas_calibration),
        ("link_iri_predictions",     upload_link_iri_predictions),
        ("surveyed_link_condition",  upload_surveyed_link_condition),
        ("structures",               upload_structures),
        ("overloading_by_link",      upload_overloading_by_link),
    ]

    for label, fn in steps:
        print(f"\n── {label} ──" + "─" * max(0, 40 - len(label)))
        fn(data_dir)

    print("\nDone.\n")


if __name__ == "__main__":
    main()
