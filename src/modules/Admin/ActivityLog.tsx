/**
 * ActivityLog - admin-only login summaries + full audit trail.
 * Reads logs/audit_YYYY-MM.jsonl from the G: Drive repository via the local
 * data-entry server (GET /api/audit). When the server is unreachable it shows
 * this browser's still-queued events so nothing is invisible.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download, ShieldAlert } from 'lucide-react';
import { roleLabel } from '../Auth/authTypes';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

interface Ev {
  type?: string;
  at?: string;
  _logged?: string;
  user?: string;
  role?: string;
  op?: string;
  table?: string;
  detail?: Record<string, unknown>;
  [k: string]: unknown;
}

// Vivid platform palette (--neon-* in index.css) - reused rather than the
// duller tailwind-style hexes this module used before.
const TYPE_META: Record<string, { label: string; color: string }> = {
  login:        { label: 'Login',        color: '#00ff88' },
  login_failed: { label: 'Failed login', color: '#ff3366' },
  logout:       { label: 'Logout',       color: '#94a3b8' },
  change:       { label: 'Change',       color: '#ffd23f' },
  view:         { label: 'Page view',    color: '#4d9fff' },
};
const meta = (t?: string) => TYPE_META[t ?? ''] ?? { label: t ?? 'event', color: '#64748b' };
const when = (e: Ev) => e.at ?? e._logged ?? '';
const fmtTime = (iso: string) => iso ? iso.replace('T', ' ').slice(0, 19) : '-';

export default function ActivityLog() {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth]   = useState<string>('');
  const [events, setEvents] = useState<Ev[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async (m?: string) => {
    setLoading(true);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(`http://localhost:3001/api/audit${m ? `?month=${m}` : ''}`, { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setMonths(j.months ?? []);
      setMonth(j.month ?? '');
      setEvents(j.events ?? []);
      setOffline(false);
    } catch {
      // Server unreachable - surface this browser's queued (undelivered) events.
      try { setEvents((JSON.parse(localStorage.getItem('audit_log_queue') ?? '[]') as Ev[]).slice().reverse()); }
      catch { setEvents([]); }
      setMonths([]); setMonth('');
      setOffline(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Aggregations ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { login: 0, login_failed: 0, change: 0, view: 0, logout: 0 };
    const users = new Set<string>();
    for (const e of events) {
      if (e.type && e.type in s) s[e.type as keyof typeof s]++;
      if (e.user && e.user !== 'unknown') users.add(e.user);
    }
    return { ...s, users: users.size };
  }, [events]);

  const perUser = useMemo(() => {
    const m = new Map<string, { role: string; login: number; login_failed: number; change: number; view: number; last: string }>();
    for (const e of events) {
      const u = e.user ?? (e.detail as { attempted?: string } | undefined)?.attempted ?? 'unknown';
      const rec = m.get(u) ?? { role: e.role ?? '', login: 0, login_failed: 0, change: 0, view: 0, last: '' };
      if (e.role) rec.role = e.role;
      if (e.type === 'login') rec.login++;
      if (e.type === 'login_failed') rec.login_failed++;
      if (e.type === 'change') rec.change++;
      if (e.type === 'view') rec.view++;
      if (when(e) > rec.last) rec.last = when(e);
      m.set(u, rec);
    }
    return [...m.entries()].sort((a, b) => (b[1].last > a[1].last ? 1 : -1));
  }, [events]);

  const perUserRows = useMemo(() => perUser.map(([user, r]) => ({ user, ...r })), [perUser]);

  const perUserColumns: STColumn<{ user: string; role: string; login: number; login_failed: number; change: number; view: number; last: string }>[] = [
    { key: 'user', label: 'User' },
    { key: 'role', label: 'Level', render: r => (
        <span style={{ fontWeight: 700, color: r.role === 'admin' ? '#ff3366' : r.role === 'super' ? '#ffd23f' : '#00ff88' }}>
          {roleLabel(r.role)}
        </span>
      ) },
    { key: 'login', label: 'Logins', numeric: true },
    { key: 'login_failed', label: 'Failed Logins', numeric: true, render: r => (
        <span style={{ color: r.login_failed ? '#ff3366' : 'inherit', fontWeight: r.login_failed ? 800 : 400 }}>{r.login_failed}</span>
      ) },
    { key: 'change', label: 'Changes', numeric: true },
    { key: 'view', label: 'Page Views', numeric: true },
    { key: 'last', label: 'Last Activity', date: true, render: r => fmtTime(r.last) },
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (!needle) return true;
      return JSON.stringify(e).toLowerCase().includes(needle);
    });
  }, [events, typeFilter, q]);

  const TRAIL_CAP = 800;
  interface TrailRow { idx: number; time: string; type: string; user: string; role: string; detail: string }
  const trailRows: TrailRow[] = useMemo(() => filtered.slice(0, TRAIL_CAP).map((e, i) => {
    const detail = { ...e } as Record<string, unknown>;
    ['type', 'at', '_logged', 'user', 'role'].forEach(k => delete detail[k]);
    return {
      idx: i, time: when(e), type: e.type ?? 'event', user: e.user ?? '-', role: e.role ?? '',
      detail: Object.keys(detail).length ? JSON.stringify(detail) : '',
    };
  }), [filtered]);

  const trailColumns: STColumn<TrailRow>[] = [
    { key: 'time', label: 'Time', date: true, render: r => fmtTime(r.time) },
    { key: 'type', label: 'Event', render: r => {
        const m = meta(r.type);
        return (
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800,
            background: `${m.color}1a`, border: `1px solid ${m.color}55`, color: m.color }}>
            {m.label}
          </span>
        );
      } },
    { key: 'user', label: 'User' },
    { key: 'role', label: 'Level', render: r => roleLabel(r.role) },
    { key: 'detail', label: 'Detail', render: r => (
        <span style={{ whiteSpace: 'normal', fontFamily: 'monospace', fontSize: 10, color: 'rgba(148,163,184,0.75)' }}>
          {r.detail || <span style={{ color: 'rgba(148,163,184,0.45)' }}>No additional detail</span>}
        </span>
      ) },
  ];

  function exportCsv() {
    const head = 'time,type,user,role,detail';
    const rows = filtered.map(e => [
      fmtTime(when(e)), e.type ?? '', e.user ?? '', e.role ?? '',
      JSON.stringify({ ...e, type: undefined, at: undefined, _logged: undefined, user: undefined, role: undefined }).replace(/"/g, '""'),
    ].map(c => `"${c}"`).join(','));
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity_log_${month || 'queued'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const CARD: React.CSSProperties = {
    background: 'rgba(8,14,28,0.7)', border: '1px solid rgba(77,159,255,0.14)',
    borderRadius: 10, padding: '12px 14px',
  };
  return (
    <div style={{ padding: '14px 16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>Activity Log - track &amp; trace</div>
          <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.65)' }}>
            Logins, failed attempts, page views and every change · stored in the G: Drive repository (logs/audit_*.jsonl)
          </div>
        </div>
        {months.length > 0 && (
          <SearchableSelect value={month} onChange={v => void load(v)} style={{
            background: 'rgba(10,16,30,0.9)', color: '#e2e8f0', border: '1px solid rgba(77,159,255,0.3)',
            borderRadius: 7, fontSize: 11, padding: '6px 9px' }}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </SearchableSelect>
        )}
        <button onClick={() => void load(month || undefined)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', cursor: 'pointer',
          background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)',
          borderRadius: 7, color: '#4d9fff', fontSize: 11, fontWeight: 700 }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button onClick={exportCsv} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', cursor: 'pointer',
          background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
          borderRadius: 7, color: '#00ff88', fontSize: 11, fontWeight: 700 }}>
          <Download size={12} /> CSV
        </button>
      </div>

      {offline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginBottom: 12,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8,
          fontSize: 11.5, color: '#fbbf24' }}>
          <ShieldAlert size={14} />
          Data-entry server offline - showing only this browser's {events.length} queued event(s).
          Start the server (cd server &amp;&amp; npm run dev) to read the full G: Drive trail.
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        {([
          ['Logins', stats.login, '#00ff88'], ['Failed logins', stats.login_failed, '#ff3366'],
          ['Changes', stats.change, '#ffd23f'], ['Page views', stats.view, '#4d9fff'],
          ['Active users', stats.users, '#b967ff'],
        ] as Array<[string, number, string]>).map(([label, n, color]) => (
          <div key={label} style={CARD}>
            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Per-user login summary */}
      <div style={{ ...CARD, padding: 12, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ padding: '0 0 8px', fontSize: 11.5, fontWeight: 800, color: '#e2eaf4' }}>
          Login data summary - by user{month ? ` · ${month}` : ''}
        </div>
        <SortableFilterableTable
          columns={perUserColumns}
          rows={perUserRows}
          accent="#4d9fff"
          exportName="activity-log-by-user"
          initialSort="last"
          emptyText="No events recorded yet."
        />
      </div>

      {/* Event trail */}
      <div style={{ ...CARD, padding: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 8px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#e2eaf4', flex: 1, minWidth: 140 }}>
            Full event trail · {filtered.length} of {events.length}
            {filtered.length > TRAIL_CAP && ` (showing the ${TRAIL_CAP} most recent - refine the filters below to narrow further)`}
          </div>
          {['all', ...Object.keys(TYPE_META)].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '4px 9px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, cursor: 'pointer',
              background: typeFilter === t ? `${t === 'all' ? '#4d9fff' : meta(t).color}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${typeFilter === t ? (t === 'all' ? '#4d9fff' : meta(t).color) : 'rgba(255,255,255,0.1)'}`,
              color: typeFilter === t ? (t === 'all' ? '#4d9fff' : meta(t).color) : 'rgba(148,163,184,0.7)' }}>
              {t === 'all' ? 'All' : meta(t).label}
            </button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search user / table / detail…"
            style={{ background: 'rgba(10,16,30,0.9)', border: '1px solid rgba(77,159,255,0.25)', borderRadius: 7,
              color: '#e2e8f0', fontSize: 11, padding: '6px 10px', width: 200 }} />
        </div>
        <SortableFilterableTable
          columns={trailColumns}
          rows={trailRows}
          accent="#4d9fff"
          exportName="activity-event-trail"
          initialSort="time"
          emptyText="Nothing matches the current filter."
        />
      </div>
    </div>
  );
}
