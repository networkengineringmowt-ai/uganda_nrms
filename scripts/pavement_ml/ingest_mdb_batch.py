#!/usr/bin/env python3
"""
Batch ingest of ROMDAS 2021-22 .mdb survey files.

Each .mdb covers one road link and contains:
  Roughness_Processed_*  -- IRI at 100 m intervals (same schema as 2020 xlsx)
  GPS_Processed_*        -- lat/lon per chainage (new: not in 2020 files)
  Survey_Header          -- road name, survey date

Link ID is resolved by:
  1. GPS centroid -> nearest LineString in road_network.geojson (Shapely)
  2. Fallback: token-match road name against deterioration_curves.road_name

Usage:
  python ingest_mdb_batch.py [--dry-run] [--dir PATH]
"""

import re, os, sys, json, math, sqlite3, argparse, logging, warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import pyodbc
from shapely.geometry import Point, shape

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('mdb_ingest')

BASE       = Path(__file__).resolve().parents[2]
DB_PATH    = str(BASE / 'traffic_platform.db')
GEOJSON    = BASE / 'public' / 'road_network.geojson'
OUT_JSON   = str(BASE / 'public' / 'data' / 'romdas_sections_summary.json')

MDB_ROOT   = Path(
    'D:/OneDrive/Annual National Road Network Performance Monitoring'
    '/2020-21/ROMDAS Data 2021-22'
)

SURVEY_YEAR      = 2021
IRI_SUSPECT_HIGH = 25.0
SPEED_MIN_KMH    = 20.0
SPEED_MAX_KMH    = 90.0
GPS_MATCH_KM     = 1.0   # max distance to snap to a road link


# ── Spatial index for road_network.geojson ────────────────────────────────────

def build_link_index(geojson_path: Path):
    """Return list of (link_id, link_name, Shapely geometry) from GeoJSON."""
    with open(geojson_path, encoding='utf-8') as f:
        gj = json.load(f)
    index = []
    for feat in gj['features']:
        props = feat.get('properties', {})
        lid   = props.get('link_id', '')
        name  = props.get('link_name', props.get('road', ''))
        geom  = shape(feat['geometry'])
        if lid:
            index.append((lid, name, geom))
    return index


def nearest_link(lat: float, lon: float, index: list, max_km: float = GPS_MATCH_KM):
    """Return (link_id, dist_km) of the nearest road link within max_km."""
    pt = Point(lon, lat)   # GeoJSON is lon,lat
    best_lid  = None
    best_dist = float('inf')
    # approx degrees -> km (Uganda ~1 deg lat = 111 km, 1 deg lon = ~109 km)
    for lid, _name, geom in index:
        try:
            d_deg = geom.distance(pt)
            d_km  = d_deg * 110.0
            if d_km < best_dist:
                best_dist = d_km
                best_lid  = lid
        except Exception:
            continue
    if best_dist <= max_km:
        return best_lid, best_dist
    return None, best_dist


# ── Road-name fallback matching ───────────────────────────────────────────────

def build_name_map(conn: sqlite3.Connection):
    """Return {token_set_frozenset: link_id} from deterioration_curves."""
    rows = conn.execute(
        "SELECT DISTINCT link_id, road_name FROM deterioration_curves "
        "WHERE road_name != '' AND link_id != ''"
    ).fetchall()
    result = {}
    for link_id, road_name in rows:
        tokens = frozenset(re.split(r'[\s\-/]+', road_name.upper()))
        result[tokens] = link_id
    return result


def name_to_link(survey_id: str, name_map: dict) -> str:
    """Token-overlap match between survey_id and road_name entries."""
    query_tokens = frozenset(re.split(r'[\s\-/]+', survey_id.upper()))
    best_lid   = ''
    best_score = 0
    for tokens, lid in name_map.items():
        overlap = len(query_tokens & tokens)
        if overlap > best_score:
            best_score = overlap
            best_lid   = lid
    return best_lid if best_score >= 2 else ''


# ── Quality flag ──────────────────────────────────────────────────────────────

def quality_flag(iri_mean, speed, qual_num) -> str:
    try:
        q = float(qual_num)
        if q == 0:
            return 'excluded'
        if q < 100:
            return 'suspect'
    except (TypeError, ValueError):
        pass
    if speed is not None and (speed < SPEED_MIN_KMH or speed > SPEED_MAX_KMH):
        return 'suspect'
    if iri_mean is not None and iri_mean > IRI_SUSPECT_HIGH:
        return 'suspect'
    return 'good'


# ── Parse one .mdb ────────────────────────────────────────────────────────────

def parse_mdb(mdb_path: Path, link_index: list, name_map: dict) -> tuple:
    """
    Returns (survey_id, link_id, road_name, survey_date, rows_list).
    rows_list is empty on failure.
    """
    try:
        conn_str = (
            f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};'
            f'DBQ={mdb_path};ReadOnly=1;'
        )
        mdb_conn = pyodbc.connect(conn_str, timeout=10)
    except Exception as exc:
        log.warning('Cannot open %s: %s', mdb_path.name, exc)
        return '', '', '', '', []

    try:
        cursor = mdb_conn.cursor()

        # Survey header
        cursor.execute('SELECT SURVEY_ID, SURVEY_DATE FROM Survey_Header')
        hdr = cursor.fetchone()
        if not hdr:
            return '', '', '', '', []
        survey_id   = str(hdr[0]).strip()
        survey_date = str(hdr[1])[:10] if hdr[1] else f'{SURVEY_YEAR}-01-01'

        # Find Roughness_Processed table name
        tables = [t.table_name for t in cursor.tables(tableType='TABLE')]
        rgh_table = next((t for t in tables if 'Roughness_Processed' in t), None)
        gps_table = next((t for t in tables if 'GPS_Processed' in t), None)

        if not rgh_table:
            log.warning('%s: no Roughness_Processed table', mdb_path.name)
            return survey_id, '', '', survey_date, []

        # GPS lookup table: chainage -> (lat, lon)
        gps_map = {}
        if gps_table:
            cursor.execute(
                f'SELECT CHAINAGE, LATITUDE, LONGITUDE FROM [{gps_table}] '
                f'WHERE CHAINAGE > 0'
            )
            for chain, lat, lon in cursor.fetchall():
                if lat and lon and abs(lat) < 90 and abs(lon) < 180:
                    gps_map[float(chain)] = (float(lat), float(lon))

        # GPS centroid for link matching
        if gps_map:
            lats = [v[0] for v in gps_map.values()]
            lons = [v[1] for v in gps_map.values()]
            cen_lat, cen_lon = float(np.mean(lats)), float(np.mean(lons))
            link_id, dist_km = nearest_link(cen_lat, cen_lon, link_index)
            if link_id:
                log.debug('%s -> %s (GPS %.2f km)', survey_id, link_id, dist_km)
            else:
                link_id = name_to_link(survey_id, name_map)
                log.debug('%s -> %s (name match)', survey_id, link_id)
        else:
            link_id = name_to_link(survey_id, name_map)
            log.debug('%s -> %s (name match, no GPS)', survey_id, link_id)

        # Read roughness rows
        cursor.execute(
            f'SELECT CHAINAGE, C_ROUGH_1, C_ROUGH_2, CALIB_RGH, SPEED, QUALITY '
            f'FROM [{rgh_table}] WHERE CHAINAGE > 0'
        )
        rgh_cols  = [c[0] for c in cursor.description]
        rgh_rows  = cursor.fetchall()

        rows = []
        for rec in rgh_rows:
            r = dict(zip(rgh_cols, rec))
            chainage = float(r.get('CHAINAGE', 0) or 0)
            iri_l    = float(r['C_ROUGH_1']) if r.get('C_ROUGH_1') else None
            iri_r_raw = r.get('C_ROUGH_2')
            iri_r    = float(iri_r_raw) if iri_r_raw and float(iri_r_raw) != 0.0 else None
            iri_m    = float(r['CALIB_RGH'])  if r.get('CALIB_RGH') else None
            speed    = float(r['SPEED'])       if r.get('SPEED') else None
            qual_num = r.get('QUALITY')

            # Auto unit correction (values > 100 are mm/m)
            for attr in ['iri_l', 'iri_r', 'iri_m']:
                v = locals()[attr]
                if v is not None and v > 100:
                    locals()[attr]  # just reference; reassign below
            if iri_l is not None and iri_l > 100: iri_l /= 1000.0
            if iri_r is not None and iri_r > 100: iri_r /= 1000.0
            if iri_m is not None and iri_m > 100: iri_m /= 1000.0

            if iri_m is None:
                parts = [v for v in [iri_l, iri_r] if v is not None]
                iri_m = sum(parts) / len(parts) if parts else None

            # GPS interpolation at this chainage
            lat, lon = None, None
            if gps_map:
                # Find nearest GPS chainage
                nearest_c = min(gps_map.keys(), key=lambda c: abs(c - chainage))
                if abs(nearest_c - chainage) <= 200:   # within 200 m
                    lat, lon = gps_map[nearest_c]

            rows.append({
                'survey_id':    f'ROMDAS2021_{survey_id}',
                'link_id':      link_id or '',
                'road_name':    survey_id,
                'chainage_m':   round(chainage, 1),
                'lat':          round(lat, 6)  if lat  is not None else None,
                'lon':          round(lon, 6)  if lon  is not None else None,
                'iri_left':     round(iri_l, 3) if iri_l is not None else None,
                'iri_right':    round(iri_r, 3) if iri_r is not None else None,
                'iri_mean':     round(iri_m, 3) if iri_m is not None else None,
                'rut_left_mm':  None,
                'rut_right_mm': None,
                'rut_max_mm':   None,
                'texture_mpd':  None,
                'survey_date':  survey_date,
                'survey_year':  SURVEY_YEAR,
                'speed_kmh':    round(speed, 1) if speed is not None else None,
                'data_quality': quality_flag(iri_m, speed, qual_num),
            })
        return survey_id, link_id or '', survey_id, survey_date, rows

    except Exception as exc:
        log.warning('Error parsing %s: %s', mdb_path.name, exc)
        return '', '', '', '', []
    finally:
        mdb_conn.close()


# ── Section aggregation (reused from ingest_roughness_batch) ─────────────────

def iri_to_condition(iri: float) -> str:
    if iri < 3.5:  return 'Good'
    if iri < 6.5:  return 'Fair'
    if iri < 9.0:  return 'Poor'
    return 'Very Poor'

def iri_to_vci(iri: float) -> float:
    return round(max(0.0, min(100.0, (16.0 - iri) / 0.14)), 1)

def pct_above_9(vals) -> float:
    if len(vals) == 0: return 0.0
    return round(100.0 * sum(1 for v in vals if v > 9.0) / len(vals), 1)


def build_romdas_sections(conn: sqlite3.Connection):
    """Aggregate all good measurements into romdas_sections (all survey years)."""
    from collections import defaultdict
    log.info('Rebuilding romdas_sections...')

    sql = """
    SELECT link_id, survey_year,
           AVG(iri_mean) AS mean_iri, MIN(iri_mean) AS min_iri, MAX(iri_mean) AS max_iri,
           COUNT(*)      AS n_intervals,
           MIN(chainage_m) AS section_start_m, MAX(chainage_m) AS section_end_m,
           AVG(rut_max_mm) AS mean_rut_mm, MAX(rut_max_mm) AS max_rut_mm,
           AVG(speed_kmh) AS avg_speed
    FROM   romdas_measurements
    WHERE  data_quality = 'good' AND iri_mean IS NOT NULL
      AND  link_id GLOB '*_Link*'
    GROUP  BY link_id, survey_year
    HAVING n_intervals >= 3
    """
    df = pd.read_sql(sql, conn)

    raw = defaultdict(list)
    for lid, yr, iri in conn.execute(
        "SELECT link_id, survey_year, iri_mean FROM romdas_measurements "
        "WHERE data_quality='good' AND iri_mean IS NOT NULL AND link_id GLOB '*_Link*'"
    ).fetchall():
        raw[(lid, yr)].append(iri)

    sd_map   = {k: round(float(np.std(v)), 3) if len(v) > 1 else 0.0 for k, v in raw.items()}
    pct9_map = {k: pct_above_9(v) for k, v in raw.items()}

    name_df    = pd.read_sql("SELECT DISTINCT link_id, road_name, region FROM deterioration_curves WHERE link_id != ''", conn)
    name_map   = dict(zip(name_df['link_id'], name_df['road_name']))
    region_map = dict(zip(name_df['link_id'], name_df['region']))

    surf_df  = pd.read_sql("SELECT link_id, surface_type FROM pavement_condition WHERE survey_year=2024", conn)
    surf_map = dict(zip(surf_df['link_id'], surf_df['surface_type']))

    conn.execute('DELETE FROM romdas_sections')
    section_rows = []
    for _, r in df.iterrows():
        lid  = str(r['link_id'])
        yr   = int(r['survey_year'])
        key  = (lid, yr)
        mean = float(r['mean_iri'])
        slen = max(0.0, (float(r['section_end_m']) - float(r['section_start_m']))) / 1000.0

        section_rows.append((
            lid,
            name_map.get(lid, r.get('link_id', '')),
            region_map.get(lid, ''),
            float(r['section_start_m']),
            float(r['section_end_m']),
            round(slen, 3),
            yr,
            round(mean, 3),
            sd_map.get(key, 0.0),
            pct9_map.get(key, 0.0),
            float(r['max_rut_mm']) if r['max_rut_mm'] else None,
            float(r['mean_rut_mm']) if r['mean_rut_mm'] else None,
            iri_to_condition(mean),
            iri_to_vci(mean),
            None,
            surf_map.get(lid, ''),
        ))

    conn.executemany("""
        INSERT INTO romdas_sections
        (link_id, road_name, region, section_start_m, section_end_m,
         section_length_km, survey_year, mean_iri, sd_iri, pct_above_9,
         max_rut_mm, mean_rut_mm, condition_class, vci, AADT_at_survey, surface_type)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, section_rows)
    conn.commit()
    log.info('romdas_sections: %d rows', len(section_rows))
    return len(section_rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--dir', default=str(MDB_ROOT))
    args = parser.parse_args()

    root = Path(args.dir)
    mdb_files = sorted(root.rglob('*.mdb'))
    log.info('Found %d .mdb files under %s', len(mdb_files), root)

    # Skip already ingested
    conn = sqlite3.connect(DB_PATH)
    already = {r[0] for r in conn.execute(
        "SELECT DISTINCT survey_id FROM romdas_measurements WHERE survey_id LIKE 'ROMDAS2021_%'"
    ).fetchall()}
    log.info('Already ingested: %d surveys', len(already))

    new_files = [f for f in mdb_files if not any(
        s.split('ROMDAS2021_', 1)[-1] in f.stem for s in already
    )]
    log.info('New files to ingest: %d', len(new_files))

    if args.dry_run:
        for f in new_files[:5]:
            print(f'  Would ingest: {f.name}')
        conn.close()
        return

    # Build spatial index and name map once
    log.info('Building road network spatial index...')
    link_index = build_link_index(GEOJSON) if GEOJSON.exists() else []
    name_map   = build_name_map(conn)
    log.info('  %d road links indexed', len(link_index))

    total_rows  = 0
    total_files = 0
    no_link     = 0
    batch       = []
    BATCH_SIZE  = 500

    for i, fp in enumerate(new_files, 1):
        survey_id, link_id, road_name, survey_date, rows = parse_mdb(fp, link_index, name_map)
        if not rows:
            continue
        if not link_id:
            no_link += 1
        batch.extend(rows)
        total_rows  += len(rows)
        total_files += 1

        if len(batch) >= BATCH_SIZE or i == len(new_files):
            if batch:
                conn.executemany("""
                    INSERT INTO romdas_measurements
                    (survey_id,link_id,road_name,chainage_m,lat,lon,
                     iri_left,iri_right,iri_mean,rut_left_mm,rut_right_mm,
                     rut_max_mm,texture_mpd,survey_date,survey_year,speed_kmh,data_quality)
                    VALUES
                    (:survey_id,:link_id,:road_name,:chainage_m,:lat,:lon,
                     :iri_left,:iri_right,:iri_mean,:rut_left_mm,:rut_right_mm,
                     :rut_max_mm,:texture_mpd,:survey_date,:survey_year,
                     :speed_kmh,:data_quality)
                """, batch)
                conn.commit()
                batch = []
        if i % 10 == 0 or i == len(new_files):
            log.info('  %d/%d files | %d rows | %d unmatched links',
                     i, len(new_files), total_rows, no_link)

    log.info('Ingested %d rows from %d files (%d with no link_id match)',
             total_rows, total_files, no_link)

    n_sections = build_romdas_sections(conn)

    # Summary stats
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM romdas_measurements')
    total_meas = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM romdas_measurements WHERE data_quality='good'")
    good_meas  = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT link_id) FROM romdas_measurements WHERE data_quality='good' AND link_id != ''")
    n_links    = cur.fetchone()[0]
    cur.execute('SELECT AVG(mean_iri), MIN(mean_iri), MAX(mean_iri) FROM romdas_sections WHERE survey_year=2021')
    avg_iri, min_iri, max_iri = cur.fetchone()
    cur.execute("SELECT condition_class, COUNT(*) FROM romdas_sections WHERE survey_year=2021 GROUP BY condition_class")
    cond_dist_2021 = dict(cur.fetchall())
    cur.execute("SELECT condition_class, COUNT(*) FROM romdas_sections WHERE survey_year=2020 GROUP BY condition_class")
    cond_dist_2020 = dict(cur.fetchall())
    conn.close()

    summary = {
        'generated_at':       datetime.now().isoformat()[:19],
        'total_measurements': total_meas,
        'good_measurements':  good_meas,
        'unique_links':       n_links,
        'section_rows':       n_sections,
        'survey_year_2020': {
            'condition_distribution': cond_dist_2020,
        },
        'survey_year_2021': {
            'mean_iri': round(avg_iri, 2) if avg_iri else None,
            'min_iri':  round(min_iri, 2) if min_iri else None,
            'max_iri':  round(max_iri, 2) if max_iri else None,
            'condition_distribution': cond_dist_2021,
        },
    }

    Path(OUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(summary, f, indent=2)
    log.info('Summary -> %s', OUT_JSON)

    print('\n=== MDB Batch Ingest Complete ===')
    print(f'  New rows      : {total_rows:,}')
    print(f'  Files ingested: {total_files} ({no_link} with unmatched link_id)')
    print(f'  Total in DB   : {total_meas:,} ({good_meas:,} good)')
    print(f'  Unique links  : {n_links}')
    print(f'  Sections      : {n_sections}')
    if avg_iri:
        print(f'  Mean IRI 2021 : {avg_iri:.2f} m/km  (range {min_iri:.1f}-{max_iri:.1f})')
    print(f'  Cond 2021     : {cond_dist_2021}')


if __name__ == '__main__':
    main()
