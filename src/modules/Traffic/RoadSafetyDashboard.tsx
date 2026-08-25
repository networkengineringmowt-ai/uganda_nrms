/**
 * RoadSafetyDashboard - Road Safety sub-tab for the TIS/Traffic section.
 * Queries: road_accidents, road_blackspots
 * Shows: KPI row, severity breakdown chart, top-5 blackspots table, YoY trend.
 * Security: aggregate stats only - no individual records, no lat/lng as KPI/chart axes.
 * Graceful degradation: shows "No data available yet" if tables are absent or empty.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, AlertTriangle, RefreshCw, Database, TrendingUp } from 'lucide-react';

// ── palette ────────────────────────────────────────────────────────────────────
const C = {
  red: '#ff3366', orange: '#ff6b35', yellow: '#ffd23f',
  green: '#00ff88', cyan: '#00f5ff', blue: '#4d9fff',
  gray: '#475569',
} as const;

function rgb(h: string) {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ── types ──────────────────────────────────────────────────────────────────────
interface AccidentRow {
  severity?:      string;
  accident_year?: number;
  accident_date?: string;
  road_link_id?:  string;
  district?:      string;
}
interface BlackspotRow {
  road_link_id?:  string;
  road_name?:     string;
  accident_count?: number;
  severity_score?: number;
  district?:      string;
}

interface SafetyData {
  totalAll:      number;
  total12m:      number;
  fatal:         number;
  serious:       number;
  minor:         number;
  byYear:        { year: number; count: number }[];
  blackspots:    { name: string; district: string; accidents: number; severity: string }[];
}

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function safeCount(table: string, filter?: Record<string, string>): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

async function safeRows<T>(
  table: string, cols: string, limit = 500,
): Promise<T[]> {
  try {
    const { data } = await supabase.from(table).select(cols).limit(limit);
    return (data ?? []) as unknown as T[];
  } catch { return []; }
}

// ── data fetch ─────────────────────────────────────────────────────────────────
async function fetchSafetyData(): Promise<SafetyData | null> {
  const currentYear = new Date().getFullYear();
  const cutoff12m   = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [accRows, bsRows, total12m] = await Promise.all([
    safeRows<AccidentRow>('road_accidents', 'severity,accident_year,accident_date,road_link_id,district', 2000),
    safeRows<BlackspotRow>('road_blackspots', 'road_link_id,road_name,accident_count,severity_score,district', 50),
    safeCount('road_accidents'),
  ]);

  if (total12m === 0 && bsRows.length === 0) return null;

  // Severity breakdown
  const fatal   = accRows.filter(r => String(r.severity ?? '').toLowerCase().startsWith('fat')).length;
  const serious  = accRows.filter(r => String(r.severity ?? '').toLowerCase().startsWith('ser')).length;
  const minor    = accRows.filter(r =>
    String(r.severity ?? '').toLowerCase().startsWith('min') ||
    String(r.severity ?? '').toLowerCase() === 'slight',
  ).length;

  // Last 12 months (using accident_date or fallback accident_year)
  const last12m = accRows.filter(r => {
    if (r.accident_date) return r.accident_date >= cutoff12m;
    if (r.accident_year) return r.accident_year >= currentYear - 1;
    return false;
  }).length;

  // Year-over-year trend (last 6 years)
  const yearCounts: Record<number, number> = {};
  for (const r of accRows) {
    let yr: number | null = null;
    if (r.accident_year) yr = Number(r.accident_year);
    else if (r.accident_date) yr = new Date(r.accident_date).getFullYear();
    if (yr && yr >= currentYear - 6 && yr <= currentYear) {
      yearCounts[yr] = (yearCounts[yr] ?? 0) + 1;
    }
  }
  const byYear = Object.entries(yearCounts)
    .map(([y, c]) => ({ year: Number(y), count: c }))
    .sort((a, b) => a.year - b.year);

  // Top-5 blackspots
  const blackspots = bsRows
    .map(b => ({
      name:      b.road_name ?? b.road_link_id ?? '-',
      district:  b.district ?? '-',
      accidents: Number(b.accident_count ?? 0),
      severity:  b.severity_score != null ? String(Number(b.severity_score).toFixed(1)) : '-',
    }))
    .sort((a, b) => b.accidents - a.accidents)
    .slice(0, 5);

  return {
    totalAll: total12m,
    total12m: last12m,
    fatal,
    serious,
    minor,
    byYear,
    blackspots,
  };
}

// ── sub-components ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const r = rgb(color);
  return (
    <div style={{
      flex: '1 1 0', minWidth: 110, borderRadius: 10, padding: '13px 15px',
      background: `rgba(${r},0.08)`, border: `1px solid rgba(${r},0.25)`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.8)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SeverityChart({ fatal, serious, minor }: { fatal: number; serious: number; minor: number }) {
  const total = fatal + serious + minor || 1;
  const bars = [
    { label: 'Fatal',   value: fatal,   color: C.red },
    { label: 'Serious', value: serious, color: C.orange },
    { label: 'Minor',   value: minor,   color: C.yellow },
  ];
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ borderRadius: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Severity Breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map(bar => (
          <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.65)', width: 52, flexShrink: 0, textAlign: 'right' }}>{bar.label}</div>
            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, (bar.value / max) * 100)}%`, height: '100%', background: bar.color, borderRadius: 4, transition: 'width 0.55s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: bar.color, width: 42, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {bar.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', width: 36 }}>
              {`${((bar.value / total) * 100).toFixed(1)}%`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearChart({ byYear }: { byYear: { year: number; count: number }[] }) {
  if (byYear.length < 2) return null;
  const max = Math.max(...byYear.map(y => y.count), 1);
  return (
    <div style={{ borderRadius: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <TrendingUp size={12} style={{ color: C.cyan }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Year-over-Year Accident Trend
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {byYear.map(({ year, count }) => (
          <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.5)', fontVariantNumeric: 'tabular-nums' }}>{count}</div>
            <div style={{
              width: '100%', background: C.cyan, borderRadius: '3px 3px 0 0', opacity: 0.75,
              height: `${Math.max(4, (count / max) * 44)}px`, transition: 'height 0.5s ease',
            }} />
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)' }}>{year}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlackspotTable({ spots }: { spots: { name: string; district: string; accidents: number; severity: string }[] }) {
  if (!spots.length) return null;
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Top Road Blackspots
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['Road Link / Name', 'District', 'Accidents', 'Severity Score'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spots.map((s, i) => (
            <tr key={i} style={{ background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              <td style={{ padding: '7px 12px', color: '#d1d5db', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name ?? '-'}</td>
              <td style={{ padding: '7px 12px', color: 'rgba(148,163,184,0.65)' }}>{s.district ?? '-'}</td>
              <td style={{ padding: '7px 12px', color: C.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.accidents ?? '-'}</td>
              <td style={{ padding: '7px 12px', color: 'rgba(148,163,184,0.65)' }}>{s.severity ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── main export ────────────────────────────────────────────────────────────────
export default function RoadSafetyDashboard() {
  const [state, setState] = useState<'loading' | 'empty' | SafetyData>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const d = await fetchSafetyData();
      setState(d ?? 'empty');
    } catch { setState('empty'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: '14px 18px', maxWidth: 900 }}>
      <style>{`@keyframes rs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Section header */}
      <div style={{
        background: `rgba(${rgb(C.red)},0.05)`, border: `1px solid rgba(${rgb(C.red)},0.2)`,
        borderRadius: 12, padding: '14px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: `rgba(${rgb(C.red)},0.15)`, border: `1px solid rgba(${rgb(C.red)},0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert size={20} style={{ color: C.red }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#e2eaf4' }}>Road Safety Analytics</div>
          <div style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.75)', lineHeight: 1.6, marginTop: 4 }}>
            Accident frequency, severity distribution and blackspot identification across Uganda's national road network.
            Source: <strong style={{ color: C.cyan }}>road_accidents</strong> · <strong style={{ color: C.cyan }}>road_blackspots</strong>
          </div>
        </div>
      </div>

      {/* Loading */}
      {state === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'rgba(148,163,184,0.45)', fontSize: 12 }}>
          <RefreshCw size={13} style={{ animation: 'rs-spin 1s linear infinite', color: C.red }} />
          Loading road safety data…
        </div>
      )}

      {/* Empty state */}
      {state === 'empty' && (
        <div style={{
          borderRadius: 10, padding: '20px 16px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Database size={18} style={{ color: `rgba(${rgb(C.red)},0.55)`, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(148,163,184,0.65)' }}>No road safety data available yet</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>
              The <code>road_accidents</code> and <code>road_blackspots</code> Supabase tables are empty or not yet connected.
            </div>
          </div>
        </div>
      )}

      {/* Live data */}
      {state !== 'loading' && state !== 'empty' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPI row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <KPICard label="Total Accidents" value={(state.totalAll ?? 0).toLocaleString()} sub="all time" color={C.red} />
            <KPICard label="Last 12 Months" value={(state.total12m ?? 0).toLocaleString()} color={C.orange} />
            <KPICard label="Fatal" value={(state.fatal ?? 0).toLocaleString()} color={C.red} />
            <KPICard label="Serious Injury" value={(state.serious ?? 0).toLocaleString()} color={C.orange} />
            <KPICard label="Minor Injury" value={(state.minor ?? 0).toLocaleString()} color={C.yellow} />
          </div>

          {/* Severity chart */}
          {(state.fatal > 0 || state.serious > 0 || state.minor > 0) && (
            <SeverityChart fatal={state.fatal} serious={state.serious} minor={state.minor} />
          )}

          {/* YoY trend */}
          {state.byYear.length > 1 && <YearChart byYear={state.byYear} />}

          {/* Blackspot table */}
          {state.blackspots.length > 0 && <BlackspotTable spots={state.blackspots} />}

          {/* Note */}
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.35)', lineHeight: 1.5 }}>
            <AlertTriangle size={9} style={{ marginRight: 4 }} />
            Aggregate statistics only. Individual records are not displayed. Spatial identifiers are used for reference only.
          </div>
        </div>
      )}
    </div>
  );
}
