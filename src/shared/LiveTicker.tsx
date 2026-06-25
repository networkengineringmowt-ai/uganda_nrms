/**
 * LiveTicker — a horizontal strip of continuously-updating "current value"
 * chips, fed by the background predictive engine (liveEngine.ts).
 *
 * Purely presentational: pass the metrics you want shown. A pulsing dot and an
 * "as of HH:MM:SS" stamp make it clear the figures are live, not a snapshot.
 */
import type { ReactNode } from 'react';

export interface LiveMetric {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  color?: string;
}

export function LiveTicker({
  metrics, accent = '#00f5ff', asOf, title = 'Predictive Live Engine', ready = true,
}: {
  metrics: LiveMetric[];
  accent?: string;
  asOf: string;
  title?: string;
  ready?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0, flexShrink: 0,
      background: '#000000',
      borderBottom: `1px solid ${accent}22`,
      overflowX: 'auto',
    }}>
      {/* Engine status badge */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 2, padding: '7px 14px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: `linear-gradient(135deg, ${accent}14, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: ready ? '#00ff88' : '#ffd23f',
            boxShadow: `0 0 8px ${ready ? '#00ff88' : '#ffd23f'}`,
            animation: 'live-pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
            color: ready ? 'rgba(0,255,136,0.85)' : 'rgba(255,210,63,0.85)' }}>
            {ready ? 'LIVE' : 'SYNCING'}
          </span>
        </div>
        <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: 8.5, fontFamily: 'JetBrains Mono, monospace', color: accent, whiteSpace: 'nowrap' }}>
          as of {asOf}
        </div>
      </div>

      {/* Metric chips */}
      {metrics.map((m, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 1, padding: '7px 16px', flexShrink: 0, minWidth: 84,
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: 'rgba(148,163,184,0.55)', whiteSpace: 'nowrap' }}>
            {m.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1,
              color: m.color ?? accent, fontFamily: 'JetBrains Mono, monospace',
              textShadow: `0 0 14px ${(m.color ?? accent)}55` }}>
              {m.value}
            </span>
            {m.unit && <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.7)' }}>{m.unit}</span>}
          </div>
          {m.sub && <div style={{ fontSize: 7.5, color: 'rgba(148,163,184,0.45)', whiteSpace: 'nowrap' }}>{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export default LiveTicker;
