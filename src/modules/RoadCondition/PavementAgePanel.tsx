/**
 * PavementAgePanel - age-based reporting for the national network (FY25-26).
 * Source: network_links.json pavement_age (NDPIV FY25-26 master); where the
 * column is blank the age is derived predictively as CURRENT_YEAR minus the
 * most recent of last-intervention / rehabilitation / completion year.
 * Remaining life = design life (20y bituminous, 7y unsealed regravel cycle)
 * minus current age - the same forward-carry principle as the traffic models.
 */
import { useEffect, useMemo, useState } from 'react';
import { CURRENT_YEAR } from '../../shared/year';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill, NullableCell } from '../../shared/tableFormatting';

interface Link {
  link_id: string | null; road_no: string | null; road_class: string | null;
  link_name: string | null; length_km: number | null; surface_type: string | null;
  maintenance_region: string | null; maintenance_station: string | null;
  completion_year: number | string | null; rehab_year: number | string | null;
  last_intervention: number | string | null; pavement_age: number | string | null;
}

const DESIGN_LIFE = { paved: 20, unpaved: 7 };
const BANDS = [
  { label: '0–5 yrs',   min: 0,  max: 5,        color: '#30d158' },
  { label: '6–10 yrs',  min: 6,  max: 10,       color: '#66d4cf' },
  { label: '11–15 yrs', min: 11, max: 15,       color: '#ffd60a' },
  { label: '16–20 yrs', min: 16, max: 20,       color: '#ff9f0a' },
  { label: '>20 yrs',   min: 21, max: Infinity, color: '#ff375f' },
];

const yr = (v: number | string | null): number | null => {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return n != null && Number.isFinite(n) && n > 1900 && n <= CURRENT_YEAR ? n : null;
};
const isPaved = (s: string | null) =>
  !!s && /bitum|sealed|concrete|paved/i.test(s) && !/unsealed|unpaved/i.test(s);

function ageOf(l: Link): { age: number | null; derived: boolean } {
  const direct = typeof l.pavement_age === 'string' ? parseFloat(l.pavement_age) : l.pavement_age;
  if (direct != null && Number.isFinite(direct) && direct >= 0 && direct < 120) {
    return { age: Math.round(direct as number), derived: false };
  }
  const base = Math.max(yr(l.last_intervention) ?? 0, yr(l.rehab_year) ?? 0, yr(l.completion_year) ?? 0);
  return base ? { age: CURRENT_YEAR - base, derived: true } : { age: null, derived: false };
}

export default function PavementAgePanel() {
  const [links, setLinks] = useState<Link[]>([]);
  const [region, setRegion] = useState('all');
  const [surface, setSurface] = useState<'all' | 'paved' | 'unpaved'>('all');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/network_links.json`)
      .then(r => r.json()).then(setLinks).catch(() => setLinks([]));
  }, []);

  const rows = useMemo(() => links.map(l => {
    const { age, derived } = ageOf(l);
    const paved = isPaved(l.surface_type);
    const life = paved ? DESIGN_LIFE.paved : DESIGN_LIFE.unpaved;
    return {
      ...l, age, derived, paved,
      km: l.length_km ?? 0,
      remaining: age != null ? Math.max(0, life - age) : null,
      overLife: age != null && age > life,
    };
  }), [links]);

  const regions = useMemo(() =>
    [...new Set(rows.map(r => r.maintenance_region).filter(Boolean))].sort() as string[], [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (region === 'all' || r.maintenance_region === region) &&
    (surface === 'all' || (surface === 'paved') === r.paved)), [rows, region, surface]);

  const aged = filtered.filter(r => r.age != null);

  const stats = useMemo(() => {
    const kmW = (sel: typeof aged) => {
      const wk = sel.reduce((a, r) => a + r.km, 0);
      return wk ? sel.reduce((a, r) => a + (r.age as number) * r.km, 0) / wk : null;
    };
    const overKm = aged.filter(r => r.overLife).reduce((a, r) => a + r.km, 0);
    const totKm = aged.reduce((a, r) => a + r.km, 0);
    return {
      avg: kmW(aged), avgPaved: kmW(aged.filter(r => r.paved)), avgUnpaved: kmW(aged.filter(r => !r.paved)),
      overKm, totKm, overPct: totKm ? 100 * overKm / totKm : 0,
      coverage: filtered.length ? 100 * aged.length / filtered.length : 0,
      derived: aged.filter(r => r.derived).length,
    };
  }, [aged, filtered]);

  const bands = useMemo(() => BANDS.map(b => {
    const sel = aged.filter(r => (r.age as number) >= b.min && (r.age as number) <= b.max);
    return { ...b, km: sel.reduce((a, r) => a + r.km, 0), links: sel.length };
  }), [aged]);
  const maxBandKm = Math.max(1, ...bands.map(b => b.km));

  // Every maintenance region is always shown, even with zero km under the
  // current filter - a region never silently disappears from the summary.
  const byRegion = useMemo(() => regions.map(rg => {
    const sel = aged.filter(r => r.maintenance_region === rg);
    const km = sel.reduce((a, r) => a + r.km, 0);
    const avg = km ? sel.reduce((a, r) => a + (r.age as number) * r.km, 0) / km : null;
    const over = sel.filter(r => r.overLife).reduce((a, r) => a + r.km, 0);
    return { region: rg, km, avg, overPct: km ? 100 * over / km : 0 };
  }).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)), [aged, regions]);

  const oldest = useMemo(() =>
    [...aged].sort((a, b) => (b.age as number) - (a.age as number)),
    [aged]);

  const CARD: React.CSSProperties = {
    background: 'rgba(8,8,8,0.7)', border: '1px solid rgba(255, 159, 10,0.16)',
    borderRadius: 10, padding: '12px 14px',
  };
  const SEL: React.CSSProperties = {
    background: 'rgba(10,16,30,0.9)', color: '#e2e8f0', border: '1px solid rgba(255, 159, 10,0.3)',
    borderRadius: 7, fontSize: 11, padding: '6px 9px',
  };

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>
            Pavement Age - {CURRENT_YEAR} reporting
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.65)' }}>
            FY25-26 NDPIV master · ages carried forward to {CURRENT_YEAR}; blanks derived from last
            intervention/rehab/completion · design life {DESIGN_LIFE.paved}y bituminous / {DESIGN_LIFE.unpaved}y unsealed
          </div>
        </div>
        <SearchableSelect value={region} onChange={setRegion} style={SEL}>
          <option value="all">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </SearchableSelect>
        <SearchableSelect value={surface} onChange={v => setSurface(v as 'all' | 'paved' | 'unpaved')} style={SEL}>
          <option value="all">All Surfaces</option>
          <option value="paved">Bituminous (Paved)</option>
          <option value="unpaved">Unsealed</option>
        </SearchableSelect>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {([
          ['Network avg age', stats.avg != null ? `${stats.avg.toFixed(1)} yrs` : '-', '#ff9f0a'],
          ['Bituminous avg', stats.avgPaved != null ? `${stats.avgPaved.toFixed(1)} yrs` : '-', '#66d4cf'],
          ['Unsealed avg', stats.avgUnpaved != null ? `${stats.avgUnpaved.toFixed(1)} yrs` : '-', '#ffd60a'],
          ['Beyond design life', `${stats.overPct.toFixed(1)}%`, '#ff375f'],
          ['km beyond life', `${Math.round(stats.overKm).toLocaleString()} km`, '#ff375f'],
          ['Age data coverage', `${stats.coverage.toFixed(0)}%`, '#0a84ff'],
        ] as Array<[string, string, string]>).map(([label, v, color]) => (
          <div key={label} style={CARD}>
            <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.1fr)', gap: 12, marginBottom: 14 }}>
        {/* Age distribution */}
        <div style={CARD}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#e2eaf4', marginBottom: 10 }}>
            Age distribution (km{region !== 'all' ? ` · ${region}` : ''})
          </div>
          {bands.map(b => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span>
                <span style={{ color: 'rgba(148,163,184,0.7)' }}>
                  {Math.round(b.km).toLocaleString()} km · {b.links} links
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: `${100 * b.km / maxBandKm}%`, height: '100%', borderRadius: 5,
                  background: b.color, boxShadow: `0 0 8px ${b.color}66` }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 8 }}>
            {stats.derived} link ages derived predictively from intervention history
          </div>
        </div>

        {/* By region */}
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '11px 12px 7px', fontSize: 11.5, fontWeight: 800, color: '#e2eaf4' }}>
            Km-weighted age by maintenance region
          </div>
          <div style={{ padding: '0 8px 8px' }}>
            <SortableFilterableTable<typeof byRegion[number]>
              accent="#ff9f0a"
              exportName="pavement-age-by-region"
              initialSort="km"
              columns={[
                { key: 'region', label: 'Region' },
                { key: 'km', label: 'Network (km)', numeric: true, total: 'sum',
                  render: r => Math.round(r.km).toLocaleString() },
                { key: 'avg', label: 'Avg Age', numeric: true, render: r => (
                    <NullableCell value={r.avg}>
                      <span style={{ fontWeight: 800,
                        color: (r.avg ?? 0) > 15 ? '#ff375f' : (r.avg ?? 0) > 10 ? '#ffd60a' : '#30d158' }}>
                        {r.avg != null ? `${r.avg.toFixed(1)} yrs` : '-'}
                      </span>
                    </NullableCell>
                  ) },
                { key: 'overPct', label: 'Beyond Design Life', numeric: true, render: r => (
                    <span style={{ color: r.overPct > 30 ? '#ff375f' : 'inherit' }}>{r.overPct.toFixed(1)}%</span>
                  ) },
              ] as STColumn<typeof byRegion[number]>[]}
              rows={byRegion}
            />
          </div>
        </div>
      </div>

      {/* All links with age data */}
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 12px 7px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#e2eaf4', flex: 1 }}>
            All links with age data · {aged.length} links · {Math.round(aged.reduce((a, r) => a + r.km, 0)).toLocaleString()} km · click a column to sort
          </div>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <SortableFilterableTable<typeof oldest[number]>
            accent="#ff9f0a"
            exportName="pavement-age-links"
            initialSort="age"
            columns={[
              { key: 'link_id', label: 'Link' },
              { key: 'link_name', label: 'Name', render: r => r.link_name ?? '-' },
              { key: 'road_class', label: 'Class', render: r => <RoadClassPill cls={r.road_class} /> },
              { key: 'surface_type', label: 'Surface', render: r => r.surface_type ?? '-' },
              { key: 'maintenance_region', label: 'Region', render: r => r.maintenance_region ?? '-' },
              { key: 'km', label: 'Length (km)', numeric: true, total: 'sum', render: r => r.km.toFixed(1) },
              { key: 'age', label: `Age (${CURRENT_YEAR})`, numeric: true, render: r => (
                  <NullableCell value={r.age}>
                    <span style={{ fontWeight: 800, color: r.overLife ? '#ff375f' : '#ffd60a' }}>
                      {r.age} yrs{r.derived ? ' *' : ''}
                    </span>
                  </NullableCell>
                ) },
              { key: 'remaining', label: 'Remaining Life', numeric: true, render: r => (
                  <NullableCell value={r.remaining}>
                    <span style={{ color: r.remaining === 0 ? '#ff375f' : '#66d4cf' }}>
                      {r.remaining === 0 ? 'Exceeded' : `${r.remaining} yrs`}
                    </span>
                  </NullableCell>
                ) },
              { key: 'last_intervention', label: 'Last Intervention', numeric: true,
                render: r => yr(r.last_intervention) ?? yr(r.rehab_year) ?? yr(r.completion_year) ?? '-' },
            ] as STColumn<typeof oldest[number]>[]}
            rows={oldest}
          />
        </div>
        <div style={{ padding: '7px 12px', fontSize: 9, color: 'rgba(100,116,139,0.6)' }}>
          * age derived from intervention history · remaining life = design life − current age (floored at 0)
        </div>
      </div>
    </div>
  );
}
