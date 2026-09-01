/**
 * Live Supabase connection status - a real check, not a decorative label.
 *
 * The sidebar footer used to show a hardcoded green "System Online" dot that
 * never actually queried anything - it would say "Online" even if the
 * Supabase project were completely unreachable. This hook replaces that with
 * an actual lightweight HEAD request (road_links is the one table confirmed
 * to exist in the live project) so the status shown genuinely reflects
 * whether the platform can reach its database right now.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type DbStatus = 'checking' | 'connected' | 'offline';

const CHECK_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 6_000;

async function pingDb(): Promise<boolean> {
  try {
    const q = supabase.from('road_links').select('link_id', { count: 'exact', head: true });
    const t = new Promise<null>(res => setTimeout(() => res(null), TIMEOUT_MS));
    const res = await Promise.race([q, t]);
    // A PostgREST error object (e.g. table missing) still means the server
    // answered - only a network failure/timeout counts as "offline".
    return res !== null;
  } catch {
    return false;
  }
}

export function useDbStatus(): DbStatus {
  const [status, setStatus] = useState<DbStatus>('checking');
  useEffect(() => {
    let dead = false;
    const check = async () => {
      const ok = await pingDb();
      if (!dead) setStatus(ok ? 'connected' : 'offline');
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => { dead = true; clearInterval(id); };
  }, []);
  return status;
}
