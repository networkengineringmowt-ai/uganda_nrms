import { useEffect, useMemo, useState } from 'react';
import { hexRgb } from '../../lib/chart3d';
import { C, ALL_REGIONS, REGION_COLORS, WORST_LINKS, type StoryData } from './NetworkStory';

// The two data tables that used to live on Network Story's Dashboard tab
// (worst-performing links, regional paved/unpaved breakdown). Moved here so
// this section's Dashboard tab stays table-free like every other section,
// per the platform's no-tables-on-Dashboard rule - Network Story is a
// directly sidebar-reachable section (not a deep-link-only one), so this
// follows the exact same pattern already applied to the platform's other
// table-bearing sections (see SectionDashboard.tsx SECTION_EXTRAS comment).
// Reads the same `network_story_data.json` + `WORST_LINKS` NetworkStory.tsx
// uses, via its own independent fetch/state (kept self-contained rather than
// threading a shared store through both components).

type SortCol = 'region' | 'paved_km' | 'unpaved_km' | 'total' | 'pct' | 'links';

function Section({ title, accent = C.purple, children }: { title: string; accent?: string; children: React.ReactNode }) {
  const rgb = hexRgb(accent);
  return (
    <div style={{
      marginBottom: 28,
      background: `linear-gradient(135deg, rgba(${rgb},0.06) 0%, rgba(2,5,8,0.55) 60%, rgba(${rgb},0.02) 100%)`,
      border: `1px solid rgba(${rgb},0.15)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: `0 4px 32px rgba(${rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.03)`,
    }}>
      <h2 style={{
        fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: accent, margin: '0 0 16px 0',
        textShadow: `0 0 12px rgba(${rgb},0.4)`,
      }}>{title}</h2>
      {children}
    </div>
  );
}

export default function NetworkStoryTables() {
  const [data, setData] = useState<StoryData | null>(null);
  const [error, setError] = useState(false);
  const [activeRegions, setActiveRegions] = useState<string[]>(ALL_REGIONS);
  const [sortCol, setSortCol] = useState<SortCol>('paved_km');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hovRow, setHovRow] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}network_story_data.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: StoryData) => setData(d))
      .catch(() => setError(true));
  }, []);

  const toggleRegion = (r: string) => {
    setActiveRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const sortedRegions = useMemo(() => {
    if (!data) return [];
    const rows = data.by_region.filter(r => activeRegions.includes(r.region));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortCol === 'region' ? a.region : sortCol === 'total' ? a.paved_km + a.unpaved_km
        : sortCol === 'pct' ? (a.paved_km / Math.max(a.paved_km + a.unpaved_km, 1)) : (a as any)[sortCol];
      const bv = sortCol === 'region' ? b.region : sortCol === 'total' ? b.paved_km + b.unpaved_km
        : sortCol === 'pct' ? (b.paved_km / Math.max(b.paved_km + b.unpaved_km, 1)) : (b as any)[sortCol];
      if (typeof av === 'string') return dir * av.localeCompare(bv as string);
      return dir * ((av as number) - (bv as number));
    });
  }, [data, activeRegions, sortCol, sortDir]);

  function TH(col: SortCol, label: string) {
    const active = sortCol === col;
    return (
      <th onClick={() => { if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } }}
        style={{
          padding: '8px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: active ? C.cyan : 'rgba(148,163,184,0.5)',
          textAlign: col === 'region' ? 'left' : 'right', cursor: 'pointer',
          userSelect: 'none', whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: active ? `rgba(${hexRgb(C.cyan)},0.05)` : 'transparent',
        }}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  if (error) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Network story data unavailable.</div>;
  if (!data) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ padding: '4px 4px 20px' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ALL_REGIONS.map(r => (
          <button key={r} onClick={() => toggleRegion(r)} style={{
            fontSize: 9.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid rgba(${hexRgb(REGION_COLORS[r])},${activeRegions.includes(r) ? 0.5 : 0.15})`,
            background: activeRegions.includes(r) ? `rgba(${hexRgb(REGION_COLORS[r])},0.15)` : 'transparent',
            color: activeRegions.includes(r) ? REGION_COLORS[r] : 'rgba(148,163,184,0.5)',
          }}>{r}</button>
        ))}
      </div>

      <Section title="Worst Performing Road Links · Real Survey Data 2024/25" accent={C.pink}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                {['#', 'Road Link', 'Region', 'Station', 'VCI', 'Length (km)'].map(h => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: h === '#' || h === 'VCI' || h === 'Length (km)' ? 'center' : 'left',
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
                    color: 'rgba(148,163,184,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORST_LINKS.filter(l => activeRegions.includes(l.region)).map((l, i) => {
                const vciColor = l.vci < 50 ? C.pink : l.vci < 60 ? C.orange : C.yellow;
                return (
                  <tr key={l.link}
                    style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', cursor: 'pointer' }}
                    onClick={() => toggleRegion(l.region)}>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(100,116,139,0.5)', fontSize: 9 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', color: '#e2eaf4', fontWeight: 600 }}>{l.link}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700,
                        background: `rgba(${hexRgb(REGION_COLORS[l.region] ?? C.blue)},0.12)`,
                        color: REGION_COLORS[l.region] ?? C.blue,
                      }}>{l.region}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(148,163,184,0.65)' }}>{l.station}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 5, fontWeight: 800, fontSize: 11,
                        background: `rgba(${hexRgb(vciColor)},0.15)`,
                        border: `1px solid rgba(${hexRgb(vciColor)},0.3)`,
                        color: vciColor,
                        boxShadow: `0 0 8px rgba(${hexRgb(vciColor)},0.25)`,
                      }}>{l.vci.toFixed(1)}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(148,163,184,0.6)' }}>{l.km.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Regional Road Statistics · Sortable" accent={C.blue}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {TH('region', 'Region')}
                {TH('paved_km', 'Paved km')}
                {TH('unpaved_km', 'Unpaved km')}
                {TH('total', 'Total km')}
                {TH('pct', 'Paved %')}
                {TH('links', 'Links')}
              </tr>
            </thead>
            <tbody>
              {sortedRegions.map(r => {
                const total = r.paved_km + r.unpaved_km;
                const pct = total > 0 ? (r.paved_km / total) * 100 : 0;
                const rc = REGION_COLORS[r.region] ?? C.blue;
                const isHov = hovRow === r.region;
                return (
                  <tr key={r.region}
                    onMouseEnter={() => setHovRow(r.region)}
                    onMouseLeave={() => setHovRow(null)}
                    onClick={() => toggleRegion(r.region)}
                    style={{
                      background: isHov ? `rgba(${hexRgb(rc)},0.07)` : 'transparent',
                      transition: 'background 0.15s', cursor: 'pointer',
                    }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700, color: isHov ? rc : '#e2eaf4', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: rc, marginRight: 8 }} />
                      {r.region}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: C.green, fontWeight: 600 }}>
                      {r.paved_km.toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'rgba(148,163,184,0.55)' }}>
                      {r.unpaved_km.toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: '#e2eaf4' }}>
                      {total.toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
                        <span style={{ color: rc, fontWeight: 700, fontSize: 10, minWidth: 38, textAlign: 'right' }}>
                          {pct.toFixed(1)}%
                        </span>
                        <div style={{ width: 64, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`,
                            background: `linear-gradient(90deg, ${rc}, rgba(${hexRgb(rc)},0.45))`,
                            borderRadius: 3, transition: 'width 0.3s',
                            boxShadow: `0 0 6px rgba(${hexRgb(rc)},0.5)`,
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: C.yellow }}>
                      {r.links.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(100,116,139,0.45)' }}>
            Click row, column header, or a region pill to sort/filter · Coloured dot = maintenance region colour
          </div>
        </div>
      </Section>
    </div>
  );
}
