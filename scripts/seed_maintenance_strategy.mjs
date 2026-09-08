// Seeds the nrms_maintenance_* tables (see supabase/maintenance_strategy_schema.sql)
// from public/maintenance_strategy.json.
//
// Run this yourself, locally, AFTER running maintenance_strategy_schema.sql in
// your Supabase project's SQL editor:
//
//   SUPABASE_URL=https://vbidhkvzjigatfygnycg.supabase.co \
//   SUPABASE_SERVICE_KEY=<your service_role key - keep this secret> \
//   node scripts/seed_maintenance_strategy.mjs
//
// The service_role key bypasses RLS and must never be committed, pasted into
// chat, or shipped in the frontend bundle - that's why this script reads it
// from an environment variable instead.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables first (see comment at top of this file).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const dataPath = path.join(__dirname, '..', 'public', 'maintenance_strategy.json');
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

async function upsert(table, rows, chunkSize = 500) {
  if (!rows || rows.length === 0) {
    console.log(`  ${table}: 0 rows, skipping`);
    return;
  }
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) {
      console.error(`  ${table}: FAILED at offset ${i}:`, error.message);
      process.exit(1);
    }
    done += chunk.length;
  }
  console.log(`  ${table}: ${done} rows upserted`);
}

async function main() {
  console.log('Seeding nrms_maintenance_* tables from public/maintenance_strategy.json ...');

  await upsert('nrms_maintenance_links', data.links);

  await upsert('nrms_maintenance_annual_programme', data.annual_programme);

  await upsert('nrms_maintenance_intervention_mix', data.intervention_mix);

  await upsert('nrms_maintenance_unit_costs', data.unit_costs);

  // paved_strategy_by_fy / unpaved_strategy_by_fy are wide (one column per FY);
  // flatten each into {surface, intervention, fy, cost_bn} rows for the
  // nrms_maintenance_strategy_by_fy table.
  const strategyRows = [];
  const fyKeys = ['FY26/27', 'FY27/28', 'FY28/29', 'FY29/30', 'FY30/31'];
  for (const [surface, rows] of [['Paved', data.paved_strategy_by_fy], ['Unpaved', data.unpaved_strategy_by_fy]]) {
    for (const row of rows || []) {
      const intervention = row.intervention;
      for (const fy of fyKeys) {
        if (fy in row) {
          strategyRows.push({ surface, intervention, fy, cost_bn: row[fy] });
        }
      }
    }
  }
  await upsert('nrms_maintenance_strategy_by_fy', strategyRows);

  await upsert('nrms_maintenance_workplan', data.annual_maintenance_workplan);

  await upsert('nrms_maintenance_regional_disbursement', data.regional_disbursement_2023_24);

  console.log('Done.');
}

main();
