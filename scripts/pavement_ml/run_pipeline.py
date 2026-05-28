#!/usr/bin/env python3
"""
Uganda Roads ROMDAS PMS — Full Pipeline Runner
===============================================

Orchestrates the complete ML pipeline from raw data to frontend-ready JSON.
Run this after adding new ROMDAS survey data or to refresh all outputs.

Steps
-----
1. Setup DB tables (idempotent)
2. Ingest ROMDAS 2020 xlsx files          → romdas_measurements
3. Ingest ROMDAS 2021-22 .mdb files       → romdas_measurements
4. Build section aggregates               → romdas_sections
5. Train PyTorch MLP models               → models/*.joblib + models/*.pt
6. Predict full network                   → public/data/romdas_predictions.json
7. Export survey GeoJSON                  → public/data/romdas_survey_sections.geojson
8. HDM-4 calibration analysis             → public/data/romdas_calibration.json
9. Maintenance programme report           → public/data/maintenance_programme.json
10. Feature importance analysis            → public/data/model_feature_importance.json

Usage
-----
  python run_pipeline.py              # full pipeline
  python run_pipeline.py --from 5    # restart from step 5 (retrain)
  python run_pipeline.py --only 10   # run only step 10

Environment
-----------
  ROMDAS_2020_DIR  — path to Roughness_Processed_*.xlsx files (default: auto-detected)
  ROMDAS_MDB_DIR   — path to .mdb files (default: auto-detected)
"""

import sys, os, time, argparse, subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent


def run(label: str, cmd: list, cwd=BASE) -> bool:
    """Run a subprocess step, print timing, return success."""
    t0 = time.time()
    print(f'\n{"="*60}')
    print(f'  {label}')
    print(f'{"="*60}')
    result = subprocess.run(cmd, cwd=str(cwd), capture_output=False)
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f'  [FAILED] exit={result.returncode}  ({elapsed:.1f}s)')
        return False
    print(f'  [OK] ({elapsed:.1f}s)')
    return True


STEPS = [
    (1,  'Setup DB tables',
     [sys.executable, str(SCRIPTS / 'romdas_ingest.py'), '--setup']),

    (2,  'Ingest ROMDAS 2020 xlsx files',
     [sys.executable, str(SCRIPTS / 'ingest_roughness_batch.py')]),

    (3,  'Ingest ROMDAS 2021-22 .mdb files',
     [sys.executable, str(SCRIPTS / 'ingest_mdb_batch.py')]),

    (4,  'Build section aggregates from measurements',
     [sys.executable, '-c', '''
import sys; sys.path.insert(0, r"{scripts}")
from ingest_roughness_batch import build_romdas_sections
import sqlite3
from pathlib import Path
DB = str(Path(r"{base}") / "traffic_platform.db")
conn = sqlite3.connect(DB)
n = build_romdas_sections(conn)
conn.commit(); conn.close()
print(f"  Sections built/updated: {{n}}")
'''.format(scripts=str(SCRIPTS), base=str(BASE))]),

    (5,  'Train PyTorch MLP models',
     [sys.executable, str(SCRIPTS / 'romdas_ml_model.py')]),

    (6,  'Export survey sections GeoJSON',
     [sys.executable, str(SCRIPTS / 'export_survey_geojson.py')]),

    (7,  'HDM-4 calibration analysis',
     [sys.executable, str(SCRIPTS / 'calibration_analysis.py')]),

    (8,  'Generate maintenance programme report',
     [sys.executable, str(SCRIPTS / 'generate_maintenance_report.py')]),

    (9,  'Compute model feature importance',
     [sys.executable, str(SCRIPTS / 'feature_importance.py')]),
]


def main():
    parser = argparse.ArgumentParser(description='Run the Uganda ROMDAS PMS pipeline')
    parser.add_argument('--from', dest='from_step', type=int, default=1,
                        help='Start from step N (default: 1)')
    parser.add_argument('--only', dest='only_step', type=int, default=None,
                        help='Run only step N')
    args = parser.parse_args()

    if args.only_step:
        steps = [s for s in STEPS if s[0] == args.only_step]
    else:
        steps = [s for s in STEPS if s[0] >= args.from_step]

    if not steps:
        print('No matching steps found.')
        sys.exit(1)

    print('\n=== Uganda Roads ROMDAS PMS Pipeline ===')
    print(f'  Running {len(steps)} step(s), starting from step {steps[0][0]}')

    t_total = time.time()
    failed = []
    for step_num, label, cmd in steps:
        ok = run(f'Step {step_num}: {label}', cmd)
        if not ok:
            failed.append(step_num)
            print(f'\n  [WARN] Step {step_num} failed — continuing...')

    elapsed_total = time.time() - t_total
    print(f'\n{"="*60}')
    print(f'  Pipeline complete in {elapsed_total:.0f}s')
    if failed:
        print(f'  Failed steps: {failed}')
    else:
        print('  All steps succeeded.')
    print(f'{"="*60}\n')

    print('Output files:')
    outputs = [
        'public/data/romdas_predictions.json',
        'public/data/romdas_survey_sections.geojson',
        'public/data/romdas_calibration.json',
        'public/data/maintenance_programme.json',
        'public/data/model_feature_importance.json',
        'scripts/pavement_ml/models/iri_deterioration_mlp.pt',
        'scripts/pavement_ml/models/condition_classifier_mlp.pt',
        'scripts/pavement_ml/models/intervention_predictor_mlp.pt',
    ]
    for p in outputs:
        full = BASE / p
        if full.exists():
            print(f'  OK  {p}  ({full.stat().st_size // 1024} KB)')
        else:
            print(f'  --  {p}  (not found)')


if __name__ == '__main__':
    main()
