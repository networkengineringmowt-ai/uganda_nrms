-- Maintenance Strategy registers (bridges, major culverts, asset values,
-- intervention rates, paved-road VCI condition) for the uganda_nrms Supabase
-- project (vbidhkvzjigatfygnycg - the anon key already embedded in
-- src/lib/supabase.ts). Run this once in the Supabase SQL editor.
--
-- Naming: prefixed nrms_ms_* (Maintenance Strategy) to avoid any collision
-- with the nrms_maintenance_* tables from the separate URF budget/priority-
-- register delivery already drafted against this same project. Bridges and
-- major culverts are kept as two separate tables, never merged, per the
-- platform's standing convention.
--
-- RLS: anon (public, read-only) SELECT access only, matching every other
-- table in this project. No INSERT/UPDATE/DELETE grant to anon. Seeding is
-- done with the service_role key, run by her locally, never pasted here.

create table if not exists nrms_ms_bridges (
  bridge_number       text primary key,
  bridge_name         text,
  road_number         text,
  type_crossing       text,
  condition           text,
  coordinate_e        double precision,
  coordinate_s         double precision,
  date_modified       date,
  remarks             text
);

create table if not exists nrms_ms_major_culverts (
  culvert_number      text primary key,
  road                text,
  river               text,
  section_or_link_no  text,
  condition           text,
  coordinate_e        double precision,
  coordinate_s        double precision,
  date_modified       date
);

create table if not exists nrms_ms_asset_values (
  id                    bigint generated always as identity primary key,
  surface_type          text not null check (surface_type in ('Paved', 'Unpaved')),
  fy                    text not null,
  length_km             double precision,
  unit_rate_mn_usd_per_km double precision,
  crc_mn_usd            double precision,
  condition_factor      double precision,
  cdrc_mn_usd           double precision,
  unique (surface_type, fy)
);

create table if not exists nrms_ms_intervention_rates (
  id                  bigint generated always as identity primary key,
  surface_type        text not null,
  intervention        text not null,
  rate_basis          text,
  rate_bn_ugx_per_km  double precision,
  rate_usd_per_km     double precision,
  note                text,
  unique (surface_type, intervention)
);

create table if not exists nrms_ms_paved_condition (
  road_no     text primary key,
  road_name   text,
  length_km   double precision,
  age_years   double precision,
  vci_pct     double precision,
  vci_rating  text
);

alter table nrms_ms_bridges              enable row level security;
alter table nrms_ms_major_culverts       enable row level security;
alter table nrms_ms_asset_values         enable row level security;
alter table nrms_ms_intervention_rates   enable row level security;
alter table nrms_ms_paved_condition      enable row level security;

create policy if not exists nrms_ms_bridges_anon_read
  on nrms_ms_bridges for select to anon using (true);
create policy if not exists nrms_ms_major_culverts_anon_read
  on nrms_ms_major_culverts for select to anon using (true);
create policy if not exists nrms_ms_asset_values_anon_read
  on nrms_ms_asset_values for select to anon using (true);
create policy if not exists nrms_ms_intervention_rates_anon_read
  on nrms_ms_intervention_rates for select to anon using (true);
create policy if not exists nrms_ms_paved_condition_anon_read
  on nrms_ms_paved_condition for select to anon using (true);
