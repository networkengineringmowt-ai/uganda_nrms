"""
Pipeline orchestrator — runs all three steps in sequence.
Usage: python ml/run_pipeline.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("STEP 1/3 — Merge traffic data")
    print("=" * 60)
    from data.merge_traffic_data import main as merge
    merge()

    print("\n" + "=" * 60)
    print("STEP 2/3 — Feature engineering")
    print("=" * 60)
    from data.feature_engineering import main as features
    features()

    print("\n" + "=" * 60)
    print("STEP 3/3 — Train model + generate predictions")
    print("=" * 60)
    from model.traffic_predictor import main as predict
    predict()

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("Outputs:")
    print("  ml/data/unified_traffic.csv")
    print("  ml/data/features.csv")
    print("  ml/model/traffic_model.joblib")
    print("  ml/outputs/predictions_all_links.json")
    print("  public/data/traffic_predictions.geojson")
    print("  public/data/traffic_links.geojson")
    print("  public/data/traffic_summary.json")
    print("=" * 60)
