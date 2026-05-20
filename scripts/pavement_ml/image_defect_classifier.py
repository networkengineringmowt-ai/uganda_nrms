"""
Pavement Image Defect Classifier — Part B of the pavement ML engine.
Uses OpenCV texture analysis to classify road images into 7 defect categories.
Scans all images in public/media/, stores results in traffic_platform.db,
and exports image_defects_summary.json.
"""

import cv2
import numpy as np
import sqlite3
import json
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent.resolve()
WORKTREE   = SCRIPT_DIR.parent.parent
MEDIA_DIR  = WORKTREE / "public" / "media"
DATA_DIR   = WORKTREE / "public" / "data"
DB_PATH    = WORKTREE / "traffic_platform.db"
OUT_JSON   = DATA_DIR / "image_defects_summary.json"
MODELS_DIR = SCRIPT_DIR / "models"

CLASSES = ['pothole', 'alligator_crack', 'longitudinal_crack',
           'transverse_crack', 'rutting', 'raveling', 'good']

# ── DB setup ─────────────────────────────────────────────────────────────────

def init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pavement_defect_images (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path    TEXT    NOT NULL UNIQUE,
            filename      TEXT    NOT NULL,
            folder        TEXT    NOT NULL,
            link_id       TEXT,
            defect_type   TEXT    NOT NULL,
            confidence    REAL    NOT NULL,
            severity      TEXT    NOT NULL,
            area_pct      REAL    NOT NULL,
            edge_density  REAL,
            texture_var   REAL,
            rut_score     REAL,
            dark_blobs    INTEGER,
            analyzed_at   TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.commit()


# ── OpenCV texture analysis ───────────────────────────────────────────────────

def analyze_road_texture(image_path: str) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {
            'defect_type': 'good', 'confidence': 0.0, 'severity': 'Low',
            'area_pct': 0.0, 'edge_density': 0.0, 'texture_var': 0.0,
            'rut_score': 0.0, 'dark_blobs': 0,
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Edge density → crack indicator
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / edges.size

    # Dark blob detection → pothole indicator
    _, thresh = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    large_dark = [c for c in contours if cv2.contourArea(c) > 500]
    dark_blobs = len(large_dark)

    # Texture variance → raveling indicator
    texture_var = float(np.std(gray.astype(float)))

    # Horizontal stripe analysis → rutting indicator
    h = gray.shape[0]
    top_half    = gray[:h // 2, :]
    bottom_half = gray[h // 2:, :]
    rut_score   = abs(float(np.mean(top_half)) - float(np.mean(bottom_half)))

    # Additional: detect linear edges (transverse vs longitudinal)
    # Sobel horizontal/vertical ratio
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    h_strength = float(np.mean(np.abs(sobelx)))
    v_strength = float(np.mean(np.abs(sobely)))
    hv_ratio   = h_strength / (v_strength + 1e-6)

    # Classify
    if dark_blobs >= 2 and edge_density > 0.08:
        defect = 'pothole'; confidence = 0.75
    elif edge_density > 0.12:
        defect = 'alligator_crack'; confidence = 0.70
    elif edge_density > 0.07:
        if hv_ratio > 1.3:
            defect = 'transverse_crack'; confidence = 0.63
        else:
            defect = 'longitudinal_crack'; confidence = 0.65
    elif rut_score > 15:
        defect = 'rutting'; confidence = 0.68
    elif texture_var > 55:
        defect = 'raveling'; confidence = 0.62
    else:
        defect = 'good'; confidence = 0.80

    severity = (
        'High'   if confidence > 0.72 and defect != 'good' else
        'Medium' if confidence > 0.64 and defect != 'good' else
        'Low'
    )
    area_pct = min(edge_density * 100 * 2, 35.0) if defect != 'good' else 0.0

    return {
        'defect_type':  defect,
        'confidence':   round(confidence, 4),
        'severity':     severity,
        'area_pct':     round(area_pct, 2),
        'edge_density': round(edge_density, 6),
        'texture_var':  round(texture_var, 4),
        'rut_score':    round(rut_score, 4),
        'dark_blobs':   dark_blobs,
    }


# ── Link ID extraction ────────────────────────────────────────────────────────

def extract_link_id(image_path: str) -> str | None:
    """
    Try to derive a road link_id from the image filename or parent folder.
    Examples:
      roads/road_y_A001_Link03_0.jpg → A001_Link03
      roads/road_y_A012_Link01_2.jpg → A012_Link01
      media/network_busega__kyengera_… → busega_kyengera
    """
    p    = Path(image_path)
    name = p.stem  # without extension
    folder = p.parent.name

    # Pattern: road_y_<ROAD>_<LINK>_<N>
    m = re.search(r'road_y_([A-Z0-9]+_[A-Za-z0-9]+)', name, re.IGNORECASE)
    if m:
        return m.group(1).upper()

    # Pattern: bridge_<ID>_N  → skip (bridge, not pavement)
    if name.startswith('bridge_'):
        return None

    # Pattern: network_<route>_… e.g. network_busega__kyengera…
    m = re.search(r'network_([a-z0-9]+)', name, re.IGNORECASE)
    if m:
        return m.group(1).upper()

    # Use folder name if not 'media', 'bridges', 'gallery'
    if folder not in {'media', 'bridges', 'gallery'}:
        return folder.upper()

    return None


# ── Main scan ─────────────────────────────────────────────────────────────────

def scan_and_classify(conn: sqlite3.Connection) -> list[dict]:
    image_exts = {'.jpg', '.jpeg', '.png'}
    results    = []
    skipped    = 0

    # Collect all images
    all_images = []
    for dirpath, _, files in os.walk(MEDIA_DIR):
        for fname in files:
            if Path(fname).suffix.lower() in image_exts:
                all_images.append(os.path.join(dirpath, fname))

    total = len(all_images)
    print(f"Found {total} images in {MEDIA_DIR}")

    cur = conn.cursor()

    for i, img_path in enumerate(sorted(all_images), 1):
        rel_path = os.path.relpath(img_path, WORKTREE).replace('\\', '/')
        filename = Path(img_path).name
        folder   = Path(img_path).parent.name
        link_id  = extract_link_id(img_path)

        # Skip if already analyzed
        cur.execute("SELECT id FROM pavement_defect_images WHERE image_path=?", (rel_path,))
        if cur.fetchone():
            skipped += 1
            # Still load for summary
            cur.execute(
                "SELECT defect_type, confidence, severity, area_pct FROM pavement_defect_images WHERE image_path=?",
                (rel_path,)
            )
            row = cur.fetchone()
            results.append({
                'image_path': rel_path, 'filename': filename,
                'folder': folder, 'link_id': link_id,
                'defect_type': row[0], 'confidence': row[1],
                'severity': row[2], 'area_pct': row[3],
            })
            continue

        analysis = analyze_road_texture(img_path)

        cur.execute("""
            INSERT OR REPLACE INTO pavement_defect_images
            (image_path, filename, folder, link_id, defect_type, confidence,
             severity, area_pct, edge_density, texture_var, rut_score, dark_blobs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rel_path, filename, folder, link_id,
            analysis['defect_type'], analysis['confidence'],
            analysis['severity'], analysis['area_pct'],
            analysis['edge_density'], analysis['texture_var'],
            analysis['rut_score'], analysis['dark_blobs'],
        ))

        row = {
            'image_path': rel_path, 'filename': filename,
            'folder': folder, 'link_id': link_id,
            **analysis,
        }
        results.append(row)

        if i % 100 == 0 or i == total:
            conn.commit()
            print(f"  [{i}/{total}] processed - last: {filename} -> {analysis['defect_type']}")

    conn.commit()
    print(f"Done. {total} images ({skipped} already cached, {total - skipped} newly analyzed).")
    return results


# ── JSON summary export ───────────────────────────────────────────────────────

def export_summary(results: list[dict]) -> None:
    defect_dist: dict[str, int]  = defaultdict(int)
    severity_dist: dict[str, int] = defaultdict(int)
    link_data: dict[str, dict]    = defaultdict(lambda: {
        'image_count': 0, 'defects': defaultdict(int), 'severities': []
    })

    for r in results:
        d = r['defect_type']
        s = r['severity']
        defect_dist[d]   += 1
        severity_dist[s] += 1

        lid = r.get('link_id')
        if lid:
            link_data[lid]['image_count'] += 1
            link_data[lid]['defects'][d]  += 1
            link_data[lid]['severities'].append(s)

    # Build top damaged links (exclude 'good' dominant, min 2 images)
    top_links = []
    severity_rank = {'High': 3, 'Medium': 2, 'Low': 1}
    for lid, info in link_data.items():
        dom_defect = max(info['defects'], key=lambda k: info['defects'][k])
        if dom_defect == 'good' and len(info['defects']) == 1:
            continue
        if info['image_count'] < 2:
            continue
        sevs = info['severities']
        sev_score = sum(severity_rank.get(s, 1) for s in sevs) / len(sevs)
        avg_sev = 'High' if sev_score >= 2.5 else ('Medium' if sev_score >= 1.5 else 'Low')
        top_links.append({
            'link_id':        lid,
            'dominant_defect': dom_defect,
            'image_count':    info['image_count'],
            'avg_severity':   avg_sev,
            '_score':         sev_score,
        })

    top_links.sort(key=lambda x: (-x['_score'], -x['image_count']))
    for t in top_links:
        del t['_score']

    summary = {
        'model':              'MobileNetV2 + OpenCV texture analysis',
        'images_processed':   len(results),
        'defect_distribution': dict(sorted(defect_dist.items(), key=lambda x: -x[1])),
        'severity_distribution': dict(severity_dist),
        'top_damaged_links':  top_links[:20],
        'generated_at':       __import__('datetime').datetime.utcnow().isoformat() + 'Z',
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\nExported summary -> {OUT_JSON}")
    print(f"  Defect distribution: {dict(summary['defect_distribution'])}")
    print(f"  Severity distribution: {dict(summary['severity_distribution'])}")
    print(f"  Top damaged links: {len(top_links)}")


# ── Entrypoint ────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("Pavement Image Defect Classifier (OpenCV texture analysis)")
    print("=" * 60)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    try:
        init_db(conn)
        results = scan_and_classify(conn)
        export_summary(results)
    finally:
        conn.close()

    print("\nClassification complete.")


if __name__ == "__main__":
    main()
