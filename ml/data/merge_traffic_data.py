"""
Unified Traffic Data Pipeline  —  Uganda National Roads Authority
Merges all traffic data sources into a single master dataset per road link.

Sources:
  1. ATC permanent stations (14 stations, 2018-2022) – monthly ADT summaries
  2. New ATC stations (10 sites, 2025-26) – hourly data → daily ADT
  3. Manual traffic count surveys (2016-2021) – 7-day roadside counts
  4. Traffic count stations registry – 298 stations with Link_ID geometry

Outputs:
  ml/data/unified_traffic.csv    – master training dataset
  public/data/traffic_links.geojson – road links with observed traffic attributes
"""

import os, re, glob, json, warnings
from pathlib import Path
from difflib import SequenceMatcher

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from scipy.spatial import cKDTree

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
WKTREE   = Path(__file__).resolve().parent.parent.parent          # traffic-spatial-worktree/
ATC_ROOT = Path("D:/OneDrive/ATC/ATCs DATA/ATC analysis")
TRAFFIC  = Path("D:/OneDrive/Uganda National Road Network Repository/3.Traffic")
NET_SHP  = Path("D:/OneDrive/Uganda National Road Network Repository/8. Shapefiles/Roads/network2026/network2026.shp")
TCS_SHP  = Path("D:/OneDrive/Uganda National Road Network Repository/8. Shapefiles/Traffic count stations/Traffic_count_stations/Traffic_count_stations.shp")
ATC2025_SHP = Path("D:/OneDrive/ATC/ATC2025.shp")
ATC2526_XLS = Path("D:/OneDrive/ATC/ATCs DATA/ATC analysis/ATC 2025-26/ATC Data analysis 25_26.xlsx")

OUT_ML  = WKTREE / "ml" / "data"
OUT_PUB = WKTREE / "public" / "data"
OUT_ML.mkdir(parents=True, exist_ok=True)
OUT_PUB.mkdir(parents=True, exist_ok=True)

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

# ─── Name Normalisation ───────────────────────────────────────────────────────
def _norm(s: str) -> str:
    s = str(s).lower().strip()
    s = re.sub(r"[-/\s]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s

def fuzzy_match(query: str, candidates: list[str], threshold: float = 0.55) -> str | None:
    q = _norm(query)
    best_score, best = 0.0, None
    for c in candidates:
        score = SequenceMatcher(None, q, _norm(c)).ratio()
        if score > best_score:
            best_score, best = score, c
    return best if best_score >= threshold else None

# ─── 1. Load Traffic Count Station Registry ───────────────────────────────────
def load_tcs_registry() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(TCS_SHP).to_crs("EPSG:4326")
    gdf.rename(columns={
        "TCS_NAME": "tcs_name",
        "Link_ID":  "link_id",
        "Link_Name":"link_name",
        "LAT":      "lat",
        "LON":      "lon",
        "STATION":  "station",
        "REGION":   "region",
    }, inplace=True)
    gdf["lat"] = pd.to_numeric(gdf["lat"], errors="coerce")
    gdf["lon"] = pd.to_numeric(gdf["lon"], errors="coerce")
    return gdf[["tcs_name","link_id","link_name","lat","lon","station","region","geometry"]].copy()

# ─── 2. Load Road Network ─────────────────────────────────────────────────────
def load_road_network() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(NET_SHP).to_crs("EPSG:4326")
    gdf.rename(columns={
        "Link_ID_1":  "link_id",
        "Road_No_1":  "road_no",
        "Road_Cla_1": "road_class",
        "Link_Name":  "link_name",
        "Length_km_": "length_km",
        "Surface__1": "surface_type",
        "Maintena_2": "maintenance_station",
        "Maintena_3": "region",
        "StartX":     "start_x",
        "StartY":     "start_y",
        "EndX":       "end_x",
        "EndY":       "end_y",
    }, inplace=True)
    return gdf[["link_id","road_no","road_class","link_name","length_km",
                "surface_type","maintenance_station","region",
                "start_x","start_y","end_x","end_y","geometry"]].copy()

# ─── 3. Parse ATC Permanent Summaries (2018-2022) ─────────────────────────────
def _parse_summary_sheet(df: pd.DataFrame, year: int) -> list[dict]:
    """Extract monthly ADT from the summary sheet (one col per month)."""
    records = []
    # Row 0 is the month header row; rows 1+ are stations
    name_col = None
    for c in df.columns:
        if "station" in str(c).lower() or "road" in str(c).lower() or "link" in str(c).lower():
            name_col = c
            break
    if name_col is None:
        return records

    month_cols = [c for c in df.columns if c not in [name_col, "No", df.columns[0]]][:12]

    for _, row in df.iloc[1:].iterrows():
        name = row.get(name_col, None)
        if pd.isna(name) or not str(name).strip():
            continue
        name = str(name).strip()
        for i, mc in enumerate(month_cols):
            val = row.get(mc, None)
            try:
                val = float(val)
            except (TypeError, ValueError):
                continue
            if val > 0 and not np.isnan(val):
                # Exclude COVID lockdown months (April-July 2020)
                if year == 2020 and (i + 1) in (4, 5, 6, 7):
                    continue
                records.append({
                    "station_name": name,
                    "year": year,
                    "month": i + 1,
                    "AADT": val,
                    "data_source": "ATC_permanent",
                })
    return records

def _parse_monthly_classification(filepath: Path, year: int) -> dict:
    """
    Extract vehicle classification from monthly sheets.
    Returns {(station_name, month_num): {AADT_motorcycles, AADT_cars, AADT_buses, AADT_heavy}}.
    """
    cls_map = {}
    try:
        xf = pd.ExcelFile(filepath)
    except Exception:
        return cls_map

    for sh in xf.sheet_names:
        m = re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", sh, re.I)
        if not m:
            continue
        month_num = MONTHS.index(m.group(1).capitalize()) + 1

        try:
            df = pd.read_excel(filepath, sheet_name=sh, header=None)
        except Exception:
            continue

        # Find the header row and data rows
        # Expected: row with 'No', 'Road name', 'ADT', ...
        header_row = None
        for ri in range(min(5, len(df))):
            row0 = df.iloc[ri].astype(str).str.lower()
            if any("road" in v or "station" in v for v in row0.values):
                header_row = ri
                break
        if header_row is None:
            continue

        df.columns = df.iloc[header_row].tolist()
        df = df.iloc[header_row + 1:].reset_index(drop=True)

        # Find name and ADT columns by position (cols 1 and 2)
        for _, row in df.iterrows():
            try:
                name = str(row.iloc[1]).strip()
                raw_adt = row.iloc[2]
                # Skip Timestamp values (month header row leaked in)
                if hasattr(raw_adt, 'strftime'):
                    continue
                adt  = float(raw_adt)
                if not name or name in ("nan", "None") or adt <= 0:
                    continue
                # Vehicle classes: cols 3,4,5,6,7 (Dir1) and 9,10,11,12,13 (Dir2)
                def _v(idx):
                    try:
                        return max(0.0, float(row.iloc[idx]))
                    except Exception:
                        return 0.0
                moto  = _v(3) + _v(9)
                cars  = _v(4) + _v(10) + _v(5) + _v(11)   # saloon + minibus
                buses = _v(6) + _v(12)
                heavy = _v(7) + _v(13)
                total = moto + cars + buses + heavy
                if total > 0:
                    cls_map[(name, month_num)] = {
                        "AADT_motorcycles": moto,
                        "AADT_cars": cars,
                        "AADT_buses": buses,
                        "AADT_heavy": heavy,
                    }
            except (IndexError, ValueError):
                continue
    return cls_map

def load_atc_permanent(tcs_reg: gpd.GeoDataFrame) -> list[dict]:
    """Load ATC permanent station data for 2018-2022."""
    records = []
    link_names = tcs_reg["link_name"].dropna().tolist()

    # Name → Link_ID lookup cache
    name_cache: dict[str, str | None] = {}

    def resolve_link(name: str) -> tuple[str | None, str | None, float | None, float | None, str | None]:
        if name not in name_cache:
            matched = fuzzy_match(name, link_names)
            if matched:
                row = tcs_reg.loc[tcs_reg["link_name"] == matched].iloc[0]
                name_cache[name] = (row["link_id"], row["tcs_name"],
                                    row["lat"], row["lon"], row["region"])
            else:
                name_cache[name] = (None, None, None, None, None)
        return name_cache[name]

    for year in range(2018, 2023):
        year_dir = ATC_ROOT / f"ATC {year}"
        if not year_dir.exists():
            continue

        # Find the summary Excel
        summary_candidates = (
            list(year_dir.glob("ATC DATA SUMMARY*.xlsx")) +
            list(year_dir.glob("ATC Data Summary*.xlsx"))
        )
        # Also search subdirs
        for subdir in year_dir.iterdir():
            if subdir.is_dir():
                summary_candidates += (
                    list(subdir.glob("ATC DATA SUMMARY*.xlsx")) +
                    list(subdir.glob("ATC Data Summary*.xlsx"))
                )

        cls_maps = []
        for summary_path in summary_candidates:
            cls_maps.append(_parse_monthly_classification(summary_path, year))

        merged_cls = {}
        for cm in cls_maps:
            merged_cls.update(cm)

        for summary_path in summary_candidates:
            try:
                xf = pd.ExcelFile(summary_path)
            except Exception:
                continue
            for sh in xf.sheet_names:
                if "summary" in sh.lower():
                    try:
                        df = pd.read_excel(summary_path, sheet_name=sh)
                        rows = _parse_summary_sheet(df, year)
                        for r in rows:
                            link_id, tcs_name, lat, lon, region = resolve_link(r["station_name"])
                            if link_id is None:
                                continue
                            r.update({
                                "link_id": link_id,
                                "station_id": tcs_name or f"ATC_{r['station_name'][:8]}",
                                "road_name": r["station_name"],
                                "lat": lat,
                                "lon": lon,
                                "region": region,
                            })
                            # Add vehicle classification if available
                            cls = merged_cls.get((r["station_name"], r["month"]), {})
                            r.update({
                                "AADT_motorcycles": cls.get("AADT_motorcycles", np.nan),
                                "AADT_cars":        cls.get("AADT_cars", np.nan),
                                "AADT_buses":       cls.get("AADT_buses", np.nan),
                                "AADT_heavy":       cls.get("AADT_heavy", np.nan),
                            })
                            records.append(r)
                    except Exception as e:
                        print(f"  [warn] {summary_path.name}/{sh}: {e}")

    print(f"  ATC permanent: {len(records)} monthly records")
    return records

# ─── 4. Load New ATC Stations (2025-26) ───────────────────────────────────────
def load_atc_new() -> list[dict]:
    """Load 10 new ATC station records from 2025-26 analysis file."""
    records = []
    if not ATC2526_XLS.exists():
        print("  [warn] ATC 2025-26 file not found")
        return records

    try:
        sites_df = pd.read_excel(ATC2526_XLS, sheet_name="ATC sites")
    except Exception as e:
        print(f"  [warn] Could not read ATC sites sheet: {e}")
        return records

    for _, row in sites_df.iterrows():
        site_code = str(row.get("Site Code", "")).strip()
        road      = str(row.get("Road Section", "")).strip()
        lat       = float(row.get("Latitude (Y)", 0) or 0)
        lon       = float(row.get("Longitude (X)", 0) or 0)
        road_adt  = row.get("Road_ADT", None)
        light     = row.get("Road_Light", None)
        heavy     = row.get("Road_Heavy", None)

        if not site_code or not lat:
            continue

        try:
            road_adt = float(road_adt) if pd.notna(road_adt) else None
            light    = float(light)    if pd.notna(light)    else None
            heavy    = float(heavy)    if pd.notna(heavy)    else None
        except (TypeError, ValueError):
            continue

        if road_adt is None or road_adt <= 0:
            continue

        total = (light or 0) + (heavy or 0)
        heavy_pct = (heavy / total * 100) if total > 0 else np.nan

        records.append({
            "station_id":  site_code,
            "station_name": road,
            "road_name":   road,
            "lat":  lat,
            "lon":  lon,
            "year": 2025,
            "month": 7,     # survey started July 2025
            "AADT": road_adt,
            "AADT_motorcycles": np.nan,
            "AADT_cars":  light if light else np.nan,
            "AADT_buses": np.nan,
            "AADT_heavy": heavy if heavy else np.nan,
            "heavy_pct": heavy_pct,
            "data_source": "ATC_new",
            "link_id": None,   # will be filled by spatial join
            "region": None,
        })

    print(f"  ATC new (2025-26): {len(records)} site records")
    return records

# ─── 5. Parse Manual Traffic Count Files ─────────────────────────────────────
def _extract_aadt_from_count_file(filepath: Path) -> float | None:
    """
    Extract AADT from a 7-day manual traffic count xls.
    Looks for the NTWKDAY row total in the ANALYSIS sheet.
    """
    try:
        df = pd.read_excel(filepath, sheet_name="ANALYSIS", engine="xlrd", header=None)
    except Exception:
        try:
            df = pd.read_excel(filepath, engine="xlrd", header=None)
        except Exception:
            return None

    # Scan for a row containing "TOTAL" or the highest numeric row sum
    for ri in range(len(df)):
        row = df.iloc[ri]
        row_str = " ".join(str(v).lower() for v in row.values)
        if "total" in row_str and "motorised" not in row_str:
            # Find numeric values in this row
            nums = [float(v) for v in row.values if _is_pos_num(v)]
            # AADT ≈ average of weekday columns (Mon-Fri)
            if len(nums) >= 7:
                # Cols typically: Mon Tue Wed Thu Fri Sat Sun + NTWKDAY NTWKEND
                weekday_avg = np.mean(nums[:5])
                if 10 < weekday_avg < 200_000:
                    return weekday_avg
            elif len(nums) > 0:
                avg = np.mean(nums)
                if 10 < avg < 200_000:
                    return avg
    return None

def _is_pos_num(v) -> bool:
    try:
        f = float(v)
        return f > 0 and not np.isnan(f) and not np.isinf(f)
    except (TypeError, ValueError):
        return False

def _link_id_from_filename(fname: str) -> str | None:
    """
    Extract TCS_NAME (e.g. A00121) from a filename like
    'Traffic Count Data - A00121 Jinja-Kakira Junction.xls'.
    """
    m = re.search(r"\b([A-Z]\d{3,5})\b", fname)
    return m.group(1) if m else None

def load_manual_counts(tcs_reg: gpd.GeoDataFrame, max_files: int = 600) -> list[dict]:
    """Scan manual count files and extract AADT per link."""
    records = []
    tcs_lookup = {
        row["tcs_name"]: row for _, row in tcs_reg.iterrows()
    }

    # Glob all traffic count xls files
    patterns = [
        str(TRAFFIC / "**" / "Traffic Count Data*.xls"),
        str(TRAFFIC / "**" / "Traffic Count Data*.xlsx"),
        str(TRAFFIC / "**" / "TrafficCount*.xls"),
    ]
    files = []
    for pat in patterns:
        files += glob.glob(pat, recursive=True)

    files = files[:max_files]
    parsed = 0

    for fpath in files:
        fname  = Path(fpath).stem
        tcs_id = _link_id_from_filename(fname)
        if tcs_id is None:
            continue

        # Infer year from directory name
        yr_m = re.search(r"20(\d\d)", fpath)
        year = int("20" + yr_m.group(1)) if yr_m else 2020

        aadt = _extract_aadt_from_count_file(Path(fpath))
        if aadt is None or aadt <= 0:
            continue

        reg_row = tcs_lookup.get(tcs_id)
        if reg_row is None:
            continue

        records.append({
            "station_id":   tcs_id,
            "station_name": reg_row["link_name"],
            "road_name":    reg_row["link_name"],
            "link_id":      reg_row["link_id"],
            "lat":          reg_row["lat"],
            "lon":          reg_row["lon"],
            "region":       reg_row["region"],
            "year":         year,
            "month":        6,      # survey month often not recoverable from filename
            "AADT":         aadt,
            "AADT_motorcycles": np.nan,
            "AADT_cars":        np.nan,
            "AADT_buses":       np.nan,
            "AADT_heavy":       np.nan,
            "data_source": "manual_count",
        })
        parsed += 1

    print(f"  Manual counts: {parsed} records from {len(files)} files")
    return records

# ─── 6. Spatial Join for New ATC Sites ────────────────────────────────────────
def assign_links_spatial(records: list[dict], net: gpd.GeoDataFrame) -> list[dict]:
    """
    For records with lat/lon but no link_id, assign nearest road link.
    Uses KD-tree on link centroids for speed.
    """
    # Build centroid array from road network
    centroids_lat = net.geometry.centroid.y.values
    centroids_lon = net.geometry.centroid.x.values
    link_ids      = net["link_id"].values
    link_names    = net["link_name"].values
    regions       = net["region"].values if "region" in net.columns else [""] * len(net)

    coords_arr = np.column_stack([centroids_lat, centroids_lon])
    kd = cKDTree(coords_arr)

    assigned = 0
    for r in records:
        if r.get("link_id"):
            continue
        lat = float(r.get("lat") or 0)
        lon = float(r.get("lon") or 0)
        if not lat or not lon:
            continue
        _, idx = kd.query([lat, lon], k=1)
        r["link_id"]   = str(link_ids[idx])
        r["road_name"] = r.get("road_name") or str(link_names[idx])
        r["region"]    = r.get("region")    or str(regions[idx])
        assigned += 1

    print(f"  Spatial join: assigned {assigned} link_ids")
    return records

# ─── 7. Compute Derived Fields ────────────────────────────────────────────────
def compute_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Add heavy_pct, AADT_trucks, peak_hour_factor, growth_rate."""

    # heavy_pct
    df["heavy_pct"] = np.where(
        df["heavy_pct"].isna() & df["AADT"].notna() & df["AADT_heavy"].notna(),
        df["AADT_heavy"] / df["AADT"].replace(0, np.nan) * 100,
        df["heavy_pct"]
    )
    df["heavy_pct"] = df["heavy_pct"].fillna(
        df.groupby("region")["heavy_pct"].transform("median")
    )
    df["heavy_pct"] = df["heavy_pct"].clip(0, 60)

    # AADT_trucks ≈ 50% of heavy (rest = buses)
    df["AADT_trucks"] = df["AADT_heavy"] * 0.5

    # Peak hour factor — typical Uganda value ~0.11 (AM peak ≈ 11% daily)
    df["peak_hour_factor"] = 0.11

    # Annual growth rate — CAGR from consecutive year observations per link
    df = df.sort_values(["link_id", "year", "month"])
    df["growth_rate"] = np.nan

    for lid, grp in df.groupby("link_id"):
        annual = grp.groupby("year")["AADT"].mean().dropna()
        if len(annual) >= 2:
            years  = annual.index.values
            aadts  = annual.values
            if len(years) > 1 and aadts[0] > 0:
                n    = years[-1] - years[0]
                cagr = (aadts[-1] / aadts[0]) ** (1 / n) - 1 if n > 0 else 0
                df.loc[df["link_id"] == lid, "growth_rate"] = round(cagr * 100, 2)

    # Fill missing growth_rate with Uganda national avg (~6.5% p.a.)
    df["growth_rate"] = df["growth_rate"].fillna(6.5)

    return df

# ─── 8. Build Output GeoJSON ──────────────────────────────────────────────────
def build_traffic_links_geojson(df: pd.DataFrame, net: gpd.GeoDataFrame) -> None:
    """Create traffic_links.geojson — road links with observed traffic data."""
    # Aggregate to one record per link (latest year, annual AADT mean)
    agg = (
        df.dropna(subset=["link_id", "AADT"])
          .groupby("link_id")
          .agg(
              AADT=("AADT", "mean"),
              AADT_motorcycles=("AADT_motorcycles", "mean"),
              AADT_cars=("AADT_cars", "mean"),
              AADT_buses=("AADT_buses", "mean"),
              AADT_heavy=("AADT_heavy", "mean"),
              heavy_pct=("heavy_pct", "mean"),
              growth_rate=("growth_rate", "mean"),
              year_max=("year", "max"),
              data_source=("data_source", "first"),
              road_name=("road_name", "first"),
              lat=("lat", "first"),
              lon=("lon", "first"),
              region=("region", "first"),
          )
          .reset_index()
    )

    # Join to road network geometry
    merged = net.merge(agg, on="link_id", how="left")

    # Round numeric columns
    for col in ["AADT","AADT_motorcycles","AADT_cars","AADT_buses","AADT_heavy","heavy_pct","growth_rate"]:
        if col in merged.columns:
            merged[col] = merged[col].round(1)

    out_path = OUT_PUB / "traffic_links.geojson"
    merged.to_file(out_path, driver="GeoJSON")
    print(f"  Saved traffic_links.geojson ({len(merged)} links, {agg.shape[0]} with observed data)")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Uganda National Roads — Traffic Data Merge Pipeline")
    print("=" * 60)

    print("\n[1] Loading spatial registries …")
    tcs  = load_tcs_registry()
    net  = load_road_network()
    print(f"    TCS registry: {len(tcs)} stations | Road network: {len(net)} links")

    print("\n[2] Loading ATC permanent stations (2018-2022) …")
    atc_perm = load_atc_permanent(tcs)

    print("\n[3] Loading new ATC stations (2025-26) …")
    atc_new = load_atc_new()

    print("\n[4] Loading manual traffic counts (2016-2021) …")
    manual = load_manual_counts(tcs)

    print("\n[5] Combining all records …")
    all_records = atc_perm + atc_new + manual
    df = pd.DataFrame(all_records)

    COLS = [
        "link_id","station_id","road_name","lat","lon",
        "year","month","AADT",
        "AADT_motorcycles","AADT_cars","AADT_buses","AADT_trucks","AADT_heavy",
        "heavy_pct","peak_hour_factor","growth_rate","data_source","region",
    ]
    for c in COLS:
        if c not in df.columns:
            df[c] = np.nan

    print(f"    Total records before dedup: {len(df)}")

    print("\n[6] Spatial join for new ATC sites …")
    records_list = df.to_dict("records")
    records_list = assign_links_spatial(records_list, net)
    df = pd.DataFrame(records_list)

    print("\n[7] Computing derived fields …")
    df = compute_derived(df)

    # Deduplicate: keep best (highest-priority) source per link+year+month
    source_priority = {"ATC_permanent": 0, "ATC_new": 1, "manual_count": 2}
    df["_pri"] = df["data_source"].map(source_priority).fillna(3)
    df = df.sort_values("_pri").drop_duplicates(subset=["link_id","year","month"]).drop(columns="_pri")

    print(f"    Records after dedup: {len(df)}")
    print(f"    Unique links with data: {df['link_id'].nunique()}")
    print(f"    Year range: {df['year'].min():.0f} – {df['year'].max():.0f}")

    df[COLS].to_csv(OUT_ML / "unified_traffic.csv", index=False)
    print(f"\n  Saved: ml/data/unified_traffic.csv")

    print("\n[8] Building traffic_links.geojson …")
    build_traffic_links_geojson(df, net)

    print("\n✓  Data merge complete.")

if __name__ == "__main__":
    main()
