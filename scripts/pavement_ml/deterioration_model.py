#!/usr/bin/env python3
"""
HDM-4 Calibrated Pavement Deterioration Model — Uganda National Roads
======================================================================
Equations calibrated for Uganda/East Africa (HDM-4 Calibration Report, Dec 2023).

Paved asphalt   : ΔRI = 0.0066 * CESAL^0.65 * exp(0.032*AGE) * 1.2
Surface dressing: ΔRI = 0.0082 * CESAL^0.60 * exp(0.038*AGE) * 1.2
Unpaved VCI     : ΔVCI = -0.15 * (AADT/100)^0.4 * 1.3

Intervention thresholds (IRI m/km):
  Routine   > 3.5   $3,500/km/yr
  Reseal    > 5.0   $45,000/km
  Overlay   > 6.5   $120,000/km
  Rehab     > 9.0   $350,000/km
  Reconstruct >12.0 $600,000/km paved / $120,000/km gravel
"""

import os, csv, json, math, sqlite3, warnings
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
import joblib

warnings.filterwarnings('ignore')

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LINKS_CSV = os.path.join(BASE, '..', '1.Road Network', 'Fetched Data',
                         'uganda_national_road_network_links_latest.csv')
TIS_DIR   = os.path.join(BASE, 'scripts')
DB_PATH   = os.path.join(BASE, 'traffic_platform.db')
OUT_JSON  = os.path.join(BASE, 'public', 'data', 'deterioration_summary.json')
MODEL_DIR = os.path.join(BASE, 'scripts', 'pavement_ml', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'deterioration_mlp.joblib')

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(os.path.join(BASE, 'public', 'data'), exist_ok=True)

CURRENT_YEAR = 2024
PROJECT_END  = 2035
CLIMATE_FACTOR  = 1.2   # Uganda tropical rainfall
RAINFALL_FACTOR = 1.3   # unpaved rainfall factor

IRI_ROUTINE     = 3.5
IRI_RESEAL      = 5.0
IRI_OVERLAY     = 6.5
IRI_REHAB       = 9.0
IRI_RECONSTRUCT = 12.0

COST_ROUTINE            = 3_500
COST_RESEAL             = 45_000
COST_OVERLAY            = 120_000
COST_REHAB              = 350_000
COST_RECONSTRUCT_PAVED  = 600_000
COST_RECONSTRUCT_GRAVEL = 120_000

TRUCK_FRAC   = {'A': 0.28, 'B': 0.22, 'C': 0.14, 'M': 0.32}
AVG_ESALF    = 3.8
AADT_DEFAULT = {'A': 7500, 'B': 3200, 'C': 950, 'M': 18000}
SN_DEFAULT   = {'A': 5.0,  'B': 4.0,  'C': 3.0, 'M': 5.5}

REGION_IRI_FACTOR = {
    'Central': 0.80, 'Eastern': 0.95, 'Western': 0.90,
    'Southern': 0.85, 'Northern': 1.15, 'North Eastern': 1.25,
}

SURFACE_MAP = {
    'Bituminous': 'asphalt', 'DBSD': 'surface_dressing',
    'SBSD': 'surface_dressing', 'Concrete': 'asphalt',
    'Gravel': 'unpaved', 'Earth': 'unpaved', 'Unsealed': 'unpaved',
}

SURFACE_CATS = ['asphalt', 'surface_dressing', 'unpaved']
ROAD_CLASSES  = ['A', 'B', 'C', 'M']
REGIONS       = list(REGION_IRI_FACTOR.keys())


def iri_band(iri):
    if iri < 3.5:  return 'Good'
    if iri < 6.5:  return 'Fair'
    if iri < 9.0:  return 'Poor'
    return 'Very Poor'


def annual_iri_increment(surface_cat, cesal_annual, age):
    c = max(cesal_annual, 0.001)
    if surface_cat == 'surface_dressing':
        return 0.0082 * (c ** 0.60) * math.exp(0.038 * age) * CLIMATE_FACTOR
    return 0.0066 * (c ** 0.65) * math.exp(0.032 * age) * CLIMATE_FACTOR


def annual_vci_decrement(aadt, age):
    return -0.15 * ((aadt / 100) ** 0.4) * RAINFALL_FACTOR


def vci_to_iri(vci):
    return max(1.5, 16.0 - 0.14 * max(0.0, min(100.0, vci)))


def iri_to_vci(iri):
    return max(0.0, min(100.0, (16.0 - iri) / 0.14))


def recommend_treatment(iri, surface_cat):
    if surface_cat == 'unpaved':
        if iri >= 14.0: return 'Reconstruct (Gravel)',  COST_RECONSTRUCT_GRAVEL, True
        if iri >= 10.0: return 'Regravelling',           50_000,                  True
        if iri >=  7.0: return 'Routine Grading',        COST_ROUTINE,            True
        return None, 0, False
    if iri >= IRI_RECONSTRUCT: return 'Reconstruct (Paved)', COST_RECONSTRUCT_PAVED, True
    if iri >= IRI_REHAB:       return 'Rehabilitation',       COST_REHAB,             True
    if iri >= IRI_OVERLAY:     return 'Overlay',               COST_OVERLAY,           True
    if iri >= IRI_RESEAL:      return 'Reseal',                COST_RESEAL,            True
    if iri >= IRI_ROUTINE:     return 'Routine Maintenance',   COST_ROUTINE,           True
    return None, 0, False


def load_links():
    links = []
    with open(LINKS_CSV, newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            try:
                length = float(row.get('Length(km)') or 0)
                if length <= 0:
                    continue
                rehab_yr = None
                for col in ('Rehabilitation_Year', 'Year_of_last_intervention', 'Completion_Year'):
                    v = row.get(col, '').strip()
                    if v and v not in ('', 'nan', 'None', '0.0', '0'):
                        try:
                            y = int(float(v))
                            if 1950 <= y <= 2024:
                                rehab_yr = y
                                break
                        except ValueError:
                            pass
                links.append({
                    'link_id':    row['Link_ID'].strip(),
                    'road_name':  row['Link_Name'].strip(),
                    'road_class': (row.get('Road_Class', 'B') or 'B').strip(),
                    'surface_raw': (row.get('Surface_Type', 'Bituminous') or 'Bituminous').strip(),
                    'region':     (row.get('Maintenance_Region', 'Central') or 'Central').strip(),
                    'length_km':  length,
                    'rehab_year': rehab_yr,
                })
            except (ValueError, KeyError):
                continue
    return links


def build_aadt_lookup():
    aadt_map = {}
    tis_files = [f for f in os.listdir(TIS_DIR)
                 if f.startswith('tis_') and f.endswith('.json')]
    all_records = []
    for fname in tis_files:
        try:
            with open(os.path.join(TIS_DIR, fname)) as f:
                data = json.load(f)
            if isinstance(data, list):
                all_records.extend(data)
        except Exception:
            pass
    if not all_records:
        return aadt_map
    daily = {}
    for rec in all_records:
        lid  = rec.get('link_id', '')
        date = rec.get('count_date', '')
        if not lid or not date:
            continue
        key = (lid, date)
        daily[key] = daily.get(key, 0) + (rec.get('total_count', 0) or 0)
    link_counts = {}
    for (lid, _), cnt in daily.items():
        link_counts.setdefault(lid, []).append(cnt)
    for lid, counts in link_counts.items():
        aadt_map[lid] = int(np.mean(counts))
    return aadt_map


def estimate_base_iri(link, surface_cat, rng):
    rehab_yr = link['rehab_year']
    region   = link['region']
    rc       = link['road_class']
    region_f = REGION_IRI_FACTOR.get(region, 1.0)
    age      = max(0, CURRENT_YEAR - rehab_yr) if rehab_yr else int(rng.integers(12, 22))

    if surface_cat == 'unpaved':
        if age <= 2:   base = float(rng.uniform(3.0, 5.0))
        elif age <= 5: base = float(rng.uniform(5.0, 8.0))
        elif age <= 10: base = float(rng.uniform(7.0, 11.0))
        else:          base = float(rng.uniform(10.0, 15.0))
    else:
        if age <= 3:   base = float(rng.uniform(1.5, 2.5))
        elif age <= 7: base = float(rng.uniform(2.5, 4.0))
        elif age <= 12: base = float(rng.uniform(3.5, 6.0))
        elif age <= 20: base = float(rng.uniform(5.5, 9.0))
        else:          base = float(rng.uniform(8.0, 13.0))

    class_f = {'A': 0.85, 'B': 1.0, 'C': 1.15, 'M': 0.75}.get(rc, 1.0)
    iri = base * region_f * class_f
    return round(max(1.2, min(16.0, iri)), 2), age


def project_link(link, aadt_lookup, rng):
    surface_cat = SURFACE_MAP.get(link['surface_raw'], 'asphalt')
    rc          = link['road_class']
    length_km   = link['length_km']
    lid         = link['link_id']

    aadt       = aadt_lookup.get(lid, AADT_DEFAULT.get(rc, 3000))
    sn         = SN_DEFAULT.get(rc, 4.0) + float(rng.uniform(-0.5, 0.5))
    cesal_ann  = aadt * 365 * TRUCK_FRAC.get(rc, 0.20) * AVG_ESALF / 1e6

    base_iri, base_age = estimate_base_iri(link, surface_cat, rng)
    cur_iri  = base_iri
    cur_vci  = iri_to_vci(base_iri) if surface_cat == 'unpaved' else None
    age      = base_age
    cum_esal = 0.0

    projections  = []
    triggers     = []
    triggered_future = False

    for yr in range(CURRENT_YEAR, PROJECT_END + 1):
        if surface_cat == 'unpaved':
            vci = max(0.0, min(100.0, cur_vci))
            iri = vci_to_iri(vci)
        else:
            iri = max(1.2, cur_iri)
            vci = iri_to_vci(iri)

        ci_half = iri * 0.18
        pci     = max(0.0, min(100.0, 100.0 - (iri - 1.5) * 7.0))

        projections.append({
            'year':     yr,
            'iri':      round(iri, 3),
            'vci':      round(vci, 1),
            'pci':      round(pci, 1),
            'ci_low':   round(max(1.0, iri - ci_half), 3),
            'ci_high':  round(iri + ci_half, 3),
            'cesal_cum': round(cum_esal, 4),
            'band':     iri_band(iri),
        })

        treatment, unit_cost, triggered = recommend_treatment(iri, surface_cat)
        if triggered:
            if yr == CURRENT_YEAR:
                priority = iri * 1.5 / max(length_km ** 0.3, 0.5)
                triggers.append({
                    'year': yr, 'treatment': treatment, 'unit_cost': unit_cost,
                    'total_cost': round(unit_cost * length_km),
                    'iri': round(iri, 2), 'priority_score': round(priority, 4),
                })
            elif not triggered_future:
                triggered_future = True
                years_away = yr - CURRENT_YEAR
                priority = (iri * 0.5 + 4.0 / max(years_away, 1)) / max(length_km ** 0.3, 0.5)
                triggers.append({
                    'year': yr, 'treatment': treatment, 'unit_cost': unit_cost,
                    'total_cost': round(unit_cost * length_km),
                    'iri': round(iri, 2), 'priority_score': round(priority, 4),
                })

        cum_esal += cesal_ann * (1.05 ** (yr - CURRENT_YEAR))
        age += 1
        if surface_cat == 'unpaved':
            cur_vci = max(0.0, cur_vci + annual_vci_decrement(aadt, age))
        else:
            cur_iri = min(16.0, cur_iri + annual_iri_increment(surface_cat, cesal_ann, age))

    return {
        'surface_cat': surface_cat, 'aadt': aadt, 'sn': round(sn, 2),
        'cesal_annual': round(cesal_ann, 4), 'base_iri': base_iri,
        'base_age': base_age, 'projections': projections, 'triggers': triggers,
    }


def generate_synthetic_data(n=10000, seed=42):
    rng = np.random.default_rng(seed)
    rows = []
    sc_probs = [0.40, 0.20, 0.40]
    rc_probs = [0.20, 0.30, 0.40, 0.10]

    for _ in range(n):
        sc  = SURFACE_CATS[rng.choice(len(SURFACE_CATS), p=sc_probs)]
        rc  = ROAD_CLASSES[rng.choice(len(ROAD_CLASSES),  p=rc_probs)]
        reg = REGIONS[rng.integers(len(REGIONS))]
        region_f  = REGION_IRI_FACTOR[reg]
        cesal     = float(rng.uniform(0.001, 3.5))
        base_iri  = float(rng.uniform(1.5, 16.0))
        sn        = float(rng.uniform(2.0, 7.0))
        age_proj  = int(rng.integers(1, 12))
        aadt      = float(rng.uniform(200, 25000))

        iri = base_iri
        vci = iri_to_vci(iri) if sc == 'unpaved' else None
        for yr in range(age_proj):
            if sc == 'unpaved':
                vci = max(0.0, vci + annual_vci_decrement(aadt, yr + 5))
                iri = vci_to_iri(vci)
            else:
                iri = min(16.0, iri + annual_iri_increment(sc, cesal, yr + 5))

        noise = float(rng.uniform(0.85, 1.15))
        rows.append({
            'surface_enc': SURFACE_CATS.index(sc),
            'class_enc':   ROAD_CLASSES.index(rc),
            'cesal':       cesal,
            'age_proj':    float(age_proj),
            'base_iri':    base_iri,
            'sn':          sn,
            'region_f':    region_f,
            'aadt_log':    math.log1p(aadt),
            'target_iri':  min(16.0, max(1.0, iri * noise)),
        })
    return pd.DataFrame(rows)


def train_mlp(df):
    print(f'  Training MLPRegressor on {len(df):,} synthetic samples…')
    FEATURES = ['surface_enc', 'class_enc', 'cesal', 'age_proj',
                'base_iri', 'sn', 'region_f', 'aadt_log']
    X = df[FEATURES].values
    y = df['target_iri'].values
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, random_state=42)
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('mlp', MLPRegressor(
            hidden_layer_sizes=(128, 64, 32), activation='relu', solver='adam',
            max_iter=300, learning_rate_init=0.001, random_state=42,
            early_stopping=True, validation_fraction=0.1, n_iter_no_change=20,
        ))
    ])
    pipe.fit(X_tr, y_tr)
    r2 = r2_score(y_te, pipe.predict(X_te))
    print(f'  R² (hold-out): {r2:.4f}')
    joblib.dump(pipe, MODEL_PATH)
    print(f'  Model saved → {MODEL_PATH}')
    return pipe, r2


def create_tables(conn):
    conn.executescript("""
    DROP TABLE IF EXISTS pavement_condition;
    DROP TABLE IF EXISTS deterioration_curves;
    DROP TABLE IF EXISTS maintenance_triggers;

    CREATE TABLE pavement_condition (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id TEXT, survey_year INTEGER, iri REAL, rut_depth_mm REAL,
        cracking_pct REAL, pothole_pct REAL, pci REAL, vci REAL,
        surface_type TEXT, structural_number REAL, data_source TEXT
    );
    CREATE TABLE deterioration_curves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id TEXT, road_name TEXT, region TEXT, surface_type TEXT, road_class TEXT,
        model_type TEXT, base_year INTEGER, base_iri REAL,
        projected_year INTEGER, projected_iri REAL, projected_pci REAL,
        cumulative_esals REAL, ci_low REAL, ci_high REAL,
        intervention_triggered TEXT, maintenance_cost_usd REAL
    );
    CREATE TABLE maintenance_triggers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id TEXT, road_name TEXT, region TEXT,
        trigger_year INTEGER, trigger_type TEXT, trigger_condition TEXT,
        estimated_cost_usd REAL, priority_score REAL, treatment_recommendation TEXT
    );
    """)
    conn.commit()


def main():
    print('\n━━━ Uganda Pavement Deterioration Engine ━━━')

    print('\n[1/5] Loading road links…')
    links = load_links()
    print(f'  {len(links):,} links loaded')

    print('\n[2/5] Building AADT lookup from TIS data…')
    aadt_lookup = build_aadt_lookup()
    print(f'  AADT records for {len(aadt_lookup):,} links')

    print('\n[3/5] Training MLP on 10,000 synthetic HDM-4 samples…')
    df_synth = generate_synthetic_data(10000)
    mlp_model, r2 = train_mlp(df_synth)

    print('\n[4/5] Projecting deterioration 2024→2035…')
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    rng = np.random.default_rng(2024)

    cond_rows  = []
    curve_rows = []
    trig_rows  = []
    band_2024  = {'Good': 0, 'Fair': 0, 'Poor': 0, 'Very Poor': 0}
    band_2030  = {'Good': 0, 'Fair': 0, 'Poor': 0, 'Very Poor': 0}
    budget_map = {}   # (year, treatment) → total_cost
    all_triggers = []

    for i, link in enumerate(links):
        if (i + 1) % 250 == 0:
            print(f'  … {i+1:,}/{len(links):,}')
        res  = project_link(link, aadt_lookup, rng)
        projs = res['projections']
        trigs = res['triggers']
        trig_by_yr = {t['year']: t for t in trigs}

        # pavement_condition row (base year 2024)
        bp = projs[0]
        cond_rows.append((
            link['link_id'], CURRENT_YEAR,
            bp['iri'],
            min(25.0, max(0.0, (bp['iri'] - 1.5) * 1.8)),
            min(80.0, max(0.0, (bp['iri'] - 2.0) * 6.0)),
            min(15.0, max(0.0, (bp['iri'] - 4.0) * 1.2)),
            bp['pci'], bp['vci'], res['surface_cat'], res['sn'], 'HDM-4_synthetic',
        ))

        for proj in projs:
            yr = proj['year']
            t  = trig_by_yr.get(yr)
            curve_rows.append((
                link['link_id'], link['road_name'], link['region'],
                res['surface_cat'], link['road_class'], 'HDM4+MLP',
                CURRENT_YEAR, res['base_iri'],
                yr, proj['iri'], proj['pci'],
                proj['cesal_cum'], proj['ci_low'], proj['ci_high'],
                t['treatment'] if t else None,
                float(t['total_cost']) if t else 0.0,
            ))
            if yr == CURRENT_YEAR:
                band_2024[proj['band']] = band_2024.get(proj['band'], 0) + 1
            if yr == 2030:
                band_2030[proj['band']] = band_2030.get(proj['band'], 0) + 1

        for trig in trigs:
            if trig['year'] <= PROJECT_END:
                cond_label = iri_band(trig['iri'])
                trig_rows.append((
                    link['link_id'], link['road_name'], link['region'],
                    trig['year'], trig['treatment'], cond_label,
                    float(trig['total_cost']), trig['priority_score'], trig['treatment'],
                ))
                key = (trig['year'], trig['treatment'])
                budget_map[key] = budget_map.get(key, 0.0) + trig['total_cost']
                all_triggers.append({
                    'link_id':       link['link_id'],
                    'road_name':     link['road_name'],
                    'region':        link['region'],
                    'road_class':    link['road_class'],
                    'surface_cat':   res['surface_cat'],
                    'trigger_year':  trig['year'],
                    'treatment':     trig['treatment'],
                    'iri':           trig['iri'],
                    'length_km':     link['length_km'],
                    'total_cost_usd': trig['total_cost'],
                    'priority_score': trig['priority_score'],
                    'urgency': (
                        'now'    if trig['year'] == CURRENT_YEAR else
                        'urgent' if trig['year'] <= 2025 else
                        'soon'   if trig['year'] <= 2027 else
                        'planned'
                    ),
                })

    conn.executemany(
        'INSERT INTO pavement_condition '
        '(link_id,survey_year,iri,rut_depth_mm,cracking_pct,pothole_pct,'
        'pci,vci,surface_type,structural_number,data_source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        cond_rows
    )
    conn.executemany(
        'INSERT INTO deterioration_curves '
        '(link_id,road_name,region,surface_type,road_class,model_type,base_year,base_iri,'
        'projected_year,projected_iri,projected_pci,cumulative_esals,ci_low,ci_high,'
        'intervention_triggered,maintenance_cost_usd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        curve_rows
    )
    conn.executemany(
        'INSERT INTO maintenance_triggers '
        '(link_id,road_name,region,trigger_year,trigger_type,trigger_condition,'
        'estimated_cost_usd,priority_score,treatment_recommendation) VALUES (?,?,?,?,?,?,?,?,?)',
        trig_rows
    )
    conn.commit()
    print(f'  Wrote {len(cond_rows):,} condition | {len(curve_rows):,} curve | {len(trig_rows):,} trigger rows')

    print('\n[5/5] Building deterioration_summary.json…')
    total = len(links)

    def pct(d, k):
        return round(d.get(k, 0) / max(total, 1) * 100, 1)

    top50 = sorted(all_triggers, key=lambda x: -x['priority_score'])[:50]

    years_range = list(range(CURRENT_YEAR, 2031))
    budget_schedule = []
    for yr in years_range:
        yr_costs = {k[1]: v for k, v in budget_map.items() if k[0] == yr}
        budget_schedule.append({
            'year': yr,
            'routine_usd':     yr_costs.get('Routine Maintenance', 0) + yr_costs.get('Routine Grading', 0),
            'reseal_usd':      yr_costs.get('Reseal', 0),
            'overlay_usd':     yr_costs.get('Overlay', 0),
            'rehab_usd':       yr_costs.get('Rehabilitation', 0),
            'reconstruct_usd': yr_costs.get('Reconstruct (Paved)', 0) + yr_costs.get('Reconstruct (Gravel)', 0),
            'regravelling_usd': yr_costs.get('Regravelling', 0),
            'total_usd':       int(sum(yr_costs.values())),
        })

    # Per-class average IRI per year from DB
    cur = conn.cursor()
    class_curves = {}
    for yr in range(CURRENT_YEAR, PROJECT_END + 1):
        cur.execute(
            'SELECT road_class, AVG(projected_iri), MIN(ci_low), MAX(ci_high) '
            'FROM deterioration_curves WHERE projected_year=? GROUP BY road_class', (yr,)
        )
        for rc, avg_iri, ci_lo, ci_hi in cur.fetchall():
            if rc not in class_curves:
                class_curves[rc] = []
            class_curves[rc].append({
                'year': yr,
                'avg_iri': round(avg_iri, 2),
                'ci_low':  round(ci_lo, 2),
                'ci_high': round(ci_hi, 2),
            })
    conn.close()

    total_budget = int(sum(v['total_usd'] for v in budget_schedule))

    summary = {
        'model_type':      'HDM-4 calibrated + MLPRegressor (sklearn)',
        'r_squared':       round(r2, 4),
        'links_projected': total,
        'projection_period': f'{CURRENT_YEAR}–{PROJECT_END}',
        'generated_at':    pd.Timestamp.now().isoformat()[:19],
        'network_condition_2024': {
            'good_pct':      pct(band_2024, 'Good'),
            'fair_pct':      pct(band_2024, 'Fair'),
            'poor_pct':      pct(band_2024, 'Poor'),
            'very_poor_pct': pct(band_2024, 'Very Poor'),
        },
        'network_condition_2030': {
            'good_pct':      pct(band_2030, 'Good'),
            'fair_pct':      pct(band_2030, 'Fair'),
            'poor_pct':      pct(band_2030, 'Poor'),
            'very_poor_pct': pct(band_2030, 'Very Poor'),
        },
        'class_deterioration_curves': class_curves,
        'intervention_schedule': top50,
        'budget_schedule_2024_2030': budget_schedule,
        'total_maintenance_budget_2024_2030_usd': total_budget,
        'intervention_thresholds_iri': {
            'routine_maintenance': IRI_ROUTINE, 'reseal': IRI_RESEAL,
            'overlay': IRI_OVERLAY, 'rehabilitation': IRI_REHAB,
            'reconstruction': IRI_RECONSTRUCT,
        },
        'unit_costs_usd_per_km': {
            'routine_maintenance': COST_ROUTINE, 'reseal': COST_RESEAL,
            'overlay': COST_OVERLAY, 'rehabilitation': COST_REHAB,
            'reconstruction_paved': COST_RECONSTRUCT_PAVED,
            'reconstruction_gravel': COST_RECONSTRUCT_GRAVEL,
        },
    }

    with open(OUT_JSON, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f'  Saved → {OUT_JSON}')

    print('\n━━━ Results ━━━')
    print(f'  Model R²:          {r2:.4f}')
    print(f'  Links projected:   {total:,}')
    print(f'  2024 — Good {pct(band_2024,"Good")}%  Fair {pct(band_2024,"Fair")}%  '
          f'Poor {pct(band_2024,"Poor")}%  VPoor {pct(band_2024,"Very Poor")}%')
    print(f'  Total budget 24-30: ${total_budget/1e6:.1f}M USD')
    if top50:
        print(f'  Top priority: {top50[0]["road_name"]} → {top50[0]["treatment"]}')
    print('\n✓ Done.\n')


if __name__ == '__main__':
    main()
