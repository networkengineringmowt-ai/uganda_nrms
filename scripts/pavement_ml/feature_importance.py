#!/usr/bin/env python3
"""
Permutation feature importance for ROMDAS PMS PyTorch MLP models.

For each of the three trained models, shuffles one feature column at a time
and measures the drop in validation R² / accuracy. Reports mean ± std over
10 permutation repeats.

Output: public/data/model_feature_importance.json

Usage:
  python feature_importance.py
"""

import json, sqlite3, warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import joblib
from sklearn.metrics import r2_score, accuracy_score

# Reuse data loaders and helpers from the main ML model
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from romdas_ml_model import (
    load_training_data, generate_augmented, load_real_sections,
    FEAT_DETERI, FEAT_CLASSIF, FEAT_INTERV, COND_CLASSES,
    _load_mlp, _infer, DB_PATH, MODEL_DIR,
)

warnings.filterwarnings('ignore')

BASE     = Path(__file__).resolve().parents[2]
OUT_JSON = str(BASE / 'public' / 'data' / 'model_feature_importance.json')

FEATURE_LABELS = {
    'iri_2024':            'Current IRI',
    'rut_max_mm':          'Max Rut Depth (mm)',
    'aadt_log':            'Traffic (log AADT)',
    'hgv_pct':             'HGV Fraction',
    'cesal_ann':           'Annual ESALs',
    'structural_number':   'Structural Number',
    'deterioration_rate':  'Deterioration Rate',
    'surface_enc':         'Surface Type',
    'class_enc':           'Road Class',
    'region_enc':          'Region',
    'climate_f':           'Climate Factor',
    'pct_above_9':         'Pct IRI > 9',
    'sd_iri':              'IRI Std Dev',
}


def permutation_importance(model, X: np.ndarray, y: np.ndarray,
                            mean: np.ndarray, scale: np.ndarray,
                            is_classifier: bool = False,
                            n_repeats: int = 10,
                            seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Permutation importance: mean drop in score when each feature is shuffled."""
    baseline_pred = _infer(model, X, mean, scale)
    if is_classifier:
        baseline_score = accuracy_score(y, np.argmax(baseline_pred, axis=1))
    else:
        flat = baseline_pred.ravel() if baseline_pred.ndim > 1 and baseline_pred.shape[1] == 1 \
               else baseline_pred
        if flat.ndim > 1:
            baseline_score = float(np.mean([r2_score(y[:, i], flat[:, i])
                                            for i in range(flat.shape[1])]))
        else:
            baseline_score = float(r2_score(y, flat))

    rng = np.random.default_rng(seed)
    importances = np.zeros((X.shape[1], n_repeats))

    for feat_idx in range(X.shape[1]):
        for rep in range(n_repeats):
            X_perm = X.copy()
            X_perm[:, feat_idx] = rng.permutation(X_perm[:, feat_idx])
            pred = _infer(model, X_perm, mean, scale)
            if is_classifier:
                score = accuracy_score(y, np.argmax(pred, axis=1))
            else:
                flat_p = pred.ravel() if pred.ndim > 1 and pred.shape[1] == 1 else pred
                if flat_p.ndim > 1:
                    score = float(np.mean([r2_score(y[:, i], flat_p[:, i])
                                           for i in range(flat_p.shape[1])]))
                else:
                    score = float(r2_score(y, flat_p))
            importances[feat_idx, rep] = baseline_score - score

    return importances.mean(axis=1), importances.std(axis=1)


def main():
    print('=== Permutation Feature Importance ===')

    # ── Load training data ────────────────────────────────────────────────────
    import pandas as pd
    df_real     = load_training_data(DB_PATH)
    df_synth    = generate_augmented(5000, seed=123)
    df_sections = load_real_sections(DB_PATH)
    dfs = [df_real, df_synth]
    if not df_sections.empty:
        dfs.append(df_sections)
    df_all = pd.concat(dfs, ignore_index=True)
    print(f'  Training rows: {len(df_all):,}')

    le = joblib.load(str(MODEL_DIR / 'condition_label_encoder.joblib'))

    # Use a fixed validation split (same seed as training)
    rng_idx = np.random.default_rng(42).permutation(len(df_all))

    results = {}

    # ── Model 1: IRI Deterioration ────────────────────────────────────────────
    print('\n[M1] IRI Deterioration — permutation importance...')
    m1, mean1, scale1 = _load_mlp(str(MODEL_DIR / 'iri_deterioration_mlp.joblib'))
    X1 = df_all[FEAT_DETERI].fillna(0).values
    y1 = df_all[['target_iri_1yr', 'target_iri_3yr', 'target_iri_5yr']].values
    n_val1  = max(32, int(len(X1) * 0.20))
    va_idx1 = rng_idx[:n_val1]
    imp_mean1, imp_std1 = permutation_importance(
        m1, X1[va_idx1], y1[va_idx1], mean1, scale1, is_classifier=False)

    feat1 = []
    for i, feat in enumerate(FEAT_DETERI):
        feat1.append({
            'feature': feat,
            'label':   FEATURE_LABELS.get(feat, feat),
            'importance_mean': round(float(imp_mean1[i]), 5),
            'importance_std':  round(float(imp_std1[i]), 5),
        })
    feat1.sort(key=lambda x: -x['importance_mean'])
    results['iri_deterioration'] = {
        'model': 'IRI Deterioration Predictor (MLP)',
        'metric': 'R² drop (mean across 3 outputs)',
        'n_repeats': 10,
        'features': feat1,
    }
    print('  Top 3:', [(f['label'], round(f['importance_mean'], 4)) for f in feat1[:3]])

    # ── Model 2: Condition Classifier ─────────────────────────────────────────
    print('\n[M2] Condition Classifier — permutation importance...')
    m2, mean2, scale2 = _load_mlp(str(MODEL_DIR / 'condition_classifier_mlp.joblib'))
    X2 = df_all[FEAT_CLASSIF].fillna(0).values
    y2 = le.transform(df_all['condition_class'])
    n_val2  = max(32, int(len(X2) * 0.20))
    va_idx2 = rng_idx[:n_val2]
    imp_mean2, imp_std2 = permutation_importance(
        m2, X2[va_idx2], y2[va_idx2], mean2, scale2, is_classifier=True)

    feat2 = []
    for i, feat in enumerate(FEAT_CLASSIF):
        feat2.append({
            'feature': feat,
            'label':   FEATURE_LABELS.get(feat, feat),
            'importance_mean': round(float(imp_mean2[i]), 5),
            'importance_std':  round(float(imp_std2[i]), 5),
        })
    feat2.sort(key=lambda x: -x['importance_mean'])
    results['condition_classifier'] = {
        'model': 'Condition Classifier (MLP)',
        'metric': 'Accuracy drop',
        'n_repeats': 10,
        'features': feat2,
    }
    print('  Top 3:', [(f['label'], round(f['importance_mean'], 4)) for f in feat2[:3]])

    # ── Model 3: Intervention Predictor ──────────────────────────────────────
    print('\n[M3] Intervention Predictor — permutation importance...')
    m3, mean3, scale3 = _load_mlp(str(MODEL_DIR / 'intervention_predictor_mlp.joblib'))
    X3 = df_all[FEAT_INTERV].fillna(0).values
    y3 = df_all['years_until_intervention'].clip(0, 11).values
    n_val3  = max(32, int(len(X3) * 0.20))
    va_idx3 = rng_idx[:n_val3]
    imp_mean3, imp_std3 = permutation_importance(
        m3, X3[va_idx3], y3[va_idx3], mean3, scale3, is_classifier=False)

    feat3 = []
    for i, feat in enumerate(FEAT_INTERV):
        feat3.append({
            'feature': feat,
            'label':   FEATURE_LABELS.get(feat, feat),
            'importance_mean': round(float(imp_mean3[i]), 5),
            'importance_std':  round(float(imp_std3[i]), 5),
        })
    feat3.sort(key=lambda x: -x['importance_mean'])
    results['intervention_predictor'] = {
        'model': 'Intervention Trigger Predictor (MLP)',
        'metric': 'R² drop',
        'n_repeats': 10,
        'features': feat3,
    }
    print('  Top 3:', [(f['label'], round(f['importance_mean'], 4)) for f in feat3[:3]])

    # ── Summary ───────────────────────────────────────────────────────────────
    output = {
        'generated_at': datetime.now().isoformat()[:19],
        'method': 'Permutation importance (n_repeats=10, 20% validation split)',
        'interpretation': (
            'importance_mean = mean drop in metric when feature is shuffled. '
            'Higher = more important. Negative = feature adds noise for this model.'
        ),
        'models': results,
    }

    Path(OUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(output, f, indent=2)

    print(f'\n  -> {OUT_JSON}')
    return output


if __name__ == '__main__':
    main()
