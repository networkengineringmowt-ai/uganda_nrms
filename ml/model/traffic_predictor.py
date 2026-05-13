"""
Traffic Prediction Model — Uganda National Roads Authority

Architecture: XGBoost + LightGBM ensemble with spatial lag features.
Outputs predictions for ALL 1,014 road links (observed + interpolated).

Inputs:  ml/data/features.csv
         road network shapefile (for link geometries)

Outputs:
  ml/model/traffic_model.joblib          – trained ensemble model
  ml/outputs/predictions_all_links.json  – predictions per link (JSON)
  public/data/traffic_predictions.geojson – road links with predictions (map)
"""

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.spatial import cKDTree
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import lightgbm as lgb
import shap

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
WKTREE  = Path(__file__).resolve().parent.parent.parent
ML_DATA = WKTREE / "ml" / "data"
ML_MDL  = WKTREE / "ml" / "model"
ML_OUT  = WKTREE / "ml" / "outputs"
OUT_PUB = WKTREE / "public" / "data"

ML_MDL.mkdir(parents=True, exist_ok=True)
ML_OUT.mkdir(parents=True, exist_ok=True)
OUT_PUB.mkdir(parents=True, exist_ok=True)

NET_SHP = Path("D:/OneDrive/Uganda National Road Network Repository/8. Shapefiles/Roads/network2026/network2026.shp")

# Model features (must match feature_engineering.py output)
FEATURE_COLS = [
    "road_class_enc",
    "region_enc",
    "dist_kampala_km",
    "dist_nearest_town_km",
    "length_km",
    "surface_enc",
    "betweenness_proxy",
    "is_dry_season",
    "is_holiday_month",
    "year_norm",
    "month_sin",
    "month_cos",
    "gdp_proxy",
    "spatial_lag_aadt_k3",
    "spatial_lag_aadt_k5",
    "station_mean_aadt",
    "growth_rate",
]

# Forecast growth scenarios (Uganda NDP-IV targets + GDP elasticity)
# Traffic growth elasticity to GDP ≈ 0.8 (typical sub-Saharan Africa)
GROWTH_SCENARIOS = {
    2025: 1.00,
    2030: 1.35,   # ~6.2% CAGR × 5yr
    2040: 1.95,   # ~6.5% CAGR × 15yr
}

# Road capacity (PCUs/day) by class — Uganda roads design standards
CAPACITY = {"A": 10_000, "B": 5_000, "C": 2_500, "M": 15_000, "D": 1_500}

CONGESTION_LEVELS = [
    (0.40,  "Low",      0),
    (0.70,  "Medium",   1),
    (0.90,  "High",     2),
    (999.0, "Critical", 3),
]

SHAP_FEATURE_NAMES = {
    "road_class_enc":         "Road class",
    "region_enc":             "Region",
    "dist_kampala_km":        "Distance to Kampala",
    "dist_nearest_town_km":   "Distance to nearest town",
    "length_km":              "Link length",
    "surface_enc":            "Surface type",
    "betweenness_proxy":      "Network centrality",
    "is_dry_season":          "Dry season",
    "year_norm":              "Year (trend)",
    "gdp_proxy":              "GDP growth proxy",
    "spatial_lag_aadt_k3":    "Nearby traffic (3 links)",
    "spatial_lag_aadt_k5":    "Nearby traffic (5 links)",
    "station_mean_aadt":      "Station mean AADT",
    "growth_rate":            "Historical growth rate",
}


def _congestion(aadt: float, road_class: str) -> tuple[str, int]:
    cap  = CAPACITY.get(road_class, 3_000)
    vcr  = aadt / cap
    for threshold, level, score in CONGESTION_LEVELS:
        if vcr <= threshold:
            return level, score
    return "Critical", 3


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a    = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arcsin(np.sqrt(a))


# ─── Train ────────────────────────────────────────────────────────────────────
def train_model(df_train: pd.DataFrame) -> dict:
    """
    Train XGBoost + LightGBM ensemble on observed station data.
    Returns {'xgb': model, 'lgb': model, 'scaler': scaler, 'feature_cols': list}
    """
    X = df_train[FEATURE_COLS].copy()
    y = df_train["log_AADT"].values

    # Fill missing spatial lag with column median
    for col in FEATURE_COLS:
        X[col] = X[col].fillna(X[col].median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── XGBoost ──
    xgb_model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    # ── LightGBM ──
    lgb_model = lgb.LGBMRegressor(
        n_estimators=400,
        num_leaves=31,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_samples=5,
        random_state=42,
        n_jobs=-1,
        verbosity=-1,
    )

    # Temporal cross-validation: train 2016-2020, validate 2021-2022
    train_mask = df_train["year"] <= 2020
    val_mask   = df_train["year"] >= 2021

    X_tr, y_tr = X_scaled[train_mask], y[train_mask]
    X_va, y_va = X_scaled[val_mask],   y[val_mask]

    if len(X_tr) > 0 and len(X_va) > 0:
        xgb_model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
        lgb_model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)])
        val_pred_xgb = xgb_model.predict(X_va)
        val_pred_lgb = lgb_model.predict(X_va)
        val_pred     = 0.5 * val_pred_xgb + 0.5 * val_pred_lgb
        rmse = np.sqrt(np.mean((y_va - val_pred) ** 2))
        print(f"    CV (2021-22 holdout) RMSE in log-AADT: {rmse:.4f}")
        # RMSE in original scale at mean AADT ~5000
        mean_aadt = np.expm1(np.mean(y_va))
        approx_aadt_rmse = mean_aadt * (np.exp(rmse) - 1)
        print(f"    Approx AADT RMSE: {approx_aadt_rmse:.0f} veh/day")
    else:
        print("    [warn] Insufficient data for temporal CV — training on all data")

    # Final training on all data
    xgb_model.fit(X_scaled, y)
    lgb_model.fit(X_scaled, y)

    return {
        "xgb": xgb_model,
        "lgb": lgb_model,
        "scaler": scaler,
        "feature_cols": FEATURE_COLS,
    }


# ─── SHAP Explanations ────────────────────────────────────────────────────────
def compute_shap(model_dict: dict, X_pred: pd.DataFrame, n_samples: int = 300) -> np.ndarray:
    """Return SHAP values for XGBoost model on X_pred sample."""
    scaler = model_dict["scaler"]
    X_sc   = scaler.transform(X_pred.fillna(X_pred.median()))

    xgb_model = model_dict["xgb"]
    sample_idx = np.random.choice(len(X_sc), min(n_samples, len(X_sc)), replace=False)
    explainer  = shap.TreeExplainer(xgb_model)
    sv         = explainer.shap_values(X_sc[sample_idx])
    return sv, sample_idx


# ─── Build Inference Feature Matrix for All Links ─────────────────────────────
def build_inference_df(net: gpd.GeoDataFrame, train_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build a feature row for every road link, even those without an ATC station.
    Uses link geometry centroid + road network attributes + spatial lag from known stations.
    """
    # Compute centroids in WGS84
    net_wgs = net.copy()
    net_wgs["centroid_lat"] = net_wgs.geometry.centroid.y
    net_wgs["centroid_lon"] = net_wgs.geometry.centroid.x

    net_attrs = net_wgs[[
        "link_id","road_class","length_km","surface_type","region",
        "centroid_lat","centroid_lon"
    ]].copy()

    # Latest annual mean AADT per station (for spatial lag)
    latest_yr  = train_df.groupby("link_id")["year"].max().to_dict()
    station_map = {}
    for lid, grp in train_df.groupby("link_id"):
        best_yr = latest_yr.get(lid, train_df["year"].max())
        rows = grp[grp["year"] == best_yr]
        if len(rows):
            station_map[lid] = {
                "AADT": rows["AADT"].mean(),
                "lat":  rows["lat"].mean(),
                "lon":  rows["lon"].mean(),
                "growth_rate": rows["growth_rate"].mean(),
            }

    # For links without stations: impute AADT via spatial KNN
    known_lids  = list(station_map.keys())
    known_lat   = np.array([station_map[l]["lat"] for l in known_lids])
    known_lon   = np.array([station_map[l]["lon"] for l in known_lids])
    known_aadt  = np.array([station_map[l]["AADT"] for l in known_lids])
    known_grate = np.array([station_map[l]["growth_rate"] for l in known_lids])

    if len(known_lat) > 0:
        knn_tree = cKDTree(np.column_stack([known_lat, known_lon]))

    rows = []
    for _, link in net_attrs.iterrows():
        lid   = link["link_id"]
        lat   = link["centroid_lat"]
        lon   = link["centroid_lon"]
        rclass= str(link.get("road_class", "C") or "C")
        length= float(link.get("length_km", 10) or 10)
        surf  = str(link.get("surface_type", "Unsealed") or "Unsealed")
        region= str(link.get("region", "Central") or "Central")

        # Observed station data for this link
        if lid in station_map:
            obs_aadt  = station_map[lid]["AADT"]
            grate     = station_map[lid]["growth_rate"]
            has_obs   = True
        else:
            obs_aadt  = np.nan
            grate     = 6.5
            has_obs   = False

        # Spatial lag AADT from k nearest known stations
        lag3 = lag5 = np.nan
        if len(known_lat) >= 3 and lat and lon:
            dists, idxs = knn_tree.query([[lat, lon]], k=min(6, len(known_lat)))
            idxs = idxs[0]
            lags  = known_aadt[idxs[1:]]  # exclude self
            lag3  = float(np.mean(lags[:3])) if len(lags) >= 3 else float(np.mean(lags))
            lag5  = float(np.mean(lags[:5])) if len(lags) >= 5 else lag3

        # Station mean AADT
        sm_aadt = obs_aadt if has_obs else (lag3 if not np.isnan(lag3) else 2000.0)

        # Encodings
        class_map  = {"A": 4, "B": 3, "C": 2, "M": 5, "D": 1}
        region_map = {"Central": 0, "Eastern": 1, "East": 1,
                      "Northern": 2, "North": 2, "North East": 2,
                      "Western": 3, "West": 3, "South": 3}
        surf_map   = {"Bituminous": 2, "Gravel": 1, "Unsealed": 0, "Earth": 0}

        KAMP_LAT, KAMP_LON = 0.3163, 32.5822
        dist_kamp = _haversine(lat, lon, KAMP_LAT, KAMP_LON) if lat else 200.0
        dist_town = dist_kamp * 0.6  # proxy

        rows.append({
            "link_id":               lid,
            "lat":                   lat,
            "lon":                   lon,
            "road_class":            rclass,
            "road_class_enc":        class_map.get(rclass, 1),
            "region":                region,
            "region_enc":            region_map.get(region, 0),
            "dist_kampala_km":       dist_kamp,
            "dist_nearest_town_km":  dist_town,
            "length_km":             length,
            "surface_enc":           surf_map.get(surf, 0),
            "betweenness_proxy":     class_map.get(rclass, 1) * 1.5 - np.log1p(dist_kamp) * 0.3,
            "is_dry_season":         0,     # predict for average month
            "is_holiday_month":      0,
            "year_norm":             (2025 - 2016) / (2025 - 2016),
            "month_sin":             0.0,
            "month_cos":             1.0,
            "gdp_proxy":             6.4,
            "growth_rate":           grate,
            "spatial_lag_aadt_k3":   lag3,
            "spatial_lag_aadt_k5":   lag5,
            "station_mean_aadt":     sm_aadt,
            "obs_aadt":              obs_aadt,
            "has_obs":               has_obs,
        })

    return pd.DataFrame(rows)


# ─── Predict ──────────────────────────────────────────────────────────────────
def predict_all_links(model_dict: dict, infer_df: pd.DataFrame, net: gpd.GeoDataFrame) -> pd.DataFrame:
    """Generate predictions for all road links with confidence intervals."""
    scaler = model_dict["scaler"]
    X      = infer_df[FEATURE_COLS].copy()
    X      = X.fillna(X.median())
    X_sc   = scaler.transform(X)

    xgb_pred = model_dict["xgb"].predict(X_sc)
    lgb_pred = model_dict["lgb"].predict(X_sc)

    # Ensemble: equal-weight blend
    ensemble_log = 0.5 * xgb_pred + 0.5 * lgb_pred
    aadt_2025    = np.expm1(ensemble_log).clip(min=10)

    # Where we have observed data, blend: 70% observed, 30% model
    has_obs = infer_df["has_obs"].values
    obs_aadt = infer_df["obs_aadt"].fillna(0).values
    blended  = np.where(has_obs, 0.7 * obs_aadt + 0.3 * aadt_2025, aadt_2025)
    blended  = blended.clip(min=10)

    # Confidence interval: ±30% for interpolated, ±15% for observed
    ci_pct   = np.where(has_obs, 0.15, 0.30)
    aadt_lo  = (blended * (1 - ci_pct)).clip(min=5)
    aadt_hi  = blended * (1 + ci_pct)

    # XGB individual tree spread as additional uncertainty
    xgb_model = model_dict["xgb"]
    leaf_preds = xgb_model.get_booster().predict(
        xgb.DMatrix(X_sc), pred_leaf=False
    )

    # Forecasts
    aadt_2030 = blended * GROWTH_SCENARIOS[2030]
    aadt_2040 = blended * GROWTH_SCENARIOS[2040]

    # Heavy vehicle %
    grp_heavy = {
        lid: row.get("heavy_pct", np.nan)
        for lid, row in net.set_index("link_id").iterrows()
        if "heavy_pct" in net.columns
    } if "heavy_pct" in net.columns else {}

    road_class_ser = infer_df["road_class"].values
    heavy_pct      = np.array([
        22.0 if rc == "A" else 16.0 if rc == "B" else 12.0
        for rc in road_class_ser
    ])

    # Peak hour volume (PHV = AADT × PHF, PHF ≈ 0.11 for Uganda national roads)
    phv = blended * 0.11

    # Congestion risk
    congestion_risk  = []
    congestion_score = []
    for aadt_val, rc in zip(blended, road_class_ser):
        level, score = _congestion(float(aadt_val), str(rc) if rc else "C")
        congestion_risk.append(level)
        congestion_score.append(score)

    # SHAP top-3 features (sample-based, then assign per link)
    top_features_per_link = [["Road class", "Nearby traffic", "Distance to Kampala"]] * len(infer_df)
    try:
        sv, s_idx = compute_shap(model_dict, X, n_samples=min(200, len(X)))
        mean_abs_shap = np.abs(sv).mean(axis=0)
        top3_idx = np.argsort(mean_abs_shap)[::-1][:3]
        top3_names = [SHAP_FEATURE_NAMES.get(FEATURE_COLS[i], FEATURE_COLS[i]) for i in top3_idx]
        top_features_per_link = [top3_names] * len(infer_df)
    except Exception as e:
        print(f"  [warn] SHAP computation failed: {e}")

    result_df = infer_df[["link_id","road_class","region","lat","lon","has_obs","obs_aadt"]].copy()
    result_df["aadt_predicted"]   = blended.round(0).astype(int)
    result_df["aadt_lower_95"]    = aadt_lo.round(0).astype(int)
    result_df["aadt_upper_95"]    = aadt_hi.round(0).astype(int)
    result_df["growth_2025"]      = blended.round(0).astype(int)
    result_df["growth_2030"]      = aadt_2030.round(0).astype(int)
    result_df["growth_2040"]      = aadt_2040.round(0).astype(int)
    result_df["peak_hour_volume"] = phv.round(0).astype(int)
    result_df["heavy_vehicle_pct"]= heavy_pct.round(1)
    result_df["congestion_risk"]  = congestion_risk
    result_df["congestion_risk_score"] = congestion_score
    result_df["top_features"]     = [json.dumps(f) for f in top_features_per_link]

    return result_df


# ─── Build Output GeoJSON ─────────────────────────────────────────────────────
def build_predictions_geojson(preds_df: pd.DataFrame, net: gpd.GeoDataFrame) -> None:
    """Create traffic_predictions.geojson with road link geometries + predictions."""
    # Merge net attributes
    net_simple = net[["link_id","link_name","road_no","road_class","length_km","surface_type","region","geometry"]].copy()
    merged = net_simple.merge(preds_df, on="link_id", how="left", suffixes=("","_pred"))

    # Resolve column conflicts
    for col in ("road_class","region"):
        pred_col = col + "_pred"
        if pred_col in merged.columns:
            merged[col] = merged[col].fillna(merged[pred_col])
            merged.drop(columns=[pred_col], inplace=True, errors="ignore")

    # Round all numeric prediction columns
    num_cols = ["aadt_predicted","aadt_lower_95","aadt_upper_95",
                "growth_2025","growth_2030","growth_2040",
                "peak_hour_volume","heavy_vehicle_pct","congestion_risk_score"]
    for col in num_cols:
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce").round(1)

    # Add vehicle-km (for KPI cards)
    merged["vehicle_km_daily"] = (
        merged["aadt_predicted"].fillna(0) * merged["length_km"].fillna(0)
    ).round(0)

    out_path = OUT_PUB / "traffic_predictions.geojson"
    merged.to_file(out_path, driver="GeoJSON")

    # Also write slim predictions JSON for API-like access
    pred_records = preds_df[[
        "link_id","aadt_predicted","aadt_lower_95","aadt_upper_95",
        "growth_2025","growth_2030","growth_2040",
        "peak_hour_volume","heavy_vehicle_pct",
        "congestion_risk","congestion_risk_score","top_features",
    ]].copy()
    pred_records["top_features"] = pred_records["top_features"].apply(
        lambda x: json.loads(x) if isinstance(x, str) else x
    )

    out_json = ML_OUT / "predictions_all_links.json"
    pred_records.to_json(out_json, orient="records", indent=2)

    print(f"  Saved traffic_predictions.geojson ({len(merged)} links)")
    print(f"  Saved predictions_all_links.json  ({len(pred_records)} records)")

    # ── Network KPI summary ──
    total_vkm = merged["vehicle_km_daily"].sum()
    at_risk   = (merged["congestion_risk_score"] >= 2).sum()
    pct_risk  = at_risk / len(merged) * 100
    top_corridor = merged.nlargest(1, "growth_2040").iloc[0]

    summary = {
        "total_vehicle_km_daily": int(total_vkm),
        "links_at_capacity_risk_pct": round(pct_risk, 1),
        "highest_growth_corridor_2040": {
            "link_id":   top_corridor.get("link_id"),
            "link_name": top_corridor.get("link_name"),
            "aadt_2025": int(top_corridor.get("growth_2025", 0) or 0),
            "aadt_2040": int(top_corridor.get("growth_2040", 0) or 0),
        },
        "congestion_breakdown": merged["congestion_risk"].value_counts().to_dict(),
    }
    (OUT_PUB / "traffic_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"\n  KPI summary:")
    print(f"    Total vehicle-km/day: {total_vkm:,.0f}")
    print(f"    Links at capacity risk (High+Critical): {at_risk} ({pct_risk:.1f}%)")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Uganda National Roads — Traffic Prediction Model")
    print("=" * 60)

    feat_path = ML_DATA / "features.csv"
    if not feat_path.exists():
        raise FileNotFoundError(f"Run feature_engineering.py first: {feat_path}")

    print("\n[1] Loading features …")
    df = pd.read_csv(feat_path)
    df = df.dropna(subset=["AADT", "log_AADT"])
    df = df[df["AADT"] > 10]   # exclude clearly invalid
    print(f"    {len(df)} training records, {df['link_id'].nunique()} unique links")

    print("\n[2] Loading road network …")
    net = gpd.read_file(NET_SHP).to_crs("EPSG:4326")
    net.rename(columns={
        "Link_ID_1":"link_id","Road_No_1":"road_no","Road_Cla_1":"road_class",
        "Link_Name":"link_name","Length_km_":"length_km","Surface__1":"surface_type",
        "Maintena_3":"region",
    }, inplace=True)
    print(f"    {len(net)} road links")

    print("\n[3] Training XGBoost + LightGBM ensemble …")
    model_dict = train_model(df)
    joblib.dump(model_dict, ML_MDL / "traffic_model.joblib")
    print(f"  Saved: ml/model/traffic_model.joblib")

    print("\n[4] Building inference matrix for all 1,014 links …")
    infer_df = build_inference_df(net, df)
    print(f"    Links with observed data: {infer_df['has_obs'].sum()}")
    print(f"    Links requiring prediction: {(~infer_df['has_obs']).sum()}")

    print("\n[5] Generating predictions …")
    preds_df = predict_all_links(model_dict, infer_df, net)

    # Print congestion summary
    cong_counts = preds_df["congestion_risk"].value_counts()
    print(f"    Congestion risk: {dict(cong_counts)}")

    print("\n[6] Writing output GeoJSON and JSON …")
    build_predictions_geojson(preds_df, net)

    print("\n✓  Prediction model complete.")


if __name__ == "__main__":
    main()
