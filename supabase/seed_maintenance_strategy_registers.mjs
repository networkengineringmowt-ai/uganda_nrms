// Seeds the nrms_ms_* Maintenance Strategy tables (see
// maintenance_strategy_registers_schema.sql) from maintenance_strategy.json.
//
// Run this yourself, locally, from the uganda_nrms repo root, after applying
// the schema file in the Supabase SQL editor:
//
//   SUPABASE_SERVICE_KEY=<your service_role key> node scripts/seed_maintenance_strategy_registers.mjs
//
// This script is never run by an assistant session and the service key is
// never pasted into chat - it only ever lives in your own shell environment.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://vbidhkvzjigatfygnycg.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY in your environment before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const data = JSON.parse(readFileSync(new URL('../public/data/maintenance_strategy.json', import.meta.url)));

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: seeded ${rows.length} rows`);
}

const bridges = data.bridges.map(b => ({
  bridge_number: b.bridgeNumber, bridge_name: b.bridgeName, road_number: b.roadNumberPrincipal,
  type_crossing: b.typeCrossing, condition: b.condition,
  coordinate_e: b.coordinates.e, coordinate_s: b.coordinates.s,
  date_modified: b.dateModified, remarks: b.remarks,
}));

const culverts = data.majorCulverts.map(c => ({
  culvert_number: c.culvertNumber, road: c.road, river: c.river, section_or_link_no: c.sectionOrLinkNo,
  condition: c.condition, coordinate_e: c.coordinates.e, coordinate_s: c.coordinates.s,
  date_modified: c.dateModified,
}));

const assetValues = [
  ...data.assetValues.paved.map(r => ({ surface_type: 'Paved', fy: r.fy, length_km: r.lengthKm, unit_rate_mn_usd_per_km: r.unitRateMnUsdPerKm, crc_mn_usd: r.crcMnUsd, condition_factor: r.conditionFactor, cdrc_mn_usd: r.cdrcMnUsd })),
  ...data.assetValues.unpaved.map(r => ({ surface_type: 'Unpaved', fy: r.fy, length_km: r.lengthKm, unit_rate_mn_usd_per_km: r.unitRateMnUsdPerKm, crc_mn_usd: r.crcMnUsd, condition_factor: r.conditionFactor, cdrc_mn_usd: r.cdrcMnUsd })),
];

const rates = data.interventionRates.rates.map(r => ({
  surface_type: r.surface, intervention: r.intervention, rate_basis: r.rateBasis,
  rate_bn_ugx_per_km: r.rateBnUgxPerKm, rate_usd_per_km: r.rateUsdPerKm, note: r.note,
}));

const pavedCondition = data.pavedRoadCondition.map(r => ({
  road_no: r.roadNo, road_name: r.roadName, length_km: r.lengthKm, age_years: r.ageYears,
  vci_pct: r.vciPct, vci_rating: r.vciRating,
}));

await upsert('nrms_ms_bridges', bridges, 'bridge_number');
await upsert('nrms_ms_major_culverts', culverts, 'culvert_number');
await upsert('nrms_ms_asset_values', assetValues, 'surface_type,fy');
await upsert('nrms_ms_intervention_rates', rates, 'surface_type,intervention');
await upsert('nrms_ms_paved_condition', pavedCondition, 'road_no');

console.log('Done.');
