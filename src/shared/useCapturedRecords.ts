/**
 * useCapturedRecords - reads field-captured data that drive_sync.py has
 * folded into public/data/captures_<table>.json (see drive_sync.py at the
 * repo root for how those files get produced from server/index.js's
 * captures/<table>.jsonl write-back log).
 *
 * These files only exist once someone has actually run `python
 * drive_sync.py` after a field session and redeployed — a fresh checkout or
 * a build with no captures yet simply won't have them, which is expected
 * and not an error. Callers get [] in that case (same as an empty table),
 * not a thrown error or a loading-forever state.
 */
import { useEffect, useState } from 'react';

// Module-level cache: many components can ask for the same table (e.g. an
// admin review list and a section's own dashboard) without re-fetching it
// on every mount. Cleared only by a full page reload, which is fine since
// these files only change via a rebuild+redeploy, never within a session.
const cache = new Map<string, Promise<unknown[]>>();

/**
 * Promise-based accessor for callers that need several tables at once (e.g.
 * a summary panel iterating a fixed table list) and so can't use the
 * `useCapturedRecords` hook once per table without violating the rules of
 * hooks. Shares the same cache as the hook.
 */
export function fetchCapturedTable<T = Record<string, unknown>>(table: string): Promise<T[]> {
  return loadTable(table) as Promise<T[]>;
}

function loadTable(table: string): Promise<unknown[]> {
  let p = cache.get(table);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/captures_${table}.json`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => [])
      .then(data => (Array.isArray(data) ? data : []));
    cache.set(table, p);
  }
  return p as Promise<unknown[]>;
}

/**
 * Fetch the folded records for one write-back table (see WRITABLE_TABLES in
 * server/index.js for the canonical table list). Returns `{ records,
 * loading }` — `records` is `[]` until the fetch resolves (or if the file
 * doesn't exist / isn't valid JSON), never `undefined`.
 */
export function useCapturedRecords<T = Record<string, unknown>>(table: string): { records: T[]; loading: boolean } {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTable(table).then(data => {
      if (!cancelled) {
        setRecords(data as T[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [table]);

  return { records, loading };
}
