#!/usr/bin/env python3
"""
Compute monthly, seasonal, and annual growth factors from traffic_counts.
Uganda seasons:
  Long Rains  = March–May     (months 3,4,5)
  Dry Season 1= June–August   (months 6,7,8)
  Short Rains = September–Nov (months 9,10,11)
  Dry Season 2= December–Feb  (months 12,1,2)
"""

import sqlite3, json, math
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

DB_PATH      = Path(__file__).parent.parent / "data" / "traffic_platform.db"
OUTPUT_JSON  = Path(__file__).parent.parent / "public" / "data" / "growth_factors_summary.json"

# Vehicle class → DB column mapping
VC_COLS: dict[str, str] = {
    "motorcycle": "motorcycles",
    "car":        "cars_taxis",
    "hgv":        "trucks",
    "bus":        "buses",
    "nmt":        "nmt",
    "total":      "total_count",
}

SEASONS: dict[str, list[int]] = {
    "long_rains":  [3, 4, 5],
    "dry1":        [6, 7, 8],
    "short_rains": [9, 10, 11],
    "dry2":        [12, 1, 2],
}
MONTH_TO_SEASON: dict[int, str] = {}
for _s, _ms in SEASONS.items():
    for _m in _ms:
        MONTH_TO_SEASON[_m] = _s

NEW_TABLES = """
CREATE TABLE IF NOT EXISTS monthly_factors (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id       TEXT,
    station_id    TEXT,
    region        TEXT,
    year          INTEGER,
    month         INTEGER,
    vehicle_class TEXT,
    monthly_aadt  REAL,
    annual_aadt   REAL,
    mef           REAL,
    sample_days   INTEGER,
    UNIQUE(link_id, station_id, region, year, month, vehicle_class)
);
CREATE TABLE IF NOT EXISTS seasonal_factors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id         TEXT,
    station_id      TEXT,
    region          TEXT,
    year            INTEGER,
    season          TEXT,
    season_months   TEXT,
    vehicle_class   TEXT,
    seasonal_aadt   REAL,
    annual_aadt     REAL,
    seasonal_factor REAL,
    sample_days     INTEGER
);
CREATE TABLE IF NOT EXISTS annual_growth_factors (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id            TEXT,
    station_id         TEXT,
    region             TEXT,
    vehicle_class      TEXT,
    year_from          INTEGER,
    year_to            INTEGER,
    aadt_from          REAL,
    aadt_to            REAL,
    annual_growth_rate REAL,
    cagr               REAL,
    data_quality       TEXT,
    UNIQUE(link_id, station_id, region, vehicle_class, year_from, year_to)
);
"""

# ── Region lookup ──────────────────────────────────────────────────────────────

KEYWORD_REGIONS = [
    (["kampala", "mukono", "wake", "entebbe", "masaka", "mityana", "mpigi",
      "central", "luwero", "kasangati", "kyaliwajala", "buwama", "nyendo",
      "lyantonde", "ntusi"], "Central"),
    (["jinja", "tororo", "mbale", "soroti", "iganga", "kamuli", "busia",
      "eastern", "nakalama", "bugiri", "namutere", "busitema", "tirinyi",
      "pallisa", "kumi", "brooks", "njeru", "bukoloto", "lugazi"], "Eastern"),
    (["gulu", "lira", "arua", "northern", "moroto", "kitgum", "pader",
      "lamogi", "amuru", "nebbi", "olevu", "corner kilak", "yumbe",
      "manibe", "koboko", "moyo", "adjumani"], "Northern"),
    (["fort portal", "mbarara", "kabale", "western", "ishaka", "ibanda",
      "kyenjojo", "kasese", "bushenyi", "rwimi", "hima", "mubuku",
      "katunguru", "kamwenge", "rwera", "kaseeta"], "Western"),
    (["south", "southern", "rakai", "isingiro"], "Southern"),
]


def build_region_lookup(con: sqlite3.Connection):
    """Return a closure: link_id_or_name → region string."""
    direct: dict[str, str] = {}
    for link_id, region in con.execute(
        "SELECT link_id, region FROM atc_stations "
        "WHERE region IS NOT NULL AND link_id IS NOT NULL"
    ):
        if link_id and region:
            direct[link_id.strip()] = region.strip().title()

    # Prefix → modal region (A001 → most common region for A001_Link* stations)
    prefix_votes: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for lid, reg in direct.items():
        if "_" in lid:
            prefix_votes[lid[:4]][reg] += 1
    prefix_reg = {
        p: max(votes, key=votes.get)
        for p, votes in prefix_votes.items()
    }

    # Road name → code mapping (for name-style link_ids in traffic_counts)
    name_to_code: dict[str, str] = {}
    for code, name in con.execute(
        "SELECT link_id, link_name FROM road_links WHERE link_name IS NOT NULL AND link_id != 'Link_ID'"
    ):
        if code and name:
            name_to_code[name.strip().lower()] = code.strip()

    def get_region(val: str) -> str:
        if not val:
            return "Unknown"
        # Direct atc_stations match
        if val in direct:
            return direct[val]
        # Code-style prefix  (e.g. A001_Link05 → A001)
        if "_" in val and len(val) >= 4:
            pfx = val[:4]
            if pfx in prefix_reg:
                return prefix_reg[pfx]
        # Road name → code → region
        norm = val.strip().lower()
        code = name_to_code.get(norm)
        if code:
            if code in direct:
                return direct[code]
            if "_" in code and len(code) >= 4:
                pfx = code[:4]
                if pfx in prefix_reg:
                    return prefix_reg[pfx]
        # Keyword matching
        for keywords, region in KEYWORD_REGIONS:
            if any(k in norm for k in keywords):
                return region
        return "Unknown"

    return get_region


# ── Annual AADT per (link_id, year, vc) ───────────────────────────────────────

def compute_link_annual(con: sqlite3.Connection):
    """
    Returns dict: {(link_id, year, vc): (aadt, n_days)}.
    Excludes survey_year=2025 (duplicate of 2024) and survey_year=0 (artefacts).
    Uses direction=0 (combined bidirectional).
    For dated rows: AVG(vc_col) per distinct date = daily average.
    For undated rows (2016/2018): direct AVG treated as AADT.
    """
    result: dict[tuple, tuple] = {}

    for vc_name, vc_col in VC_COLS.items():
        # Dated rows: rows with an actual date in count_date
        rows = con.execute(f"""
            SELECT link_id, survey_year,
                   AVG(CAST({vc_col} AS REAL)) AS aadt,
                   COUNT(DISTINCT count_date)  AS n_days
            FROM traffic_counts
            WHERE direction = 0
              AND survey_year > 2000 AND survey_year != 2025
              AND count_date LIKE '20__-__-__'
            GROUP BY link_id, survey_year
            HAVING aadt > 0
        """).fetchall()
        for link_id, year, aadt, n_days in rows:
            if link_id and link_id != "Link_ID" and year:
                result[(link_id, int(year), vc_name)] = (float(aadt), int(n_days))

        # Undated rows: no valid date (2016/2018 typically)
        rows_u = con.execute(f"""
            SELECT link_id, survey_year,
                   AVG(CAST({vc_col} AS REAL)) AS aadt,
                   COUNT(*)                    AS n_rows
            FROM traffic_counts
            WHERE direction = 0
              AND survey_year > 2000 AND survey_year != 2025
              AND (count_date NOT LIKE '20__-__-__' OR count_date IS NULL)
            GROUP BY link_id, survey_year
            HAVING aadt > 0
        """).fetchall()
        for link_id, year, aadt, n_rows in rows_u:
            if link_id and link_id != "Link_ID" and year:
                key = (link_id, int(year), vc_name)
                if key not in result:      # prefer dated data
                    result[key] = (float(aadt), int(n_rows))

    return result


# ── Monthly AADT per (link_id, year, month, vc) ───────────────────────────────

def compute_link_monthly(con: sqlite3.Connection):
    """
    Returns dict: {(link_id, year, month, vc): (monthly_aadt, n_days)}.
    Only for rows where count_date is an actual date (2019, 2021–2024 data).
    """
    result: dict[tuple, tuple] = {}

    for vc_name, vc_col in VC_COLS.items():
        rows = con.execute(f"""
            SELECT link_id, survey_year,
                   CAST(SUBSTR(count_date, 6, 2) AS INTEGER) AS month,
                   AVG(CAST({vc_col} AS REAL))               AS monthly_aadt,
                   COUNT(DISTINCT count_date)                AS n_days
            FROM traffic_counts
            WHERE direction = 0
              AND survey_year > 2000 AND survey_year != 2025
              AND count_date LIKE '20__-__-__'
            GROUP BY link_id, survey_year, month
            HAVING monthly_aadt > 0 AND month BETWEEN 1 AND 12
        """).fetchall()
        for link_id, year, month, maadt, n_days in rows:
            if link_id and link_id != "Link_ID" and year and month:
                result[(link_id, int(year), int(month), vc_name)] = (float(maadt), int(n_days))

    return result


# ── ATC station monthly AADT ───────────────────────────────────────────────────

def compute_station_monthly(con: sqlite3.Connection):
    """
    Returns dict: {(station_id, year, month): aadt} from atc_readings.
    station_id values here are road corridor names ('Kampala - Mukono', etc.)
    """
    result: dict[tuple, float] = {}
    rows = con.execute(
        "SELECT station_id, year, month, aadt FROM atc_readings "
        "WHERE aadt > 0 AND year > 2000 AND month BETWEEN 1 AND 12"
    ).fetchall()
    for station_id, year, month, aadt in rows:
        if station_id:
            result[(station_id, int(year), int(month))] = float(aadt)
    return result


# ── Insert helpers ─────────────────────────────────────────────────────────────

def data_quality(n_days: int) -> str:
    if n_days >= 10:
        return "high"
    if n_days >= 5:
        return "medium"
    return "low"


def safe_cagr(aadt_from: float, aadt_to: float, n_years: int) -> float | None:
    if aadt_from <= 0 or aadt_to <= 0 or n_years <= 0:
        return None
    try:
        return (aadt_to / aadt_from) ** (1.0 / n_years) - 1.0
    except Exception:
        return None


# ── Monthly factors ────────────────────────────────────────────────────────────

def insert_monthly_factors(
    con: sqlite3.Connection,
    link_annual: dict,
    link_monthly: dict,
    station_monthly: dict,
    get_region,
) -> int:
    cur = con.cursor()
    cur.execute("DELETE FROM monthly_factors")
    rows_inserted = 0

    # ── Per-link ──────────────────────────────────────────────────────────────
    for (link_id, year, month, vc), (maadt, n_days) in link_monthly.items():
        ann_key = (link_id, year, vc)
        if ann_key not in link_annual:
            continue
        annual_aadt, _ = link_annual[ann_key]
        if annual_aadt <= 0:
            continue
        mef = maadt / annual_aadt
        region = get_region(link_id)
        cur.execute(
            """INSERT OR REPLACE INTO monthly_factors
               (link_id, station_id, region, year, month, vehicle_class,
                monthly_aadt, annual_aadt, mef, sample_days)
               VALUES (?,NULL,?,?,?,?,?,?,?,?)""",
            (link_id, region, year, month, vc,
             round(maadt, 1), round(annual_aadt, 1), round(mef, 4), n_days),
        )
        rows_inserted += 1

    # ── Per-station (ATC readings, total AADT only) ───────────────────────────
    # Compute annual AADT per station per year as mean of monthly values
    station_annual: dict[tuple, float] = {}
    station_months: dict[tuple, list] = defaultdict(list)
    for (sid, yr, mo), aadt in station_monthly.items():
        station_months[(sid, yr)].append(aadt)
    for (sid, yr), aadts in station_months.items():
        station_annual[(sid, yr)] = sum(aadts) / len(aadts)

    for (sid, yr, mo), maadt in station_monthly.items():
        ann = station_annual.get((sid, yr))
        if not ann or ann <= 0:
            continue
        mef = maadt / ann
        region = get_region(sid)
        cur.execute(
            """INSERT OR REPLACE INTO monthly_factors
               (link_id, station_id, region, year, month, vehicle_class,
                monthly_aadt, annual_aadt, mef, sample_days)
               VALUES (NULL,?,?,?,?,?,?,?,?,?)""",
            (sid, region, yr, mo, "total",
             round(maadt, 1), round(ann, 1), round(mef, 4), 1),
        )
        rows_inserted += 1

    # ── Region-level aggregates ───────────────────────────────────────────────
    # {(region, year, month, vc): [list of (maadt, annual_aadt)]}
    reg_monthly: dict[tuple, list] = defaultdict(list)
    for (link_id, year, month, vc), (maadt, _) in link_monthly.items():
        ann_key = (link_id, year, vc)
        if ann_key not in link_annual:
            continue
        annual_aadt, _ = link_annual[ann_key]
        if annual_aadt <= 0:
            continue
        region = get_region(link_id)
        reg_monthly[(region, year, month, vc)].append((maadt, annual_aadt))

    for (region, year, month, vc), pairs in reg_monthly.items():
        maadts  = [p[0] for p in pairs]
        aannual = [p[1] for p in pairs]
        avg_m   = sum(maadts)  / len(maadts)
        avg_a   = sum(aannual) / len(aannual)
        mef     = avg_m / avg_a if avg_a > 0 else 1.0
        cur.execute(
            """INSERT OR REPLACE INTO monthly_factors
               (link_id, station_id, region, year, month, vehicle_class,
                monthly_aadt, annual_aadt, mef, sample_days)
               VALUES (NULL,NULL,?,?,?,?,?,?,?,?)""",
            (region, year, month, vc,
             round(avg_m, 1), round(avg_a, 1), round(mef, 4), len(pairs)),
        )
        rows_inserted += 1

    con.commit()
    return rows_inserted


# ── Seasonal factors ───────────────────────────────────────────────────────────

def insert_seasonal_factors(
    con: sqlite3.Connection,
    link_annual: dict,
    link_monthly: dict,
    station_monthly: dict,
    get_region,
) -> int:
    cur = con.cursor()
    cur.execute("DELETE FROM seasonal_factors")
    rows_inserted = 0

    # Group months into seasons per (link_id, year, vc)
    # {(link_id, year, vc, season): [(maadt, n_days)]}
    link_season: dict[tuple, list] = defaultdict(list)
    for (link_id, year, month, vc), (maadt, n_days) in link_monthly.items():
        season = MONTH_TO_SEASON.get(month)
        if season:
            link_season[(link_id, year, vc, season)].append((maadt, n_days))

    for (link_id, year, vc, season), items in link_season.items():
        ann_key = (link_id, year, vc)
        if ann_key not in link_annual:
            continue
        annual_aadt, _ = link_annual[ann_key]
        if annual_aadt <= 0:
            continue
        saadt    = sum(m for m, _ in items) / len(items)
        tot_days = sum(d for _, d in items)
        sfactor  = saadt / annual_aadt
        region   = get_region(link_id)
        months   = ",".join(str(m) for m in SEASONS[season])
        cur.execute(
            """INSERT INTO seasonal_factors
               (link_id, station_id, region, year, season, season_months,
                vehicle_class, seasonal_aadt, annual_aadt, seasonal_factor, sample_days)
               VALUES (?,NULL,?,?,?,?,?,?,?,?,?)""",
            (link_id, region, year, season, months, vc,
             round(saadt, 1), round(annual_aadt, 1), round(sfactor, 4), tot_days),
        )
        rows_inserted += 1

    # Region-level aggregates
    reg_season: dict[tuple, list] = defaultdict(list)
    for (link_id, year, vc, season), items in link_season.items():
        ann_key = (link_id, year, vc)
        if ann_key not in link_annual:
            continue
        annual_aadt, _ = link_annual[ann_key]
        if annual_aadt <= 0:
            continue
        saadt  = sum(m for m, _ in items) / len(items)
        region = get_region(link_id)
        reg_season[(region, year, vc, season)].append((saadt, annual_aadt))

    for (region, year, vc, season), pairs in reg_season.items():
        avg_s  = sum(p[0] for p in pairs) / len(pairs)
        avg_a  = sum(p[1] for p in pairs) / len(pairs)
        sfac   = avg_s / avg_a if avg_a > 0 else 1.0
        months = ",".join(str(m) for m in SEASONS[season])
        cur.execute(
            """INSERT INTO seasonal_factors
               (link_id, station_id, region, year, season, season_months,
                vehicle_class, seasonal_aadt, annual_aadt, seasonal_factor, sample_days)
               VALUES (NULL,NULL,?,?,?,?,?,?,?,?,?)""",
            (region, year, season, months, vc,
             round(avg_s, 1), round(avg_a, 1), round(sfac, 4), len(pairs)),
        )
        rows_inserted += 1

    # Station-level (ATC readings)
    station_annual: dict[tuple, float] = {}
    s_months: dict[tuple, list] = defaultdict(list)
    for (sid, yr, mo), aadt in station_monthly.items():
        s_months[(sid, yr)].append(aadt)
    for (sid, yr), aadts in s_months.items():
        station_annual[(sid, yr)] = sum(aadts) / len(aadts)

    sid_season: dict[tuple, list] = defaultdict(list)
    for (sid, yr, mo), aadt in station_monthly.items():
        season = MONTH_TO_SEASON.get(mo)
        if season:
            sid_season[(sid, yr, season)].append(aadt)

    for (sid, yr, season), aadts in sid_season.items():
        ann = station_annual.get((sid, yr))
        if not ann or ann <= 0:
            continue
        saadt  = sum(aadts) / len(aadts)
        sfac   = saadt / ann
        region = get_region(sid)
        months = ",".join(str(m) for m in SEASONS[season])
        cur.execute(
            """INSERT INTO seasonal_factors
               (link_id, station_id, region, year, season, season_months,
                vehicle_class, seasonal_aadt, annual_aadt, seasonal_factor, sample_days)
               VALUES (NULL,?,?,?,?,?,?,?,?,?,?)""",
            (sid, region, yr, season, months, "total",
             round(saadt, 1), round(ann, 1), round(sfac, 4), len(aadts)),
        )
        rows_inserted += 1

    con.commit()
    return rows_inserted


# ── Annual growth factors ──────────────────────────────────────────────────────

def insert_annual_growth(
    con: sqlite3.Connection,
    link_annual: dict,
    get_region,
) -> int:
    cur = con.cursor()
    cur.execute("DELETE FROM annual_growth_factors")
    rows_inserted = 0

    # Group years per (link_id, vc)
    link_years: dict[tuple, dict[int, tuple]] = defaultdict(dict)
    for (link_id, year, vc), (aadt, n_days) in link_annual.items():
        if link_id and link_id != "Link_ID":
            link_years[(link_id, vc)][year] = (aadt, n_days)

    for (link_id, vc), yr_map in link_years.items():
        years_sorted = sorted(yr_map.keys())
        if len(years_sorted) < 2:
            continue
        region = get_region(link_id)

        # Consecutive year pairs
        for i in range(len(years_sorted) - 1):
            yf = years_sorted[i]
            yt = years_sorted[i + 1]
            aadt_f, nd_f = yr_map[yf]
            aadt_t, nd_t = yr_map[yt]
            if aadt_f <= 0:
                continue
            n_years = yt - yf
            growth  = (aadt_t - aadt_f) / aadt_f
            cagr    = safe_cagr(aadt_f, aadt_t, n_years)
            dq      = data_quality(min(nd_f, nd_t))
            try:
                cur.execute(
                    """INSERT OR REPLACE INTO annual_growth_factors
                       (link_id, station_id, region, vehicle_class,
                        year_from, year_to, aadt_from, aadt_to,
                        annual_growth_rate, cagr, data_quality)
                       VALUES (?,NULL,?,?,?,?,?,?,?,?,?)""",
                    (link_id, region, vc, yf, yt,
                     round(aadt_f, 1), round(aadt_t, 1),
                     round(growth, 6),
                     round(cagr, 6) if cagr is not None else None,
                     dq),
                )
                rows_inserted += 1
            except sqlite3.IntegrityError:
                pass

        # Long-term CAGR: earliest → latest year
        yf_lt  = years_sorted[0]
        yt_lt  = years_sorted[-1]
        if yf_lt != yt_lt:
            aadt_f, nd_f = yr_map[yf_lt]
            aadt_t, nd_t = yr_map[yt_lt]
            if aadt_f > 0:
                n_years = yt_lt - yf_lt
                growth  = (aadt_t - aadt_f) / aadt_f
                cagr    = safe_cagr(aadt_f, aadt_t, n_years)
                dq      = data_quality(min(nd_f, nd_t))
                try:
                    cur.execute(
                        """INSERT OR REPLACE INTO annual_growth_factors
                           (link_id, station_id, region, vehicle_class,
                            year_from, year_to, aadt_from, aadt_to,
                            annual_growth_rate, cagr, data_quality)
                           VALUES (?,NULL,?,?,?,?,?,?,?,?,?)""",
                        (link_id, region, vc, yf_lt, yt_lt,
                         round(aadt_f, 1), round(aadt_t, 1),
                         round(growth, 6),
                         round(cagr, 6) if cagr is not None else None,
                         dq),
                    )
                    rows_inserted += 1
                except sqlite3.IntegrityError:
                    pass

    # Region-level aggregates
    reg_yr: dict[tuple, list] = defaultdict(list)   # {(region,yr,vc): [aadts]}
    for (link_id, vc), yr_map in link_years.items():
        region = get_region(link_id)
        for yr, (aadt, _) in yr_map.items():
            reg_yr[(region, yr, vc)].append(aadt)

    reg_aadt: dict[tuple, float] = {
        k: sum(v) / len(v) for k, v in reg_yr.items()
    }

    # Collect all years per (region, vc)
    reg_vc_years: dict[tuple, list] = defaultdict(list)
    for (region, yr, vc) in reg_aadt:
        reg_vc_years[(region, vc)].append(yr)

    for (region, vc), yrs in reg_vc_years.items():
        yrs_sorted = sorted(set(yrs))
        if len(yrs_sorted) < 2:
            continue
        for i in range(len(yrs_sorted) - 1):
            yf = yrs_sorted[i]
            yt = yrs_sorted[i + 1]
            af = reg_aadt.get((region, yf, vc))
            at = reg_aadt.get((region, yt, vc))
            if not af or not at or af <= 0:
                continue
            n_years = yt - yf
            growth  = (at - af) / af
            cagr    = safe_cagr(af, at, n_years)
            try:
                cur.execute(
                    """INSERT OR REPLACE INTO annual_growth_factors
                       (link_id, station_id, region, vehicle_class,
                        year_from, year_to, aadt_from, aadt_to,
                        annual_growth_rate, cagr, data_quality)
                       VALUES (NULL,NULL,?,?,?,?,?,?,?,?,?)""",
                    (region, vc, yf, yt,
                     round(af, 1), round(at, 1),
                     round(growth, 6),
                     round(cagr, 6) if cagr is not None else None,
                     "region"),
                )
                rows_inserted += 1
            except sqlite3.IntegrityError:
                pass

        # Long-term region CAGR
        yf_lt, yt_lt = yrs_sorted[0], yrs_sorted[-1]
        if yf_lt != yt_lt:
            af = reg_aadt.get((region, yf_lt, vc))
            at = reg_aadt.get((region, yt_lt, vc))
            if af and at and af > 0:
                n_years = yt_lt - yf_lt
                growth  = (at - af) / af
                cagr    = safe_cagr(af, at, n_years)
                try:
                    cur.execute(
                        """INSERT OR REPLACE INTO annual_growth_factors
                           (link_id, station_id, region, vehicle_class,
                            year_from, year_to, aadt_from, aadt_to,
                            annual_growth_rate, cagr, data_quality)
                           VALUES (NULL,NULL,?,?,?,?,?,?,?,?,?)""",
                        (region, vc, yf_lt, yt_lt,
                         round(af, 1), round(at, 1),
                         round(growth, 6),
                         round(cagr, 6) if cagr is not None else None,
                         "region"),
                    )
                    rows_inserted += 1
                except sqlite3.IntegrityError:
                    pass

    con.commit()
    return rows_inserted


# ── Export JSON summary ────────────────────────────────────────────────────────

def export_json(con: sqlite3.Connection, get_region) -> None:
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    # Monthly factors – region-level only (link_id IS NULL, station_id IS NULL)
    monthly_rows = con.execute("""
        SELECT region, year, month, vehicle_class, mef, monthly_aadt, annual_aadt, sample_days
        FROM monthly_factors
        WHERE link_id IS NULL AND station_id IS NULL
        ORDER BY region, year, month, vehicle_class
    """).fetchall()
    monthly_factors = [
        {
            "region": r, "year": yr, "month": mo, "vehicle_class": vc,
            "mef": round(mef, 4),
            "monthly_aadt": round(maadt, 1),
            "annual_aadt": round(aannd, 1) if aannd else None,
            "sample_days": sd,
        }
        for r, yr, mo, vc, mef, maadt, aannd, sd in monthly_rows
        if r and mef
    ]

    # Seasonal factors – region-level only
    seasonal_rows = con.execute("""
        SELECT region, year, season, vehicle_class, seasonal_factor, seasonal_aadt, sample_days
        FROM seasonal_factors
        WHERE link_id IS NULL AND station_id IS NULL
        ORDER BY region, year, season, vehicle_class
    """).fetchall()
    seasonal_factors = [
        {
            "region": r, "year": yr, "season": s, "vehicle_class": vc,
            "seasonal_factor": round(sf, 4), "seasonal_aadt": round(saadt, 1),
            "sample_links": sd,
        }
        for r, yr, s, vc, sf, saadt, sd in seasonal_rows
        if r and sf
    ]

    # Annual growth – region-level only
    growth_rows = con.execute("""
        SELECT region, vehicle_class, year_from, year_to,
               annual_growth_rate, cagr, aadt_from, aadt_to
        FROM annual_growth_factors
        WHERE link_id IS NULL AND station_id IS NULL
        ORDER BY region, vehicle_class, year_from, year_to
    """).fetchall()
    annual_growth = [
        {
            "region": r, "vehicle_class": vc,
            "year_from": yf, "year_to": yt,
            "growth_rate": round(gr, 6) if gr else 0,
            "cagr": round(cagr, 6) if cagr else None,
            "aadt_from": round(af, 1), "aadt_to": round(at, 1),
        }
        for r, vc, yf, yt, gr, cagr, af, at in growth_rows
        if r and gr is not None
    ]

    # Top growing roads – per-link, long-term CAGR for 'total' vc
    top_rows = con.execute("""
        SELECT agf.link_id, rl.link_name, agf.region,
               agf.cagr, agf.year_from, agf.year_to,
               agf.aadt_from, agf.aadt_to
        FROM annual_growth_factors agf
        LEFT JOIN road_links rl ON agf.link_id = rl.link_id
        WHERE agf.link_id IS NOT NULL
          AND agf.vehicle_class = 'total'
          AND agf.cagr IS NOT NULL
          AND agf.data_quality IN ('high','medium')
          AND (agf.year_to - agf.year_from) >= 2
        ORDER BY ABS(agf.cagr) DESC
        LIMIT 60
    """).fetchall()
    top_growing_roads = [
        {
            "link_id": lid,
            "link_name": lname or lid,
            "region": reg or "Unknown",
            "cagr_total": round(cagr, 6),
            "year_from": yf, "year_to": yt,
            "aadt_from": round(af, 1), "aadt_to": round(at, 1),
        }
        for lid, lname, reg, cagr, yf, yt, af, at in top_rows
        if cagr is not None
    ]

    # Summary metadata
    yr_range_row = con.execute(
        "SELECT MIN(year_from), MAX(year_to) FROM annual_growth_factors WHERE link_id IS NULL"
    ).fetchone()
    yr_range = list(yr_range_row) if yr_range_row and yr_range_row[0] else [2016, 2024]

    regions = sorted({r["region"] for r in monthly_factors if r["region"] != "Unknown"})
    regions.append("Unknown")   # put Unknown last

    summary = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "year_range": yr_range,
        "regions": regions,
        "vehicle_classes": list(VC_COLS.keys()),
        "monthly_factors": monthly_factors,
        "seasonal_factors": seasonal_factors,
        "annual_growth": annual_growth,
        "top_growing_roads": top_growing_roads,
    }

    OUTPUT_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON written: {OUTPUT_JSON}  ({OUTPUT_JSON.stat().st_size // 1024} KB)")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Connecting to", DB_PATH)
    con = sqlite3.connect(DB_PATH)
    con.executescript(NEW_TABLES)
    con.commit()

    get_region = build_region_lookup(con)

    print("Computing annual AADT per link …")
    link_annual = compute_link_annual(con)
    print(f"  {len(link_annual):,} (link, year, vc) entries")

    print("Computing monthly AADT per link …")
    link_monthly = compute_link_monthly(con)
    print(f"  {len(link_monthly):,} (link, year, month, vc) entries")

    print("Loading ATC station monthly readings …")
    station_monthly = compute_station_monthly(con)
    print(f"  {len(station_monthly):,} station-month entries")

    print("Inserting monthly_factors …")
    n_mf = insert_monthly_factors(con, link_annual, link_monthly, station_monthly, get_region)

    print("Inserting seasonal_factors …")
    n_sf = insert_seasonal_factors(con, link_annual, link_monthly, station_monthly, get_region)

    print("Inserting annual_growth_factors …")
    n_gf = insert_annual_growth(con, link_annual, get_region)

    # Summary stats
    regions_covered = set()
    for (link_id, _year, _vc) in link_annual:
        r = get_region(link_id)
        if r:
            regions_covered.add(r)

    all_years = sorted({y for (_, y, _) in link_annual})
    yr_range  = f"{all_years[0]}–{all_years[-1]}" if all_years else "N/A"

    print()
    print(f"Monthly factors computed:  {n_mf:,} rows")
    print(f"Seasonal factors computed: {n_sf:,} rows")
    print(f"Annual growth factors:     {n_gf:,} rows")
    print(f"Regions covered: {sorted(regions_covered)}")
    print(f"Year range: {yr_range}")

    print("\nExporting JSON summary …")
    export_json(con, get_region)

    con.close()
    print("Done.")


if __name__ == "__main__":
    main()
