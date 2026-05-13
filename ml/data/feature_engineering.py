"""
Feature Engineering for Uganda Traffic Prediction Model

Input:  ml/data/unified_traffic.csv
Output: ml/data/features.csv

Features:
  Temporal  — year, month, is_dry_season, year_norm
  Spatial   — road_class_enc, region_enc, dist_kampala_km, dist_nearest_major_town_km
  Network   — length_km, surface_enc, betweenness_proxy
  Lag       — spatial_lag_aadt_k3, spatial_lag_aadt_k5, station_mean_aadt
  Growth    — growth_rate, gdp_growth_proxy
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.spatial import cKDTree

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
WKTREE  = Path(__file__).resolve().parent.parent.parent
ML_DATA = WKTREE / "ml" / "data"
NET_SHP = Path("D:/OneDrive/Uganda National Road Network Repository/8. Shapefiles/Roads/network2026/network2026.shp")
TCS_SHP = Path("D:/OneDrive/Uganda National Road Network Repository/8. Shapefiles/Traffic count stations/Traffic_count_stations/Traffic_count_stations.shp")

# Uganda GDP growth proxy (World Bank data, % p.a.)
GDP_GROWTH = {
    2016: 4.7, 2017: 3.9, 2018: 6.2, 2019: 8.0,
    2020: 3.0, 2021: 3.3, 2022: 5.3, 2023: 5.9,
    2024: 6.2, 2025: 6.4,
}

# Uganda public holidays (month only — for monthly-level data)
HOLIDAY_MONTHS = {1, 6}  # Jan (New Year), June (Eid/Liberation Day peak)

# Dry season in Uganda: Dec-Feb (NE trades) + Jun-Aug (SW monsoon break)
DRY_MONTHS = {12, 1, 2, 6, 7, 8}

# Major towns (lat, lon) for distance feature
MAJOR_TOWNS = {
    "Kampala":    (0.3163,  32.5822),
    "Gulu":       (2.7745,  32.2990),
    "Mbarara":    (-0.6079, 30.6545),
    "Jinja":      (0.4244,  33.2041),
    "Mbale":      (1.0753,  34.1753),
    "Soroti":     (1.7143,  33.6126),
    "Arua":       (3.0200,  30.9108),
    "Lira":       (2.2499,  32.9021),
    "Fort Portal":(0.6710,  30.2750),
    "Masaka":     (-0.3333, 31.7333),
}
KAMPALA_LAT, KAMPALA_LON = MAJOR_TOWNS["Kampala"]


def _haversine(lat1, lon1, lat2: float, lon2: float):
    R = 6371.0
    lat1 = np.asarray(lat1, dtype=float)
    lon1 = np.asarray(lon1, dtype=float)
    dlat = np.radians(float(lat2) - lat1)
    dlon = np.radians(float(lon2) - lon1)
    a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(float(lat2))) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    df["is_dry_season"]   = df["month"].isin(DRY_MONTHS).astype(int)
    df["is_holiday_month"]= df["month"].isin(HOLIDAY_MONTHS).astype(int)
    df["year_norm"]       = (df["year"] - 2016) / (2025 - 2016)
    df["month_sin"]       = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"]       = np.cos(2 * np.pi * df["month"] / 12)
    df["gdp_proxy"]       = df["year"].map(GDP_GROWTH).fillna(6.0)
    return df


def add_spatial_features(df: pd.DataFrame, net: gpd.GeoDataFrame) -> pd.DataFrame:
    # Road class encoding
    class_map = {"A": 4, "B": 3, "C": 2, "M": 5, "D": 1}
    df["road_class_enc"] = df["road_class"].map(class_map).fillna(1).astype(int)

    # Region encoding
    region_map = {"Central": 0, "Eastern": 1, "East": 1,
                  "Northern": 2, "North": 2, "North East": 2,
                  "Western": 3, "West": 3, "South": 3}
    df["region_enc"] = df["region"].map(region_map).fillna(0).astype(int)

    # Distance to Kampala CBD
    df["dist_kampala_km"] = _haversine(
        df["lat"].values, df["lon"].values, KAMPALA_LAT, KAMPALA_LON
    )

    # Distance to nearest major town (excluding Kampala since we have that)
    other_towns = [(v[0], v[1]) for k, v in MAJOR_TOWNS.items() if k != "Kampala"]
    town_arr = np.array(other_towns)
    coords   = df[["lat", "lon"]].values
    dists    = np.array([
        min(_haversine(lat, lon, t[0], t[1]) for t in other_towns)
        if lat and lon else np.nan
        for lat, lon in coords
    ])
    df["dist_nearest_town_km"] = dists

    # Surface type encoding
    surf_map = {"Bituminous": 2, "Gravel": 1, "Unsealed": 0, "Earth": 0}
    df["surface_enc"] = df["surface_type"].map(surf_map).fillna(0).astype(int)

    # Link length
    if "length_km" in df.columns:
        df["length_km"] = pd.to_numeric(df["length_km"], errors="coerce").fillna(10.0)
    else:
        df["length_km"] = 10.0

    # Betweenness proxy: national (A-class) links on major corridors score higher
    df["betweenness_proxy"] = (
        df["road_class_enc"] * 1.5
        - np.log1p(df["dist_kampala_km"].fillna(200)) * 0.3
    ).round(3)

    return df


def add_network_features(df: pd.DataFrame, net: gpd.GeoDataFrame) -> pd.DataFrame:
    """Merge link attributes from road network shapefile."""
    net_attrs = net[["link_id","road_class","length_km","surface_type","region","link_name"]].copy()
    net_attrs.columns = ["link_id","road_class","length_km","surface_type","region","link_name_net"]

    df = df.merge(
        net_attrs,
        on="link_id",
        how="left",
        suffixes=("", "_net"),
    )
    # Fill from network where our data is missing
    for col in ("road_class", "length_km", "surface_type", "region"):
        net_col = col + "_net"
        if net_col in df.columns:
            df[col] = df[col].fillna(df[net_col])
            df.drop(columns=[net_col], inplace=True, errors="ignore")

    return df


def add_spatial_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each record, compute the mean AADT of the k nearest ATC stations
    (using coordinates from the same time period ±1 year).
    This proxies for spatial autocorrelation in traffic flows.
    """
    # Build a reference table of annual mean AADT per station
    ref = (
        df.dropna(subset=["lat","lon","AADT"])
          .groupby(["link_id","year"])
          .agg(aadt_mean=("AADT","mean"), lat=("lat","first"), lon=("lon","first"))
          .reset_index()
    )
    ref = ref.dropna(subset=["lat","lon"])

    if len(ref) < 5:
        df["spatial_lag_aadt_k3"] = np.nan
        df["spatial_lag_aadt_k5"] = np.nan
        return df

    coords = ref[["lat","lon"]].values
    aadts  = ref["aadt_mean"].values

    tree = cKDTree(np.radians(coords))

    lag3 = np.full(len(df), np.nan)
    lag5 = np.full(len(df), np.nan)

    for i, row in df.iterrows():
        lat = row.get("lat") or np.nan
        lon = row.get("lon") or np.nan
        if np.isnan(lat) or np.isnan(lon):
            continue
        pt = np.radians([[lat, lon]])
        # k=6 to exclude self
        k = min(8, len(ref))
        dists, idxs = tree.query(pt, k=k)
        idxs = idxs[0][1:]  # exclude self (nearest = itself often)
        valid_aadts = aadts[idxs]
        valid_aadts = valid_aadts[~np.isnan(valid_aadts)]
        if len(valid_aadts) >= 3:
            lag3[i] = float(np.mean(valid_aadts[:3]))
        if len(valid_aadts) >= 5:
            lag5[i] = float(np.mean(valid_aadts[:5]))

    df["spatial_lag_aadt_k3"] = lag3
    df["spatial_lag_aadt_k5"] = lag5

    # Station-level mean AADT (across all years)
    station_means = df.groupby("link_id")["AADT"].mean().to_dict()
    df["station_mean_aadt"] = df["link_id"].map(station_means)

    return df


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Uganda National Roads — Feature Engineering")
    print("=" * 60)

    csv_path = ML_DATA / "unified_traffic.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Run merge_traffic_data.py first: {csv_path}")

    print("\n[1] Loading unified traffic data …")
    df = pd.read_csv(csv_path)
    print(f"    {len(df)} records, {df['link_id'].nunique()} unique links")

    print("\n[2] Loading road network for link attributes …")
    net = gpd.read_file(NET_SHP).to_crs("EPSG:4326")
    net.rename(columns={
        "Link_ID_1":"link_id","Road_No_1":"road_no","Road_Cla_1":"road_class",
        "Link_Name":"link_name","Length_km_":"length_km","Surface__1":"surface_type",
        "Maintena_3":"region",
    }, inplace=True)

    print("\n[3] Adding network attributes …")
    df = add_network_features(df, net)

    print("\n[4] Adding temporal features …")
    df = add_temporal_features(df)

    print("\n[5] Adding spatial features …")
    df = add_spatial_features(df, net)

    print("\n[6] Adding spatial lag features …")
    df = add_spatial_lag_features(df)

    # ── Compute centroid lat/lon for links without station coords ──
    net_centroids = net.copy()
    net_centroids["centroid_lat"] = net.geometry.centroid.y
    net_centroids["centroid_lon"] = net.geometry.centroid.x
    cen_map = (
        net_centroids.drop_duplicates(subset=["link_id"])
                     .set_index("link_id")[["centroid_lat","centroid_lon"]]
                     .to_dict("index")
    )

    mask = df["lat"].isna() | (df["lat"] == 0)
    df.loc[mask, "lat"] = df.loc[mask, "link_id"].map(
        lambda lid: cen_map.get(lid, {}).get("centroid_lat", np.nan)
    )
    df.loc[mask, "lon"] = df.loc[mask, "link_id"].map(
        lambda lid: cen_map.get(lid, {}).get("centroid_lon", np.nan)
    )

    # Recompute distance features with filled coords
    df = add_spatial_features(df, net)

    # ── Final feature set ──
    feature_cols = [
        "link_id","station_id","road_name","lat","lon","year","month","AADT",
        "AADT_motorcycles","AADT_cars","AADT_buses","AADT_trucks","AADT_heavy",
        "heavy_pct","peak_hour_factor","growth_rate","data_source","region",
        # engineered
        "road_class","road_class_enc","region_enc",
        "dist_kampala_km","dist_nearest_town_km",
        "length_km","surface_enc","betweenness_proxy",
        "is_dry_season","is_holiday_month","year_norm",
        "month_sin","month_cos","gdp_proxy",
        "spatial_lag_aadt_k3","spatial_lag_aadt_k5","station_mean_aadt",
    ]
    keep = [c for c in feature_cols if c in df.columns]
    df_out = df[keep].copy()

    # ── Target: log(AADT) for training ──
    df_out["log_AADT"] = np.log1p(df_out["AADT"].clip(lower=1))

    out_path = ML_DATA / "features.csv"
    df_out.to_csv(out_path, index=False)
    print(f"\n  Saved: ml/data/features.csv ({len(df_out)} rows, {len(df_out.columns)} cols)")
    print(f"  Feature columns: {[c for c in df_out.columns if c not in ('link_id','station_id','road_name','AADT','log_AADT')]}")

    print("\n✓  Feature engineering complete.")


if __name__ == "__main__":
    main()
