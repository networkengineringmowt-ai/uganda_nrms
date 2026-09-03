import { useEffect, useMemo, useState } from 'react';
import { hexRgb } from '../../lib/chart3d';
import {
  C, ALL_REGIONS, REGION_COLORS, WORST_LINKS, WORST_LINKS_COLUMNS, REGION_STAT_COLUMNS,
  type StoryData, type RegionStatRow,
} from './NetworkStory';
import { SortableFilterableTable } from '../../shared/SortableFilterableTable';

// The two data tables that used to live on Network Story's Dashboard tab
// (worst-performing links, regional paved/unpaved breakdown). Moved here so
// this section's Dashboard tab stays table-free like every other section,
// per the platform's no-tables-on-Dashboard rule - Network Story is a
// directly sidebar-reachable section (not a deep-link-only one), so this
// follows the exact same pattern already applied to the platform's other
// table-bearing sections (see SectionDashboard.tsx SECTION_EXTRAS comment).
// Reads the same `network_story_data.json` + `WORST_LINKS` NetworkStory.tsx
// uses, via its own independent fetch/state (kept self-contained rather than
// threading a shared store through both components). Column specs
// (WORST_LINKS_COLUMNS / REGION_STAT_COLUMNS) are imported from NetworkStory.tsx
// so both places render byte-identical sortable, colour-coded tables.

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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}network_story_data.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: StoryData) => setData(d))
      .catch(() => setError(true));
  }, []);

  const toggleRegion = (r: string) => {
    setActiveRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  // Padded with any of the 6 canonical maintenance regions missing from the
  // loaded JSON (explicit zero-data row, not fabricated figures) so this
  // table never silently drops a region - mirrors the same padding NetworkStory.tsx
  // applies to its own copy of this table.
  const regionRows: RegionStatRow[] = useMemo(() => {
    if (!data) return [];
    const present = new Map(data.by_region.map(r => [r.region, r]));
    return ALL_REGIONS
      .map(region => present.get(region) ?? { region, paved_km: 0, unpaved_km: 0, links: 0 })
      .filter(r => activeRegions.includes(r.region))
      .map(r => ({ ...r, total: r.paved_km + r.unpaved_km, pct: (r.paved_km + r.unpaved_km) > 0 ? (r.paved_km / (r.paved_km + r.unpaved_km)) * 100 : 0 }));
  }, [data, activeRegions]);

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
        <SortableFilterableTable
          columns={WORST_LINKS_COLUMNS}
          rows={WORST_LINKS.filter(l => activeRegions.includes(l.region))}
          accent={C.pink}
          exportName="worst_performing_road_links"
          initialSort="vci"
        />
      </Section>

      <Section title="Regional Road Statistics · Sortable" accent={C.blue}>
        <SortableFilterableTable
          columns={REGION_STAT_COLUMNS}
          rows={regionRows}
          accent={C.blue}
          exportName="regional_road_statistics"
          initialSort="paved_km"
        />
        <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(100,116,139,0.45)' }}>
          Click a column header to sort · All 6 maintenance regions shown (zero-data regions included, not dropped) · Coloured dot = maintenance region colour
        </div>
      </Section>
    </div>
  );
}
