# Bug Register — full-platform scan (2026-06-10)

Method: automated scans of the source — every fetched data file vs `public/data`
contents, every sidebar nav id vs App render branches, every view id vs the
Header title registry — plus a security review of the data-write boundary.

| # | Severity | Bug | Status |
|---|---|---|---|
| 1 | **CRITICAL (security)** | Public `anon` key had INSERT/UPDATE on ~40 tables with RLS disabled — anyone could extract the key from the public bundle and corrupt the DB | **FIXED** — `supabase_secure_grants.sql` revokes all anon writes (run once in SQL editor); capture form now writes server-first via the service_role data-entry server; ETL auto-uses the service key |
| 2 | **CRITICAL (data)** | 20 data files referenced by the app (`gisnetwork18062025.geojson`, `bot_results.json`, `network_links.json`, `tcs_stations.json`, ferries/rail/airports layers, …) were missing from the repo's `public/data` — the live site only worked because old deploy overlays still carried them; any fresh clone/build would 404 the road network map, bot, stations and infra layers | **FIXED** — all 20 recovered from the deploy worktree into `public/data` and committed |
| 3 | HIGH (UX) | 18 views showed their raw id as the page title ("rms", "lifecycle", "bms", …) because they were missing from the Header `VIEW_TITLES` registry — visible in user screenshots | **FIXED** — all 18 titled with proper subtitles |
| 4 | MEDIUM | Road Asset Bot fetched `deep_ml_predictions.json` which exists nowhere; the result was also never used (dead destructure) — console noise + wasted request | **FIXED** — dead fetch removed |
| 5 | MEDIUM | Generic server insert endpoint couldn't upsert, so repeated capture submissions for the same link+year would 409 | **FIXED** — `?upsert=col1,col2` support added to `/api/admin/:table` |
| 6 | LOW (degraded) | `useDashboardBundle` falls back to `data/bundle.json`, which doesn't exist anywhere — RoadAtlas dashboard renders in degraded/empty state (failure-tolerant, no crash) | **OPEN** — needs a bundle export script in the ETL; tracked |
| 7 | LOW (security, by design) | Demo login credentials (`admin@unra.go.ug` / `admin2025`, …) are hardcoded in `AuthContext.tsx` and visible in the public bundle — the login gate is UX-deterrent only, not real security | **OPEN** — real fix is Supabase Auth; do not treat the gate as protection meanwhile |
| 8 | LOW | `bot_results.json` etc. were missing from the repo (subset of #2) | **FIXED** (with #2) |

## Outstanding actions
1. **Run `supabase_secure_grants.sql`** in the Supabase SQL editor (one paste) to activate the write lockdown — until then anon writes still work.
2. **Rotate the service_role key** (Dashboard → Settings → API) — it was shared in plaintext chat earlier.
3. Bundle export script for `bundle.json` (#6) and Supabase Auth migration (#7) — future work.
