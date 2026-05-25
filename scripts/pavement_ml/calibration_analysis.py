#!/usr/bin/env python3
"""
HDM-4 calibration analysis from real ROMDAS multi-year data.

Compares actual IRI change (2020->2021) against HDM-4 model predictions.
Identifies maintenance events (IRI reduction) vs natural deterioration.
Outputs calibration metrics and a JSON report.

Usage:
  python calibration_analysis.py
"""

import json, sqlite3, math
from pathlib import Path
from datetime import datetime

BASE    = Path(__file__).resolve().parents[2]
DB_PATH = str(BASE / 'traffic_platform.db')
OUT_JSON = str(BASE / 'public' / 'data' / 'romdas_calibration.json')

# Uganda HDM-4 calibration constants (current values in romdas_ml_model.py)
CLIMATE_FACTOR  = 1.2
AADT_DEFAULT = {'A': 7500, 'B': 3200, 'C': 950, 'M': 18000}
TRUCK_FRAC   = {'A': 0.28, 'B': 0.22, 'C': 0.14, 'M': 0.32}
AVG_ESALF    = 3.8
BASE_AGE_2020 = 8   # pavement age in 2020


def delta_iri_hdm4(surface: str, cesal: float, age: int) -> float:
    """Uganda-calibrated IRI increment per year."""
    c = max(cesal, 0.001)
    if surface == 'surface_dressing':
        return 0.0082 * (c ** 0.60) * math.exp(0.038 * age) * CLIMATE_FACTOR
    return 0.0066 * (c ** 0.65) * math.exp(0.032 * age) * CLIMATE_FACTOR


def predicted_delta(road_class: str, surface: str) -> float:
    """Predict HDM-4 IRI increase over 1 year from 2020 baseline (age 8)."""
    aadt    = AADT_DEFAULT.get(road_class, 3200)
    hgv     = TRUCK_FRAC.get(road_class, 0.22)
    cesal   = aadt * 365 * hgv * AVG_ESALF / 1e6
    return delta_iri_hdm4(surface or 'asphalt', cesal, BASE_AGE_2020)


def main():
    conn = sqlite3.connect(DB_PATH)

    # Links with data in both survey years
    rows = conn.execute("""
        SELECT s20.link_id, s20.road_name, s20.region, s20.surface_type,
               dc.road_class,
               s20.mean_iri AS iri_2020, s21.mean_iri AS iri_2021,
               s20.section_length_km AS len_20, s21.section_length_km AS len_21,
               s20.sd_iri AS sd_20, s21.sd_iri AS sd_21
        FROM   romdas_sections s20
        JOIN   romdas_sections s21 ON s20.link_id = s21.link_id
        LEFT JOIN (
            SELECT DISTINCT link_id, road_class FROM deterioration_curves
            WHERE projected_year = 2024
        ) dc ON s20.link_id = dc.link_id
        WHERE  s20.survey_year = 2020
          AND  s21.survey_year = 2021
        ORDER  BY s20.link_id
    """).fetchall()
    conn.close()

    THRESHOLD_MAINTENANCE = -0.3   # IRI reduction > 0.3 m/km suggests maintenance

    results       = []
    maint_events  = []
    deteri_actual = []   # natural deterioration only (no maintenance)
    deteri_pred   = []

    for row in rows:
        lid, road_name, region, surface, road_class, iri20, iri21, \
            len20, len21, sd20, sd21 = row

        road_class  = road_class  or 'B'
        surface     = surface     or 'asphalt'
        actual_delta = float(iri21) - float(iri20)   # negative = improvement
        pred_delta   = predicted_delta(road_class, surface)
        error        = actual_delta - pred_delta

        # Classify
        if actual_delta <= THRESHOLD_MAINTENANCE:
            category = 'maintenance_observed'
            maint_events.append({
                'link_id':   lid,
                'road_name': road_name,
                'iri_2020':  round(float(iri20), 2),
                'iri_2021':  round(float(iri21), 2),
                'delta_iri': round(actual_delta, 3),
                'likely_treatment': (
                    'Overlay/Reseal' if float(iri20) < 5.0 else
                    'Rehabilitation' if float(iri20) < 9.0 else
                    'Reconstruction'
                ),
            })
        else:
            category = 'deteriorating'
            deteri_actual.append(actual_delta)
            deteri_pred.append(pred_delta)

        results.append({
            'link_id':          lid,
            'road_name':        road_name,
            'region':           region,
            'road_class':       road_class,
            'surface_type':     surface,
            'iri_2020':         round(float(iri20), 3),
            'iri_2021':         round(float(iri21), 3),
            'actual_delta':     round(actual_delta, 3),
            'predicted_delta':  round(pred_delta, 3),
            'prediction_error': round(error, 3),
            'category':         category,
        })

    # HDM-4 calibration factor (ratio actual/predicted for deteriorating links)
    if deteri_pred and deteri_actual:
        calib_factor = sum(deteri_actual) / sum(deteri_pred)
    else:
        calib_factor = None

    # RMSE for prediction error on deteriorating links
    if len(deteri_actual) > 0 and len(deteri_pred) > 0:
        import statistics
        errors   = [a - p for a, p in zip(deteri_actual, deteri_pred)]
        rmse_det = round(math.sqrt(sum(e**2 for e in errors) / len(errors)), 4)
        mean_err = round(statistics.mean(errors), 4)
    else:
        rmse_det = None
        mean_err = None

    summary = {
        'generated_at':          datetime.now().isoformat()[:19],
        'links_analysed':        len(results),
        'maintenance_detected':  len(maint_events),
        'naturally_deteriorating': len(deteri_actual),
        'calibration': {
            'hdm4_factor_current':  CLIMATE_FACTOR,
            'observed_calib_factor': round(calib_factor, 3) if calib_factor else None,
            'prediction_rmse_m_km_yr': rmse_det,
            'mean_error_m_km_yr':      mean_err,
            'note': (
                'Calibration factor < 1.0 means HDM-4 over-predicts deterioration '
                'for surveyed links — actual roads in better condition than model assumes.'
                if calib_factor and calib_factor < 1.0 else
                'Insufficient deteriorating-link data for calibration'
            ),
        },
        'maintenance_events': maint_events,
        'link_details':       results,
    }

    Path(OUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(summary, f, indent=2)

    print('=== HDM-4 Calibration Analysis ===')
    print(f'  Links with 2020+2021 data : {len(results)}')
    print(f'  Maintenance events detected: {len(maint_events)}')
    print(f'  Naturally deteriorating    : {len(deteri_actual)}')
    if calib_factor:
        print(f'  Calibration factor         : {calib_factor:.3f} (HDM-4 predicts x{1/calib_factor:.1f} more than observed)')
    print(f'  Prediction RMSE            : {rmse_det} m/km/yr')
    print(f'  Mean prediction error      : {mean_err} m/km/yr')
    print()
    print(f'Maintenance events:')
    for m in maint_events:
        print(f'  {m["link_id"]} ({m["road_name"]}): {m["iri_2020"]:.2f} -> {m["iri_2021"]:.2f} '
              f'({m["delta_iri"]:+.2f}) -> likely: {m["likely_treatment"]}')
    print()
    print(f'Report -> {OUT_JSON}')


if __name__ == '__main__':
    main()
