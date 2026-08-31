-- Uganda National Roads — restore the anon-role write boundary
-- =============================================================
--
-- BACKGROUND
-- server/index.js's own design intends every table below to be
-- anon-readable but service_role-write-only: field data-entry goes through
-- the local write-back server (which holds the service_role key, never
-- shipped to the browser), and the public anon key embedded in the deployed
-- JS bundle (src/lib/supabase.ts) is meant for reads only. Commit 672320d
-- ("...lock the anon write boundary") applied exactly this lockdown once,
-- via a companion supabase_secure_grants.sql that lived in the G: Drive
-- repository (never committed to git) — but it was run against the OLD
-- Supabase project ("udionwmqmjcfzbdhoetv", still hardcoded today in
-- scripts/etl_all.py before this session's fix). The app has since migrated
-- to a new project ("vbidhkvzjigatfygnycg", in src/lib/supabase.ts), and
-- this lockdown was never re-applied there.
--
-- CONFIRMED LIVE: an anonymous POST to
-- https://vbidhkvzjigatfygnycg.supabase.co/rest/v1/road_reserve_applicants
-- with the public anon key succeeded (HTTP 201) and inserted a real row —
-- i.e. anyone holding the anon key (public, it's in the JS bundle) can
-- currently write to this PII table. This script closes that gap for every
-- table server/index.js's WRITABLE_TABLES allowlist covers.
--
-- WHAT THIS DOES
--  1. Ensures Row Level Security is enabled + FORCEd on each table (FORCE
--     matters because the table owner otherwise bypasses RLS entirely).
--  2. Grants anon SELECT only (matching server/index.js's own comment: "The
--     anon key has SELECT-only on these").
--  3. Grants service_role full read/write (it already bypasses RLS as a
--     superuser-equivalent in Supabase, but this makes the intent explicit
--     and keeps GRANTs in sync with intent even if that ever changes).
--  4. Adds an explicit RLS policy denying INSERT/UPDATE/DELETE to anon (a
--     default-deny already exists once RLS is enabled with no matching
--     policy, but an explicit "false" policy documents intent and survives
--     someone later adding a permissive SELECT policy without noticing it
--     doesn't cover writes).
--
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> paste this file -> Run. Requires
-- owner/service_role privileges (the anon key cannot run this, by design).
-- Safe to re-run (every statement is idempotent).
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not touch anon's SELECT access. server/index.js's comment states
-- anon SELECT is intentional (citizen-facing read paths / status lookups
-- may rely on it). If road_reserve_applicants / road_reserve_applications
-- should NOT be publicly SELECT-able either (they hold PII — TIN, phone,
-- email, physical address), that's a separate, bigger decision (would need
-- an authenticated-role split or a server-side read proxy) — flagging it
-- here rather than changing read access unilaterally.

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'road_link_condition',
    'structure_condition_history',
    'inspections',
    'work_orders',
    'bridge_documents',
    'maintenance_programme',
    'road_reserve_records',
    'road_reserve_encroachments',
    'road_reserve_gazette',
    'road_reserve_applicants',
    'road_reserve_applications',
    'project_tracker'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip % - table does not exist in this project', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('revoke insert, update, delete on public.%I from anon', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);

    execute format('drop policy if exists anon_read_only on public.%I', t);
    execute format(
      'create policy anon_read_only on public.%I for select to anon using (true)', t
    );

    execute format('drop policy if exists anon_no_write on public.%I', t);
    execute format(
      'create policy anon_no_write on public.%I for all to anon using (false) with check (false)', t
    );

    execute format('drop policy if exists service_role_all on public.%I', t);
    execute format(
      'create policy service_role_all on public.%I for all to service_role using (true) with check (true)', t
    );

    raise notice 'secured %', t;
  end loop;
end $$;

commit;

-- VERIFY (run separately, as anon — e.g. from a browser console using the
-- public anon key, the same way the original bug was confirmed):
--   INSERT should now fail:
--     POST /rest/v1/road_reserve_applicants  body: {}
--     -> expect 401/403 "new row violates row-level security policy"
--   SELECT should still work:
--     GET  /rest/v1/road_reserve_applicants?select=*&limit=1
--     -> expect 200 (empty array or rows, not an error)
