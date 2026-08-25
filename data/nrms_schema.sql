-- ═══════════════════════════════════════════════════════════════════════════
--  UGANDA NRMS — COMPREHENSIVE PLATFORM SCHEMA (FY 2025/26)
--  Ministry of Works & Transport · Department of National Roads (DNR)
--
--  Source documents ("the manuals"):
--    · FY25-26 National Road Network Master (NDPIV) — 21,302 km official network
--    · Data Dictionary — Link ID rule: <RoadNo>_Link<NN>  e.g. A001_Link01
--        RoadNo = class letter (A trunk | B regional | C district) + 3-digit number
--    · Road Condition Assessment Manual — IRI / VCI bands
--    · MoWT Schedule of Rates — treatment unit costs (M UGX / km)
--    · BMS Register 2026 — structures inventory
--    · 6 maintenance regions: Central, Northern, Eastern, Western, Southern,
--      North Eastern
--
--  Dialect: SQLite (ANSI-portable; PostgreSQL-compatible types in comments)
-- ═══════════════════════════════════════════════════════════════════════════
PRAGMA foreign_keys = ON;

-- ─── 1 · REFERENCE TABLES ───────────────────────────────────────────────────

CREATE TABLE ref_region (
  region_code   TEXT PRIMARY KEY,              -- 'CEN','NOR','EAS','WES','SOU','NEA'
  region_name   TEXT NOT NULL UNIQUE,
  display_color TEXT NOT NULL,                 -- platform neon accent
  sort_order    INTEGER NOT NULL
);
INSERT INTO ref_region VALUES
 ('CEN','Central',      '#00f5ff',1),
 ('NOR','Northern',     '#00ff88',2),
 ('EAS','Eastern',      '#ffd23f',3),
 ('WES','Western',      '#b967ff',4),
 ('SOU','Southern',     '#ff2d78',5),
 ('NEA','North Eastern','#ff6b35',6);

CREATE TABLE ref_road_class (
  class_code  TEXT PRIMARY KEY,                -- 'A','B','C'
  class_name  TEXT NOT NULL,
  description TEXT NOT NULL
);
INSERT INTO ref_road_class VALUES
 ('A','Trunk',   'National trunk corridors — primary long-distance routes'),
 ('B','Regional','Regional connector roads linking district centres to trunks'),
 ('C','District','District access roads feeding the regional network');

CREATE TABLE ref_surface_type (
  surface_code TEXT PRIMARY KEY,               -- 'BIT','CON','GRA','EAR'
  surface_name TEXT NOT NULL,
  is_paved     INTEGER NOT NULL CHECK (is_paved IN (0,1))
);
INSERT INTO ref_surface_type VALUES
 ('BIT','Bituminous',1),('CON','Concrete',1),('GRA','Gravel',0),('EAR','Earth',0);

CREATE TABLE ref_condition_band (
  band_code     TEXT PRIMARY KEY,              -- 'GOOD','FAIR','POOR','CRIT'
  band_name     TEXT NOT NULL,
  display_color TEXT NOT NULL,
  iri_max       REAL,                          -- m/km upper bound (paved)
  sort_order    INTEGER NOT NULL
);
INSERT INTO ref_condition_band VALUES
 ('GOOD','Good',    '#00ff88',3.5,1),
 ('FAIR','Fair',    '#ffd23f',5.5,2),
 ('POOR','Poor',    '#ff6b35',8.0,3),
 ('CRIT','Critical','#ff2d78',NULL,4);

CREATE TABLE ref_treatment (
  treatment_code   TEXT PRIMARY KEY,           -- 'RM','PR','RH','RC'
  treatment_name   TEXT NOT NULL,
  unit_cost_m_ugx  REAL NOT NULL,              -- M UGX per km (MoWT schedule of rates)
  trigger_band     TEXT REFERENCES ref_condition_band(band_code)
);
INSERT INTO ref_treatment VALUES
 ('RM','Routine Maintenance', 45,'GOOD'),
 ('PR','Periodic Resealing', 180,'FAIR'),
 ('RH','Rehabilitation',     320,'POOR'),
 ('RC','Reconstruction',     680,'CRIT');

-- ─── 2 · ROAD NETWORK ──────────────────────────────────────────────────────

CREATE TABLE road (
  road_no    TEXT PRIMARY KEY
             CHECK (road_no GLOB '[ABC][0-9][0-9][0-9]'),   -- e.g. A109, B023, C108
  road_name  TEXT NOT NULL,
  class_code TEXT NOT NULL REFERENCES ref_road_class(class_code)
);
INSERT INTO road VALUES
 ('A104','Kampala–Masaka–Mbarara–Kabale Corridor','A'),
 ('A109','Kampala–Gayaza–Zirobwe–Luwero Corridor','A'),
 ('A110','Northern Corridor (Gulu–Kitgum / Lira–Soroti)','A'),
 ('B010','Fort Portal–Kasese–Hima Road','B'),
 ('B023','Masaka–Mbarara–Bushenyi Road','B'),
 ('B033','Iganga–Bugiri–Busia Road','B'),
 ('C108','Mityana–Mubende District Road','C');

CREATE TABLE road_link (                       -- unit of the FY25-26 network master
  link_id      TEXT PRIMARY KEY
               CHECK (link_id GLOB '[ABC][0-9][0-9][0-9]_Link[0-9][0-9]'),
  road_no      TEXT NOT NULL REFERENCES road(road_no),
  link_name    TEXT NOT NULL,                  -- section description
  region_code  TEXT NOT NULL REFERENCES ref_region(region_code),
  surface_code TEXT NOT NULL REFERENCES ref_surface_type(surface_code),
  chainage_from_km REAL NOT NULL,
  chainage_to_km   REAL NOT NULL,
  length_km    REAL NOT NULL CHECK (length_km > 0)
);
INSERT INTO road_link VALUES
 ('A109_Link01','A109','Kampala–Gayaza',      'CEN','BIT',  0, 14,14),
 ('A109_Link02','A109','Gayaza–Zirobwe',      'CEN','BIT', 14, 42,28),
 ('A109_Link03','A109','Zirobwe–Wobulenzi',   'CEN','BIT', 42, 68,26),
 ('A109_Link04','A109','Wobulenzi–Luwero',    'CEN','BIT', 68, 96,28),
 ('B023_Link01','B023','Masaka–Mbarara',      'SOU','BIT',  0, 40,40),
 ('B023_Link02','B023','Mbarara–Bushenyi',    'WES','BIT', 40, 90,50),
 ('A104_Link01','A104','Kampala–Entebbe',     'CEN','BIT',  0, 42,42),
 ('A104_Link02','A104','Masaka–Mbarara',      'SOU','BIT',130,200,70),
 ('B033_Link01','B033','Iganga–Bugiri',       'EAS','BIT',  0, 38,38),
 ('B033_Link02','B033','Bugiri–Busia',        'EAS','BIT', 38, 64,26),
 ('A110_Link01','A110','Gulu–Kitgum',         'NOR','BIT',  0, 68,68),
 ('A110_Link02','A110','Lira–Soroti',         'NEA','BIT',  0, 84,84),
 ('B010_Link01','B010','Fort Portal–Kasese',  'WES','BIT',  0, 52,52),
 ('B010_Link02','B010','Kasese–Hima',         'WES','BIT', 52, 80,28),
 ('C108_Link01','C108','Mityana–Mubende',     'CEN','GRA',  0, 68,68);

-- Regional network stock (km) — reconciles to official 21,302 km / 6,405 paved
CREATE TABLE region_network_stock (
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  fiscal_year TEXT NOT NULL,                   -- 'FY25/26'
  paved_km    REAL NOT NULL,
  unpaved_km  REAL NOT NULL,
  class_a_km  REAL NOT NULL,
  class_b_km  REAL NOT NULL,
  class_c_km  REAL NOT NULL,
  PRIMARY KEY (region_code, fiscal_year)
);
INSERT INTO region_network_stock VALUES
 ('CEN','FY25/26',1850,2586,1050,1300,2086),
 ('NOR','FY25/26', 900,3020, 720,1100,2100),
 ('EAS','FY25/26', 860,3430, 800,1200,2290),
 ('WES','FY25/26',1280,1720, 640, 900,1460),
 ('SOU','FY25/26',1140,2160, 620, 850,1830),
 ('NEA','FY25/26', 375,1981, 370, 450,1536);

-- ─── 3 · CONDITION ─────────────────────────────────────────────────────────

CREATE TABLE link_condition_survey (
  survey_id   INTEGER PRIMARY KEY,
  link_id     TEXT NOT NULL REFERENCES road_link(link_id),
  fiscal_year TEXT NOT NULL,
  iri_m_km    REAL,                            -- roughness
  vci_percent REAL,                            -- visual condition index
  rutting_mm  REAL,
  band_code   TEXT NOT NULL REFERENCES ref_condition_band(band_code),
  UNIQUE (link_id, fiscal_year)
);
INSERT INTO link_condition_survey (link_id,fiscal_year,iri_m_km,vci_percent,rutting_mm,band_code) VALUES
 ('A109_Link01','FY25/26',6.2,58,11.0,'POOR'),
 ('A109_Link02','FY25/26',6.8,55,11.8,'POOR'),
 ('A109_Link03','FY25/26',4.6,72, 8.4,'FAIR'),
 ('A109_Link04','FY25/26',3.1,84, 6.2,'GOOD'),
 ('B023_Link01','FY25/26',9.4,41,14.6,'CRIT'),
 ('B023_Link02','FY25/26',7.2,52,12.1,'POOR'),
 ('A104_Link01','FY25/26',2.8,88, 5.4,'GOOD'),
 ('A104_Link02','FY25/26',9.1,43,14.1,'CRIT'),
 ('B033_Link01','FY25/26',7.0,53,12.0,'POOR'),
 ('B033_Link02','FY25/26',4.9,70, 8.8,'FAIR'),
 ('A110_Link01','FY25/26',9.8,38,15.2,'CRIT'),
 ('A110_Link02','FY25/26',7.4,50,12.4,'POOR'),
 ('B010_Link01','FY25/26',4.4,73, 8.1,'FAIR'),
 ('B010_Link02','FY25/26',3.0,85, 6.0,'GOOD'),
 ('C108_Link01','FY25/26',9.6,40,14.9,'CRIT');

CREATE TABLE region_condition_iri (            -- network-level IRI by region × year
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  survey_year INTEGER NOT NULL,
  iri_m_km    REAL NOT NULL,
  PRIMARY KEY (region_code, survey_year)
);
INSERT INTO region_condition_iri VALUES
 ('CEN',2020,3.1),('CEN',2021,3.2),('CEN',2022,3.3),('CEN',2023,3.4),('CEN',2024,3.3),('CEN',2025,3.2),
 ('NOR',2020,3.8),('NOR',2021,4.0),('NOR',2022,4.3),('NOR',2023,4.5),('NOR',2024,4.4),('NOR',2025,4.2),
 ('EAS',2020,4.2),('EAS',2021,4.5),('EAS',2022,4.8),('EAS',2023,5.0),('EAS',2024,4.9),('EAS',2025,4.7),
 ('WES',2020,3.9),('WES',2021,4.1),('WES',2022,4.4),('WES',2023,4.6),('WES',2024,4.5),('WES',2025,4.3),
 ('SOU',2020,3.5),('SOU',2021,3.6),('SOU',2022,3.8),('SOU',2023,3.9),('SOU',2024,3.8),('SOU',2025,3.6),
 ('NEA',2020,4.4),('NEA',2021,4.6),('NEA',2022,4.9),('NEA',2023,5.2),('NEA',2024,5.1),('NEA',2025,4.9);

-- ─── 4 · MAINTENANCE NEEDS REGISTER ────────────────────────────────────────

CREATE TABLE maintenance_need (
  need_id        INTEGER PRIMARY KEY,
  link_id        TEXT NOT NULL REFERENCES road_link(link_id),
  fiscal_year    TEXT NOT NULL,
  treatment_code TEXT NOT NULL REFERENCES ref_treatment(treatment_code),
  priority_score REAL NOT NULL CHECK (priority_score BETWEEN 0 AND 10),
  UNIQUE (link_id, fiscal_year)
);
INSERT INTO maintenance_need (link_id,fiscal_year,treatment_code,priority_score) VALUES
 ('A110_Link01','FY25/26','RC',9.8),
 ('B023_Link01','FY25/26','RC',9.6),
 ('C108_Link01','FY25/26','RC',9.3),
 ('A104_Link02','FY25/26','RC',9.1),
 ('A109_Link01','FY25/26','PR',8.2),
 ('A109_Link02','FY25/26','RH',7.8),
 ('A110_Link02','FY25/26','RH',7.6),
 ('B023_Link02','FY25/26','RH',7.4),
 ('B033_Link01','FY25/26','RH',7.1),
 ('A109_Link03','FY25/26','RM',5.1),
 ('B033_Link02','FY25/26','PR',4.8),
 ('B010_Link01','FY25/26','PR',4.2),
 ('A109_Link04','FY25/26','RM',2.4),
 ('A104_Link01','FY25/26','RM',1.8),
 ('B010_Link02','FY25/26','RM',1.6);

-- ─── 5 · TRAFFIC ───────────────────────────────────────────────────────────

CREATE TABLE atc_station (
  station_id INTEGER PRIMARY KEY,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  aadt       INTEGER NOT NULL
);

CREATE TABLE region_aadt (
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  survey_year INTEGER NOT NULL,
  aadt        INTEGER NOT NULL,
  PRIMARY KEY (region_code, survey_year)
);
INSERT INTO region_aadt VALUES
 ('CEN',2018,2200),('CEN',2019,2280),('CEN',2020,2180),('CEN',2021,2270),('CEN',2022,2360),('CEN',2023,2460),('CEN',2024,2560),('CEN',2025,2670),
 ('NOR',2018,1840),('NOR',2019,1910),('NOR',2020,1830),('NOR',2021,1910),('NOR',2022,1990),('NOR',2023,2070),('NOR',2024,2160),('NOR',2025,2240),
 ('EAS',2018,1680),('EAS',2019,1750),('EAS',2020,1680),('EAS',2021,1750),('EAS',2022,1820),('EAS',2023,1900),('EAS',2024,1980),('EAS',2025,2060),
 ('WES',2018,1900),('WES',2019,1970),('WES',2020,1890),('WES',2021,1970),('WES',2022,2050),('WES',2023,2130),('WES',2024,2220),('WES',2025,2310),
 ('SOU',2018,1500),('SOU',2019,1560),('SOU',2020,1490),('SOU',2021,1560),('SOU',2022,1620),('SOU',2023,1690),('SOU',2024,1760),('SOU',2025,1830),
 ('NEA',2018, 980),('NEA',2019,1020),('NEA',2020, 990),('NEA',2021,1030),('NEA',2022,1080),('NEA',2023,1120),('NEA',2024,1170),('NEA',2025,1210);

-- ─── 6 · BUDGET & FINANCE ──────────────────────────────────────────────────

CREATE TABLE ref_budget_category (
  category_code TEXT PRIMARY KEY,              -- 'ROU','PER','DEV','EMG','ADM'
  category_name TEXT NOT NULL
);
INSERT INTO ref_budget_category VALUES
 ('ROU','Routine Maintenance'),('PER','Periodic Maintenance'),
 ('DEV','Development'),('EMG','Emergency'),('ADM','Administration');

CREATE TABLE budget_allocation (
  region_code   TEXT NOT NULL REFERENCES ref_region(region_code),
  category_code TEXT NOT NULL REFERENCES ref_budget_category(category_code),
  fiscal_year   TEXT NOT NULL,
  amount_bn_ugx REAL NOT NULL,
  PRIMARY KEY (region_code, category_code, fiscal_year)
);
-- FY25/26 · totals reconcile to national envelope of UGX 1,842 bn
INSERT INTO budget_allocation VALUES
 ('CEN','ROU','FY25/26',118),('CEN','PER','FY25/26',144),('CEN','DEV','FY25/26',152),('CEN','EMG','FY25/26',34),('CEN','ADM','FY25/26',22),
 ('NOR','ROU','FY25/26', 90),('NOR','PER','FY25/26',108),('NOR','DEV','FY25/26',116),('NOR','EMG','FY25/26',28),('NOR','ADM','FY25/26',18),
 ('EAS','ROU','FY25/26',104),('EAS','PER','FY25/26',124),('EAS','DEV','FY25/26',140),('EAS','EMG','FY25/26',32),('EAS','ADM','FY25/26',20),
 ('WES','ROU','FY25/26', 60),('WES','PER','FY25/26', 72),('WES','DEV','FY25/26', 84),('WES','EMG','FY25/26',18),('WES','ADM','FY25/26', 6),
 ('SOU','ROU','FY25/26', 58),('SOU','PER','FY25/26', 70),('SOU','DEV','FY25/26', 80),('SOU','EMG','FY25/26',16),('SOU','ADM','FY25/26', 6),
 ('NEA','ROU','FY25/26', 40),('NEA','PER','FY25/26', 44),('NEA','DEV','FY25/26', 32),('NEA','EMG','FY25/26', 4),('NEA','ADM','FY25/26', 2);

-- ─── 7 · STRUCTURES (BMS Register 2026) ────────────────────────────────────

CREATE TABLE structure_region_condition (
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  band_code   TEXT NOT NULL REFERENCES ref_condition_band(band_code),
  structure_count INTEGER NOT NULL,
  PRIMARY KEY (region_code, band_code)
);
INSERT INTO structure_region_condition VALUES
 ('CEN','GOOD',44),('CEN','FAIR',36),('CEN','POOR',28),('CEN','CRIT',12),
 ('NOR','GOOD',30),('NOR','FAIR',24),('NOR','POOR',22),('NOR','CRIT', 6),
 ('EAS','GOOD',52),('EAS','FAIR',40),('EAS','POOR',32),('EAS','CRIT',14),
 ('WES','GOOD',41),('WES','FAIR',38),('WES','POOR',27),('WES','CRIT',12),
 ('SOU','GOOD',20),('SOU','FAIR',16),('SOU','POOR',14),('SOU','CRIT', 6),
 ('NEA','GOOD',10),('NEA','FAIR',10),('NEA','POOR', 8),('NEA','CRIT', 4);

-- ─── 8 · SAFETY ────────────────────────────────────────────────────────────

CREATE TABLE region_fatalities (
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  data_year   INTEGER NOT NULL,
  fatalities  INTEGER NOT NULL,
  PRIMARY KEY (region_code, data_year)
);

-- ─── 9 · ANALYTICAL VIEWS (defined variables — nothing hardcoded downstream) ─

CREATE VIEW v_network_summary AS
SELECT fiscal_year,
       SUM(paved_km)                AS paved_km,
       SUM(unpaved_km)              AS unpaved_km,
       SUM(paved_km + unpaved_km)   AS total_km,
       ROUND(100.0*SUM(paved_km)/SUM(paved_km+unpaved_km),1) AS paved_pct
FROM region_network_stock GROUP BY fiscal_year;

CREATE VIEW v_maintenance_register AS
SELECT mn.priority_score,
       rl.link_id                                   AS road_id,
       rl.link_name || ' km ' || CAST(rl.chainage_from_km AS INTEGER)
                    || '–'    || CAST(rl.chainage_to_km   AS INTEGER) AS section,
       rl.length_km,
       cb.band_name                                 AS condition,
       cb.display_color                             AS condition_color,
       t.treatment_name                             AS treatment,
       t.unit_cost_m_ugx,
       ROUND(rl.length_km * t.unit_cost_m_ugx, 0)   AS total_cost_m_ugx,
       rr.region_name
FROM maintenance_need mn
JOIN road_link rl            ON rl.link_id = mn.link_id
JOIN link_condition_survey s ON s.link_id = mn.link_id AND s.fiscal_year = mn.fiscal_year
JOIN ref_condition_band cb   ON cb.band_code = s.band_code
JOIN ref_treatment t         ON t.treatment_code = mn.treatment_code
JOIN ref_region rr           ON rr.region_code = rl.region_code
ORDER BY mn.priority_score DESC;

CREATE VIEW v_maintenance_need_totals AS
SELECT t.treatment_name,
       COUNT(*)                                       AS sections,
       ROUND(SUM(rl.length_km),0)                     AS km,
       ROUND(SUM(rl.length_km*t.unit_cost_m_ugx)/1000,0) AS cost_bn_ugx
FROM maintenance_need mn
JOIN road_link rl    ON rl.link_id = mn.link_id
JOIN ref_treatment t ON t.treatment_code = mn.treatment_code
GROUP BY t.treatment_name;

CREATE VIEW v_budget_by_region AS
SELECT rr.region_name, ba.fiscal_year, SUM(ba.amount_bn_ugx) AS allocation_bn
FROM budget_allocation ba JOIN ref_region rr USING (region_code)
GROUP BY rr.region_name, ba.fiscal_year;

-- ─── 10 · PMS DASHBOARD DATASETS (no values hardcoded in UI code) ──────────

CREATE TABLE region_condition_km (             -- km of network by condition band
  region_code TEXT NOT NULL REFERENCES ref_region(region_code),
  band_code   TEXT NOT NULL REFERENCES ref_condition_band(band_code),
  fiscal_year TEXT NOT NULL,
  km          REAL NOT NULL,
  PRIMARY KEY (region_code, band_code, fiscal_year)
);
INSERT INTO region_condition_km VALUES
 ('CEN','GOOD','FY25/26', 780),('CEN','FAIR','FY25/26',1400),('CEN','POOR','FY25/26',1500),('CEN','CRIT','FY25/26',756),
 ('NOR','GOOD','FY25/26', 620),('NOR','FAIR','FY25/26',1250),('NOR','POOR','FY25/26',1400),('NOR','CRIT','FY25/26',650),
 ('EAS','GOOD','FY25/26', 700),('EAS','FAIR','FY25/26',1350),('EAS','POOR','FY25/26',1500),('EAS','CRIT','FY25/26',740),
 ('WES','GOOD','FY25/26', 660),('WES','FAIR','FY25/26',1050),('WES','POOR','FY25/26', 900),('WES','CRIT','FY25/26',390),
 ('SOU','GOOD','FY25/26', 640),('SOU','FAIR','FY25/26',1100),('SOU','POOR','FY25/26',1100),('SOU','CRIT','FY25/26',460),
 ('NEA','GOOD','FY25/26', 332),('NEA','FAIR','FY25/26', 561),('NEA','POOR','FY25/26', 840),('NEA','CRIT','FY25/26',623);

CREATE TABLE network_iri_distribution (        -- histogram of surveyed network
  bin_label   TEXT PRIMARY KEY,
  bin_color   TEXT NOT NULL,
  pct_network REAL NOT NULL,
  sort_order  INTEGER NOT NULL
);
INSERT INTO network_iri_distribution VALUES
 ('0–2 Very Good','#00ff88', 5,1),('2–4 Good','#a3e635',26,2),('4–6 Fair','#ffd23f',31,3),
 ('6–8 Poor','#ff6b35',22,4),('8–10 Critical','#ff2d78',11,5),('10+ Failed','#99001f',5,6);

CREATE TABLE class_iri_summary (               -- IRI profile by road class
  class_label  TEXT PRIMARY KEY,
  surveyed_km  REAL NOT NULL,
  pct_very_good REAL NOT NULL, pct_good REAL NOT NULL, pct_fair REAL NOT NULL,
  pct_poor REAL NOT NULL, pct_critical REAL NOT NULL,
  avg_iri      REAL NOT NULL
);
INSERT INTO class_iri_summary VALUES
 ('National', 5200, 8,30,28,20,14, 3.8),
 ('Urban',    3100, 4,22,34,26,14, 4.5),
 ('District', 3640, 2,18,32,26,22, 5.2),
 ('Community', 607, 1,10,28,34,27, 6.4);

CREATE TABLE pms_kpi (                         -- headline figures, single source
  kpi_key   TEXT PRIMARY KEY,
  kpi_label TEXT NOT NULL,
  kpi_value TEXT NOT NULL,
  kpi_note  TEXT NOT NULL
);
INSERT INTO pms_kpi VALUES
 ('surveyed_km',   'Total Paved Roads',  '12,547',   'km surveyed with ROMDAS'),
 ('avg_iri',       'National Avg IRI',   '4.2 m/km', 'target 3.5 by 2028'),
 ('good_pct',      'Good Condition',     '27%',      'of surveyed network'),
 ('need_treatment','Needing Treatment',  '68%',      'fair, poor or critical'),
 ('target_iri',    'Target IRI 2028',    '3.5 m/km', 'NDP IV objective');

CREATE TABLE road_geom (                       -- map polylines per road corridor
  road_no    TEXT PRIMARY KEY REFERENCES road(road_no),
  coords_json TEXT NOT NULL                    -- [[lat,lng],...]
);
INSERT INTO road_geom VALUES
 ('A109','[[0.317,32.616],[0.8,32.5],[1.5,32.4],[2.78,32.299]]'),
 ('A104','[[0.317,32.616],[0.1,31.8],[-0.5,30.9],[-1.25,29.99]]'),
 ('A110','[[2.78,32.299],[2.25,32.9],[1.72,33.62]]'),
 ('B023','[[-0.33,31.74],[-0.6,31.15],[-0.61,30.64]]'),
 ('B033','[[0.61,33.49],[0.68,34.18]]'),
 ('B010','[[0.65,30.27],[0.18,30.08]]'),
 ('C108','[[0.4,32.05],[0.55,31.39]]');

CREATE VIEW v_region_summary AS
SELECT rr.region_name,
       ROUND(ns.paved_km + ns.unpaved_km,0)             AS total_km,
       ns.paved_km,
       ROUND(100.0*g.km /(ns.paved_km+ns.unpaved_km),0) AS good_pct,
       ROUND(100.0*f.km /(ns.paved_km+ns.unpaved_km),0) AS fair_pct,
       ROUND(100.0*p.km /(ns.paved_km+ns.unpaved_km),0) AS poor_pct,
       ROUND(100.0*c.km /(ns.paved_km+ns.unpaved_km),0) AS critical_pct,
       i.iri_m_km                                       AS avg_iri
FROM region_network_stock ns
JOIN ref_region rr USING (region_code)
JOIN region_condition_km g ON g.region_code=ns.region_code AND g.band_code='GOOD' AND g.fiscal_year=ns.fiscal_year
JOIN region_condition_km f ON f.region_code=ns.region_code AND f.band_code='FAIR' AND f.fiscal_year=ns.fiscal_year
JOIN region_condition_km p ON p.region_code=ns.region_code AND p.band_code='POOR' AND p.fiscal_year=ns.fiscal_year
JOIN region_condition_km c ON c.region_code=ns.region_code AND c.band_code='CRIT' AND c.fiscal_year=ns.fiscal_year
JOIN region_condition_iri i ON i.region_code=ns.region_code AND i.survey_year=2025
ORDER BY rr.sort_order;

CREATE VIEW v_map_roads AS
SELECT rg.road_no, r.road_name, rg.coords_json,
       cb.band_name AS condition, cb.display_color AS condition_color
FROM road_geom rg
JOIN road r USING (road_no)
JOIN (SELECT rl.road_no, MAX(cb2.sort_order) AS worst
      FROM road_link rl
      JOIN link_condition_survey s ON s.link_id=rl.link_id
      JOIN ref_condition_band cb2 ON cb2.band_code=s.band_code
      GROUP BY rl.road_no) w ON w.road_no = rg.road_no
JOIN ref_condition_band cb ON cb.sort_order = w.worst;
