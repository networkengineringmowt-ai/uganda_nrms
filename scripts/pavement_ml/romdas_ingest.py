#!/usr/bin/env python3
"""
ROMDAS Data Ingestion Pipeline for Uganda PMS
==============================================
Supports file formats:
  - Standard ROMDAS CSV export  (chainage, IRI_L, IRI_R, Rut_L, Rut_R, GPS_lat, GPS_lon)
  - ROMDAS Summary Excel        (section-level statistics with mean IRI, max rut)
  - dTIMS-compatible roughness CSV (RoadID, StartDist, EndDist, IRI, Date)
  - Generic tabular files with IRI/roughness columns

Usage:
  python romdas_ingest.py --setup               # create DB tables only
  python romdas_ingest.py --file <path>         # ingest single file
  python romdas_ingest.py                       # ingest all files in data/romdas/
  python romdas_ingest.py --dir /path/to/files  # ingest from custom directory
"""

import os, math, json, sqlite3, logging, argparse, warnings
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('romdas_ingest')

BASE     = Path(__file__).resolve().parents[2]
DB_PATH  = str(BASE / 'traffic_platform.db')
DATA_DIR = Path(__file__).resolve().parent / 'data' / 'romdas'

# ── Column patterns for file-type detection ──────────────────────────────────
ROMDAS_CSV_PATTERNS = [
    ['chainage', 'iri_left', 'iri_right', 'rut_left', 'rut_right'],
    ['distance', 'iri_l', 'iri_r', 'rutting_l', 'rutting_r'],
    ['station', 'roughness', 'rut_depth'],
    ['chainage_m', 'iri', 'rutting'],
    ['dist_m', 'iri_mean', 'rut_mean'],
    ['chainage', 'iri', 'rut'],
    # ROMDAS 2020 Uganda export format (calibrated roughness channels)
    ['link', 'chainage', 'calib_rgh'],
    ['link', 'chainage', 'c_rough_1'],
]

DTIMS_PATTERNS = [
    ['roadid', 'startdist', 'enddist', 'iri'],
    ['road_id', 'start_dist', 'end_dist', 'iri'],
    ['link_id', 'from_chainage', 'to_chainage', 'roughness'],
    # Uganda dTIMS export format (RoadName, From, To, IRI)
    ['roadname', 'from', 'to', 'iri'],
    ['roadname', 'froomelement', 'toelement', 'iri'],
]

# Maps canonical field names to accepted CSV/Excel column name variants
COL_ALIASES = {
    'chainage':    ['chainage', 'chainage_m', 'distance', 'dist_m', 'station',
                    'start_dist', 'startdist', 'from_chainage', 'km', 'distance_m',
                    'from', 'froomelement', 'fromelement'],  # dTIMS 'From' in km
    'iri_left':    ['iri_left', 'iri_l', 'iri_lft', 'left_iri', 'roughness_l',
                    'irl', 'iri_l_mmm', 'liri', 'left_roughness',
                    'c_rough_1', 'raw_c_1_km'],              # ROMDAS 2020 channel 1
    'iri_right':   ['iri_right', 'iri_r', 'iri_rgt', 'right_iri', 'roughness_r',
                    'irr', 'iri_r_mmm', 'riri', 'right_roughness',
                    'c_rough_2', 'raw_c_2_km'],              # ROMDAS 2020 channel 2
    'iri_mean':    ['iri_mean', 'iri', 'roughness', 'iri_avg', 'mean_iri',
                    'iri_average', 'ri', 'iri_mv', 'avg_iri', 'iri_avg_lr',
                    'calib_rgh', 'calibrated_roughness'],    # ROMDAS 2020 calibrated IRI
    'rut_left':    ['rut_left', 'rut_l', 'rutting_l', 'rut_lft', 'rd_l',
                    'rut_depth_l', 'rdl', 'rut_l_mm', 'lrut'],
    'rut_right':   ['rut_right', 'rut_r', 'rutting_r', 'rut_rgt', 'rd_r',
                    'rut_depth_r', 'rdr', 'rut_r_mm', 'rrut'],
    'rut_mean':    ['rut_mean', 'rut_depth', 'rut', 'rutting', 'rd', 'rut_avg',
                    'mean_rut', 'rut_average', 'avg_rut', 'rut_mm'],
    'lat':         ['lat', 'latitude', 'gps_lat', 'gps_latitude', 'y_coord',
                    'northing_dd', 'lat_dd', 'wgs84_lat'],
    'lon':         ['lon', 'lng', 'longitude', 'gps_lon', 'gps_longitude',
                    'x_coord', 'easting_dd', 'lon_dd', 'wgs84_lon'],
    'speed':       ['speed', 'speed_kmh', 'vehicle_speed', 'spd', 'speed_kph'],
    'texture_mpd': ['texture', 'mpd', 'texture_mpd', 'mean_profile_depth',
                    'texture_depth', 'macro_texture'],
    'road_name':   ['road_name', 'road', 'link_name', 'route_name', 'name',
                    'roadname', 'road_id', 'roadid', 'link_id', 'section_name',
                    'link'],                                 # ROMDAS 2020 'LINK' column
    'survey_date': ['survey_date', 'date', 'measurement_date', 'obs_date',
                    'survey_day', 'date_of_survey', 'historic'],
    'quality_flag':['quality', 'data_quality', 'flag', 'qual'],  # ROMDAS numeric quality
}

IRI_SUSPECT_HIGH = 25.0   # m/km — above this → likely sensor error
IRI_UNITS_THRESH = 100.0  # if max IRI > 100, assume mm/m units → ÷1000
SPEED_MIN_KMH    = 20.0
SPEED_MAX_KMH    = 90.0
GPS_SNAP_M       = 200.0  # max distance (m) to snap GPS point to a road link


# ── DB schema ─────────────────────────────────────────────────────────────────

def setup_romdas_tables(conn: sqlite3.Connection):
    """Create ROMDAS tables if they don't already exist (idempotent)."""
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS romdas_measurements (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        survey_id      TEXT,
        link_id        TEXT,
        road_name      TEXT,
        chainage_m     REAL,
        lat            REAL,
        lon            REAL,
        iri_left       REAL,
        iri_right      REAL,
        iri_mean       REAL,
        rut_left_mm    REAL,
        rut_right_mm   REAL,
        rut_max_mm     REAL,
        texture_mpd    REAL,
        survey_date    TEXT,
        survey_year    INTEGER,
        speed_kmh      REAL,
        data_quality   TEXT
    );

    CREATE TABLE IF NOT EXISTS romdas_sections (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id           TEXT,
        road_name         TEXT,
        region            TEXT,
        section_start_m   REAL,
        section_end_m     REAL,
        section_length_km REAL,
        survey_year       INTEGER,
        mean_iri          REAL,
        sd_iri            REAL,
        pct_above_9       REAL,
        max_rut_mm        REAL,
        mean_rut_mm       REAL,
        condition_class   TEXT,
        vci               REAL,
        AADT_at_survey    REAL,
        surface_type      TEXT
    );

    CREATE TABLE IF NOT EXISTS romdas_ml_predictions (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id               TEXT,
        survey_year           INTEGER,
        predicted_iri_1yr     REAL,
        predicted_iri_3yr     REAL,
        predicted_iri_5yr     REAL,
        predicted_condition_1yr TEXT,
        deterioration_rate    REAL,
        intervention_year     INTEGER,
        intervention_type     TEXT,
        confidence_score      REAL,
        model_version         TEXT
    );
    """)
    conn.commit()
    log.info('ROMDAS tables created/verified')


# ── Utility helpers ───────────────────────────────────────────────────────────

def _norm_cols(columns) -> list:
    return [str(c).strip().lower().replace(' ', '_').replace('-', '_') for c in columns]


def resolve_col(cols_norm: list, canonical: str):
    """Return the normalised column name matching the canonical alias, or None."""
    for alias in COL_ALIASES.get(canonical, [canonical]):
        if alias in cols_norm:
            return alias
    return None


def _safe(val, fallback=None):
    try:
        f = float(val)
        return f if math.isfinite(f) else fallback
    except (TypeError, ValueError):
        return fallback


def _fix_iri_units(series: pd.Series) -> pd.Series:
    """Detect mm/m IRI units (max > 100) and convert to m/km (÷1000)."""
    vals = series.dropna()
    if len(vals) > 0 and vals.max() > IRI_UNITS_THRESH:
        log.warning('IRI values appear to be in mm/m (max=%.1f) — converting to m/km', vals.max())
        return series / 1000.0
    return series


def _quality_flag(iri_mean, speed, quality_num=None) -> str:
    """
    Derive data_quality string.
    quality_num: numeric ROMDAS quality score (0=excluded, 1-99=suspect, 100=good).
    """
    if quality_num is not None:
        try:
            q = float(quality_num)
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


def _normalise_link_id(raw: str) -> str:
    """Normalise ROMDAS link IDs to DB format: A001_LINK01 -> A001_Link01."""
    if not raw:
        return raw
    # Replace uppercase _LINK with _Link, _link with _Link
    import re
    return re.sub(r'_[Ll][Ii][Nn][Kk]', '_Link', str(raw).strip())


def _iri_to_condition(iri: float) -> str:
    if iri < 3.5:  return 'Good'
    if iri < 6.5:  return 'Fair'
    if iri < 9.0:  return 'Poor'
    return 'Very Poor'


def _iri_to_vci(iri: float) -> float:
    return round(max(0.0, min(100.0, (16.0 - iri) / 0.14)), 1)


# ── GPS snapping ──────────────────────────────────────────────────────────────

def match_to_road_link(lat: float, lon: float, road_network_geojson: str) -> str:
    """Snap GPS point to nearest road link (Haversine, segment-level). Returns link_id or ''."""
    try:
        with open(road_network_geojson, 'r') as f:
            gj = json.load(f)
        features = gj.get('features', [])
    except Exception:
        return ''

    R = 6_371_000.0

    def haversine(la1, lo1, la2, lo2):
        dlat = math.radians(la2 - la1)
        dlon = math.radians(lo2 - lo1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(la1)) * math.cos(math.radians(la2))
             * math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(min(1.0, a)))

    def seg_dist(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return haversine(py, px, ay, ax)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return haversine(py, px, ay + t * dy, ax + t * dx)

    best_id, best_d = '', float('inf')
    for feat in features:
        lid   = (feat.get('properties') or {}).get('link_id', '')
        geom  = feat.get('geometry', {})
        gtype = geom.get('type', '')
        coords = geom.get('coordinates', [])

        parts = [coords] if gtype == 'LineString' else (coords if gtype == 'MultiLineString' else [])
        for part in parts:
            for i in range(len(part) - 1):
                lo1, la1 = part[i][0], part[i][1]
                lo2, la2 = part[i + 1][0], part[i + 1][1]
                d = seg_dist(lon, lat, lo1, la1, lo2, la2)
                if d < best_d:
                    best_d, best_id = d, lid

    return best_id if best_d <= GPS_SNAP_M else ''


# ── File type detection ───────────────────────────────────────────────────────

def detect_romdas_file(filepath: str) -> str:
    """Returns 'romdas_raw' | 'romdas_summary' | 'dtims_roughness' | 'unknown'."""
    path = Path(filepath)
    ext  = path.suffix.lower()

    def read_head(n=5):
        if ext in ('.xlsx', '.xls'):
            return pd.read_excel(filepath, nrows=n)
        return pd.read_csv(filepath, nrows=n)

    try:
        df   = read_head()
        cols = _norm_cols(df.columns)

        if ext in ('.xlsx', '.xls'):
            if any(c in cols for c in ['mean_iri', 'avg_iri', 'section_length', 'section_length_km']):
                return 'romdas_summary'

        for pat in DTIMS_PATTERNS:
            if sum(1 for p in pat if p in cols) >= 3:
                return 'dtims_roughness'

        for pat in ROMDAS_CSV_PATTERNS:
            n_hit = sum(1 for p in pat if p in cols or
                        any(a in cols for a in COL_ALIASES.get(p, [])))
            if n_hit >= 2:
                return 'romdas_raw'
    except Exception:
        pass

    return 'unknown'


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_romdas_raw(filepath: str, survey_id: str, geojson_path: str = '') -> list:
    """Parse 100 m interval ROMDAS CSV/Excel → list of measurement dicts."""
    path = Path(filepath)
    try:
        df = (pd.read_excel(filepath)
              if path.suffix.lower() in ('.xlsx', '.xls')
              else pd.read_csv(filepath))
    except Exception as exc:
        log.error('Cannot read %s: %s', path.name, exc)
        return []

    cols_norm = _norm_cols(df.columns)
    col_map   = dict(zip(cols_norm, list(df.columns)))  # norm → original

    def gc(canonical):
        norm = resolve_col(cols_norm, canonical)
        return col_map[norm] if norm else None

    c_chain = gc('chainage')
    c_iri_l = gc('iri_left')
    c_iri_r = gc('iri_right')
    c_iri_m = gc('iri_mean')
    c_rut_l = gc('rut_left')
    c_rut_r = gc('rut_right')
    c_rut_m = gc('rut_mean')
    c_lat   = gc('lat')
    c_lon   = gc('lon')
    c_speed = gc('speed')
    c_tex   = gc('texture_mpd')
    c_road  = gc('road_name')
    c_date  = gc('survey_date')
    c_qual  = gc('quality_flag')  # ROMDAS numeric quality (0=excl, 100=good)

    # Fix IRI units before deduplication
    for col in [c_iri_l, c_iri_r, c_iri_m]:
        if col and col in df.columns:
            df[col] = _fix_iri_units(pd.to_numeric(df[col], errors='coerce'))

    # Zero IRI channel 2 means single-sensor — treat as missing (not 0 m/km)
    if c_iri_r and c_iri_r in df.columns:
        df[c_iri_r] = pd.to_numeric(df[c_iri_r], errors='coerce').replace(0.0, float('nan'))

    # Detect chainage in km (dTIMS 'From' column in km): max < 200 → assume km → ×1000
    if c_chain and c_chain in df.columns:
        df[c_chain] = pd.to_numeric(df[c_chain], errors='coerce')
        chain_max = df[c_chain].dropna().max()
        if 0 < chain_max < 200:
            log.info('Chainage appears to be in km (max=%.1f) — converting to metres', chain_max)
            df[c_chain] = df[c_chain] * 1000.0

    # Group by road_name+chainage when the file has multiple roads (e.g. IRI 2020.xlsx)
    # Deduplicate chainages by averaging numeric columns within each road section
    group_cols = []
    if c_road and c_road in df.columns:
        group_cols.append(c_road)
    if c_chain and c_chain in df.columns:
        df = df.dropna(subset=[c_chain])
        group_cols.append(c_chain)

    if group_cols:
        num_cols = df.select_dtypes(include='number').columns.tolist()
        # Keep first non-numeric value per group (road_name, date)
        str_cols = [c for c in df.columns if c not in num_cols and c not in group_cols]
        agg = {c: 'mean' for c in num_cols if c not in group_cols}
        for c in str_cols:
            agg[c] = 'first'
        df = df.groupby(group_cols, as_index=False).agg(agg)

    rows = []
    for _, row in df.iterrows():
        chainage  = _safe(row[c_chain] if c_chain else 0, 0.0)
        iri_l     = _safe(row[c_iri_l] if c_iri_l else None)
        iri_r     = _safe(row[c_iri_r] if c_iri_r else None)
        iri_m     = _safe(row[c_iri_m] if c_iri_m else None)
        rut_l     = _safe(row[c_rut_l] if c_rut_l else None)
        rut_r     = _safe(row[c_rut_r] if c_rut_r else None)
        rut_m     = _safe(row[c_rut_m] if c_rut_m else None)
        lat       = _safe(row[c_lat]   if c_lat   else None)
        lon       = _safe(row[c_lon]   if c_lon   else None)
        speed     = _safe(row[c_speed] if c_speed else None)
        texture   = _safe(row[c_tex]   if c_tex   else None)
        qual_num  = _safe(row[c_qual]  if c_qual  else None)
        road_nm   = str(row[c_road]).strip() if c_road and c_road in row.index else ''

        # Derive mean IRI (prefer explicit mean, then average of left/right)
        if iri_m is None:
            parts = [v for v in [iri_l, iri_r] if v is not None]
            iri_m = sum(parts) / len(parts) if parts else None

        rut_vals = [v for v in [rut_l, rut_r, rut_m] if v is not None]
        rut_max  = max(rut_vals) if rut_vals else None
        if rut_m is None and rut_vals:
            rut_m = sum(rut_vals) / len(rut_vals)

        raw_date = str(row[c_date]).strip() if c_date and c_date in row.index else ''
        try:
            dt = pd.to_datetime(raw_date)
            survey_date = dt.strftime('%Y-%m-%d')
            survey_year = int(dt.year)
        except Exception:
            survey_date = ''
            survey_year = datetime.now().year

        # Derive link_id: prefer road_name column (ROMDAS LINK field), then GPS snap
        link_id = _normalise_link_id(road_nm) if road_nm else ''
        if not link_id and lat and lon and geojson_path:
            link_id = match_to_road_link(lat, lon, geojson_path)
        # If road_name IS the link_id (e.g. 'A001_Link01'), use it as such
        road_name_str = road_nm if not road_nm.startswith(('A0', 'B', 'C', 'M')) else ''

        rows.append({
            'survey_id':    survey_id,
            'link_id':      link_id,
            'road_name':    road_name_str,
            'chainage_m':   round(chainage, 2),
            'lat':          lat,
            'lon':          lon,
            'iri_left':     round(iri_l, 3)    if iri_l    is not None else None,
            'iri_right':    round(iri_r, 3)    if iri_r    is not None else None,
            'iri_mean':     round(iri_m, 3)    if iri_m    is not None else None,
            'rut_left_mm':  round(rut_l, 2)    if rut_l    is not None else None,
            'rut_right_mm': round(rut_r, 2)    if rut_r    is not None else None,
            'rut_max_mm':   round(rut_max, 2)  if rut_max  is not None else None,
            'texture_mpd':  round(texture, 3)  if texture  is not None else None,
            'survey_date':  survey_date,
            'survey_year':  survey_year,
            'speed_kmh':    round(speed, 1)    if speed    is not None else None,
            'data_quality': _quality_flag(iri_m, speed, qual_num),
        })

    log.info('Parsed %d raw measurements from %s', len(rows), path.name)
    return rows


def parse_romdas_summary(filepath: str) -> list:
    """Parse section-level ROMDAS Excel summary → list of section dicts."""
    path = Path(filepath)
    try:
        df = (pd.read_excel(filepath)
              if path.suffix.lower() in ('.xlsx', '.xls')
              else pd.read_csv(filepath))
    except Exception as exc:
        log.error('Cannot read summary %s: %s', path.name, exc)
        return []

    cols_norm = _norm_cols(df.columns)
    col_map   = dict(zip(cols_norm, list(df.columns)))

    def gc(canonical):
        norm = resolve_col(cols_norm, canonical)
        return col_map[norm] if norm else None

    c_iri_m  = gc('iri_mean')   or gc('iri_left')
    c_road   = gc('road_name')
    c_date   = gc('survey_date')
    c_start  = gc('chainage')
    c_rut_m  = gc('rut_mean')   or gc('rut_left')
    c_rut_mx = gc('rut_right')
    c_sd     = None  # sd_iri rarely exported; estimate if absent

    rows = []
    for _, row in df.iterrows():
        mean_iri = _safe(row[c_iri_m] if c_iri_m else None)
        if mean_iri is None:
            continue

        raw_date = str(row[c_date]).strip() if c_date else ''
        try:
            dt = pd.to_datetime(raw_date)
            survey_year = int(dt.year)
        except Exception:
            survey_year = datetime.now().year

        s_start = _safe(row[c_start] if c_start else None, 0.0)
        s_end   = _safe(row[c_rut_mx] if c_rut_mx else None, s_start)

        rows.append({
            'link_id':           '',
            'road_name':         str(row[c_road]).strip() if c_road else '',
            'region':            '',
            'section_start_m':   s_start,
            'section_end_m':     s_end,
            'section_length_km': max(0.0, (s_end - s_start) / 1000.0) if s_end else 0.0,
            'survey_year':       survey_year,
            'mean_iri':          round(mean_iri, 3),
            'sd_iri':            None,
            'pct_above_9':       round(100.0 / (1.0 + math.exp(-1.5 * (mean_iri - 9.0))), 1),
            'max_rut_mm':        _safe(row[c_rut_mx] if c_rut_mx else None),
            'mean_rut_mm':       _safe(row[c_rut_m]  if c_rut_m  else None),
            'condition_class':   _iri_to_condition(mean_iri),
            'vci':               _iri_to_vci(mean_iri),
            'AADT_at_survey':    None,
            'surface_type':      '',
        })

    log.info('Parsed %d section rows from %s', len(rows), path.name)
    return rows


# ── Ingestion orchestrator ────────────────────────────────────────────────────

def ingest_file(filepath: str, db_path: str = DB_PATH,
                geojson_path: str = '') -> dict:
    """Auto-detect, parse, and insert one ROMDAS file into the DB."""
    file_type = detect_romdas_file(filepath)
    log.info('%s detected as: %s', Path(filepath).name, file_type)

    survey_id = Path(filepath).stem + '_' + datetime.now().strftime('%Y%m%d')
    conn = sqlite3.connect(db_path)
    setup_romdas_tables(conn)

    if file_type in ('romdas_raw', 'dtims_roughness'):
        rows = parse_romdas_raw(filepath, survey_id, geojson_path)
        if rows:
            conn.executemany('''
                INSERT INTO romdas_measurements
                (survey_id,link_id,road_name,chainage_m,lat,lon,
                 iri_left,iri_right,iri_mean,rut_left_mm,rut_right_mm,
                 rut_max_mm,texture_mpd,survey_date,survey_year,speed_kmh,data_quality)
                VALUES (:survey_id,:link_id,:road_name,:chainage_m,:lat,:lon,
                        :iri_left,:iri_right,:iri_mean,:rut_left_mm,:rut_right_mm,
                        :rut_max_mm,:texture_mpd,:survey_date,:survey_year,
                        :speed_kmh,:data_quality)
            ''', rows)
            conn.commit()
        conn.close()
        return {'file_type': file_type, 'rows_inserted': len(rows)}

    elif file_type == 'romdas_summary':
        rows = parse_romdas_summary(filepath)
        if rows:
            conn.executemany('''
                INSERT INTO romdas_sections
                (link_id,road_name,region,section_start_m,section_end_m,
                 section_length_km,survey_year,mean_iri,sd_iri,pct_above_9,
                 max_rut_mm,mean_rut_mm,condition_class,vci,AADT_at_survey,surface_type)
                VALUES (:link_id,:road_name,:region,:section_start_m,:section_end_m,
                        :section_length_km,:survey_year,:mean_iri,:sd_iri,:pct_above_9,
                        :max_rut_mm,:mean_rut_mm,:condition_class,:vci,
                        :AADT_at_survey,:surface_type)
            ''', rows)
            conn.commit()
        conn.close()
        return {'file_type': file_type, 'rows_inserted': len(rows)}

    log.warning('Unrecognised file type for %s — skipping', filepath)
    conn.close()
    return {'file_type': 'unknown', 'rows_inserted': 0}


def ingest_directory(dir_path: str, db_path: str = DB_PATH,
                     geojson_path: str = '') -> int:
    """Ingest all supported files in a directory. Returns total rows inserted."""
    total = 0
    for pattern in ('*.csv', '*.dat', '*.txt', '*.xlsx', '*.xls'):
        for fp in Path(dir_path).glob(pattern):
            result = ingest_file(str(fp), db_path, geojson_path)
            total += result.get('rows_inserted', 0)
    log.info('Total rows inserted: %d', total)
    return total


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='ROMDAS PMS Ingestion Pipeline')
    parser.add_argument('--file',    help='Single ROMDAS file to ingest')
    parser.add_argument('--dir',     default=str(DATA_DIR),
                        help='Directory to scan (default: data/romdas/)')
    parser.add_argument('--db',      default=DB_PATH, help='SQLite DB path')
    parser.add_argument('--geojson', default='',
                        help='Road network GeoJSON for GPS snapping')
    parser.add_argument('--setup',   action='store_true',
                        help='Create DB tables only, then exit')
    args = parser.parse_args()

    if args.setup:
        conn = sqlite3.connect(args.db)
        setup_romdas_tables(conn)
        conn.close()
        print('ROMDAS DB tables created.')
        return

    if args.file:
        r = ingest_file(args.file, args.db, args.geojson)
        print(f"Inserted {r['rows_inserted']} rows  ({r['file_type']})")
    else:
        n = ingest_directory(args.dir, args.db, args.geojson)
        print(f'Done. Total rows inserted: {n}')


if __name__ == '__main__':
    main()
