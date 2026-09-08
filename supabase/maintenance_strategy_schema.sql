-- ═══════════════════════════════════════════════════════════════════════════
--  UGANDA NRMS — MAINTENANCE STRATEGY SCHEMA (Supabase / PostgreSQL)
--  Public Investment > Budget & Maintenance Trends
--
--  Source documents (D:\OneDrive\Maintenance Strategy):
--    · maintenance_backlog_oprc_ppp_workbook_v9_strategy.xlsx
--        - Link_Programme sheet: 338-link, network-wide maintenance priority
--          register with condition (VCI), priority score/rank/band, scheduled
--          FY and indicative cost per link
--        - Investment_Plan / Maintenance_Strategy sheets: 5-year forward
--          programme (FY26/27-FY30/31), intervention mix, unit cost schedule,
--          paved/unpaved strategy by FY
--    · Budgets\Consolidated.xlsx
--        - "All OUTPUT" / "Table 1 Summary Workplan" sheets: Uganda Road
--          Fund (URF) annual maintenance work plan by category, FY2024/25
--          and FY2025/26
--        - "SummaryStation" sheet: regional/station maintenance disbursement,
--          FY2023/24
--
--  Scope note: all figures below are URF routine/periodic MAINTENANCE
--  funding only. They do NOT include donor-funded new construction,
--  upgrading, or PPP expressway projects - those are tracked separately in
--  the IBP Project Register (see ibp_projects table / ibp_projects.json).
--
--  This project already has a live Supabase instance wired into the site
--  (src/lib/supabase.ts, anon-key read-only). Run this file once in that
--  project's SQL editor, then run scripts/seed_maintenance_strategy.mjs
--  locally with your own service-role key (never pasted into chat/session)
--  to load the data. RLS mirrors the existing nbms pattern: anon can SELECT,
--  nothing else.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · Network-wide link priority register (338 links) ──────────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_links (
  link_id                          TEXT PRIMARY KEY,          -- e.g. 'A001_Link01'
  road_no                          TEXT NOT NULL,
  road_class                       TEXT NOT NULL,              -- A / B / C
  link_name                        TEXT NOT NULL,
  surface_type                     TEXT NOT NULL,
  length_km                        NUMERIC NOT NULL,
  maintenance_station               TEXT,
  region                           TEXT NOT NULL,
  completion_year                  INTEGER,
  rehab_year                       INTEGER,
  last_intervention_year           INTEGER,
  age_at_2026                      INTEGER,
  vci_pct                          NUMERIC,                    -- Visual Condition Index, 0-100
  vci_rating                       TEXT,                       -- Good/Fair/Poor/Bad
  funder                           TEXT,
  oprc                             TEXT,
  current_programme_flag           TEXT,
  assessment_status                TEXT,
  recommended_intervention         TEXT,
  programme_stream                 TEXT,
  existing_funding_delivery_path   TEXT,
  optimal_fy                       TEXT,
  priority_score                   NUMERIC,
  priority_rank                    INTEGER,
  scheduled_fy                     TEXT,                       -- FY26/27 .. FY30/31
  indicative_base_cost_ugx_bn      NUMERIC,
  asset_value_at_risk_ugx_bn       NUMERIC,
  deterioration_rate               NUMERIC,
  priority_band                    TEXT                        -- Priority 1-4
);
CREATE INDEX IF NOT EXISTS idx_nrms_maint_links_fy       ON nrms_maintenance_links(scheduled_fy);
CREATE INDEX IF NOT EXISTS idx_nrms_maint_links_region   ON nrms_maintenance_links(region);
CREATE INDEX IF NOT EXISTS idx_nrms_maint_links_band     ON nrms_maintenance_links(priority_band);

-- ─── 2 · 5-year forward annual programme summary ───────────────────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_annual_programme (
  fy                        TEXT PRIMARY KEY,   -- FY26/27 .. FY30/31
  links                     INTEGER NOT NULL,
  programme_cost_bn         NUMERIC NOT NULL,
  asset_value_at_risk_bn    NUMERIC NOT NULL,
  funding_gap_bn            NUMERIC NOT NULL
);

-- ─── 3 · Intervention mix (5-year totals) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_intervention_mix (
  intervention   TEXT PRIMARY KEY,
  links          INTEGER NOT NULL,
  length_km      NUMERIC NOT NULL,
  cost_bn        NUMERIC NOT NULL
);

-- ─── 4 · Unit cost schedule ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_unit_costs (
  surface                     TEXT NOT NULL,
  intervention                TEXT NOT NULL,
  unit_cost_ugx_bn_per_km     NUMERIC NOT NULL,
  PRIMARY KEY (surface, intervention)
);

-- ─── 5 · Paved / unpaved strategy by FY (5-year detail) ────────────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_strategy_by_fy (
  surface        TEXT NOT NULL,     -- Paved / Unpaved
  intervention   TEXT NOT NULL,
  fy             TEXT NOT NULL,
  cost_bn        NUMERIC NOT NULL,
  PRIMARY KEY (surface, intervention, fy)
);

-- ─── 6 · URF annual maintenance work plan by category (actuals/plans) ──────
CREATE TABLE IF NOT EXISTS nrms_maintenance_workplan (
  fy                     TEXT NOT NULL,   -- FY2024/25, FY2025/26
  category               TEXT NOT NULL,   -- Routine Manual Maintenance, Periodic Maintenance, etc. or 'TOTAL'
  planned_exp_ugx_bn     NUMERIC NOT NULL,
  PRIMARY KEY (fy, category)
);

-- ─── 7 · Regional/station maintenance disbursement (FY2023/24) ─────────────
CREATE TABLE IF NOT EXISTS nrms_maintenance_regional_disbursement (
  fy                 TEXT NOT NULL,
  region             TEXT NOT NULL,
  station            TEXT NOT NULL,
  disbursed_ugx_bn   NUMERIC NOT NULL,
  PRIMARY KEY (fy, station)
);

-- ─── Row-Level Security: anon-read-only (same pattern as nbms tables) ──────
ALTER TABLE nrms_maintenance_links                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_annual_programme          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_intervention_mix          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_unit_costs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_strategy_by_fy            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_workplan                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrms_maintenance_regional_disbursement     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_nrms_maintenance_links ON nrms_maintenance_links;
CREATE POLICY anon_read_nrms_maintenance_links ON nrms_maintenance_links FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_annual_programme ON nrms_maintenance_annual_programme;
CREATE POLICY anon_read_nrms_maintenance_annual_programme ON nrms_maintenance_annual_programme FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_intervention_mix ON nrms_maintenance_intervention_mix;
CREATE POLICY anon_read_nrms_maintenance_intervention_mix ON nrms_maintenance_intervention_mix FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_unit_costs ON nrms_maintenance_unit_costs;
CREATE POLICY anon_read_nrms_maintenance_unit_costs ON nrms_maintenance_unit_costs FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_strategy_by_fy ON nrms_maintenance_strategy_by_fy;
CREATE POLICY anon_read_nrms_maintenance_strategy_by_fy ON nrms_maintenance_strategy_by_fy FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_workplan ON nrms_maintenance_workplan;
CREATE POLICY anon_read_nrms_maintenance_workplan ON nrms_maintenance_workplan FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_nrms_maintenance_regional_disbursement ON nrms_maintenance_regional_disbursement;
CREATE POLICY anon_read_nrms_maintenance_regional_disbursement ON nrms_maintenance_regional_disbursement FOR SELECT USING (true);
