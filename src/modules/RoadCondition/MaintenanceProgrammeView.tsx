import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, PieChart, Pie,
} from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Wrench, Filter, Download } from 'lucide-react';
import { useVirtualRows } from '../../shared/useVirtualRows';
import { RoadClassPill, ConditionLabelBadge, criticalRowStyle, NullableCell } from '../../shared/tableFormatting';
import { useSortableColumns, sortRows, SortArrow, type ColumnType } from '../../shared/useSortableColumns';

const ROW_HEIGHT = 40;
const COLUMN_COUNT = 8;

type LinkSortKey = 'priority_rank' | 'road_name' | 'road_class' | 'current_iri' |
  'condition_now' | 'intervention_type' | 'length_km' | 'estimated_cost_usd';
const LINK_SORT_TYPES: Partial<Record<LinkSortKey, ColumnType>> = {
  priority_rank: 'numeric', current_iri: 'numeric', length_km: 'numeric', estimated_cost_usd: 'numeric',
};

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  red: '#ff3366', teal: '#00d4aa',
};

interface MaintenanceProgramme {
  generated_at: string;
  network_summary: {
    total_links: number;
    links_with_romdas_data: number;
    maintenance_events: number;
    condition_distribution: Record<string, number>;
    total_programme_cost_usd: number;
    total_programme_cost_millions: number;
  };
  annual_budget: Record<string, { budget_usd: number; budget_usd_millions: number }>;
  intervention_types: Record<string, {
    count: number;
    total_km: number;
    unit_cost_usd: number;
    total_cost_usd: number;
  }>;
  top_priority_links: PriorityLink[];
  all_links: PriorityLink[];
}

interface PriorityLink {
  link_id: string;
  road_name: string;
  road_class: string;
  current_iri: number;
  condition_now: string;
  deterioration_rate: number;
  intervention_year: number;
  intervention_type: string;
  length_km: number;
  estimated_cost_usd: number;
  priority_score: number;
  condition_3yr: string;
  data_source: string;
  maintenance_detected: boolean;
  priority_rank?: number;
}

export default function MaintenanceProgrammeView() {
  const [data, setData] = useState<MaintenanceProgramme | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterIntervention, setFilterIntervention] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'cost' | 'iri'>('priority');

  useEffect(() => {
    fetch('/data/maintenance_programme.json')
      .then(r => r.json())
      .then(d => {
        // Add priority_rank to all_links
        const withRank = d.all_links?.map((l: PriorityLink, i: number) => ({
          ...l,
          priority_rank: i + 1,
        })) || [];
        setData({ ...d, all_links: withRank });
      })
      .catch(err => console.error('Failed to load maintenance_programme.json:', err));
  }, []);

  const budgetData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.annual_budget)
      .map(([year, b]) => ({
        year,
        budget: Math.round(b.budget_usd_millions),
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [data]);

  const interventionData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.intervention_types)
      .map(([type, info]) => ({
        name: type,
        count: info.count,
        cost: Math.round(info.total_cost_usd / 1e6),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [data]);

  const conditionData = useMemo(() => {
    if (!data?.network_summary.condition_distribution) return [];
    return Object.entries(data.network_summary.condition_distribution)
      .map(([cond, count]) => ({
        name: cond,
        value: count,
        color: cond === 'Very Poor' ? C.red : cond === 'Poor' ? C.orange : cond === 'Fair' ? C.yellow : C.green,
      }));
  }, [data]);

  const filteredAndSorted = useMemo(() => {
    if (!data?.all_links) return [];
    let filtered = data.all_links;

    if (filterClass !== 'all') {
      filtered = filtered.filter(l => l.road_class === filterClass);
    }
    if (filterIntervention !== 'all') {
      filtered = filtered.filter(l => l.intervention_type === filterIntervention);
    }

    const sorted = [...filtered];
    if (sortBy === 'priority') {
      sorted.sort((a, b) => (a.priority_rank || 999) - (b.priority_rank || 999));
    } else if (sortBy === 'cost') {
      sorted.sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd);
    } else if (sortBy === 'iri') {
      sorted.sort((a, b) => b.current_iri - a.current_iri);
    }

    return sorted;
  }, [data, filterClass, filterIntervention, sortBy]);

  const { sortKey: colSortKey, sortDir: colSortDir, cycleSort } = useSortableColumns<LinkSortKey>();
  const columnSorted = useMemo(
    () => sortRows(filteredAndSorted, colSortKey, colSortDir, colSortKey ? (LINK_SORT_TYPES[colSortKey] ?? 'text') : 'text'),
    [filteredAndSorted, colSortKey, colSortDir],
  );
  const { containerRef, visibleRows: paginated, topSpacerHeight, bottomSpacerHeight } =
    useVirtualRows(columnSorted, { rowHeight: ROW_HEIGHT });

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-slate-500">Loading maintenance programme...</div>
      </div>
    );
  }

  const roadClasses = [...new Set(data.all_links.map(l => l.road_class))].sort();
  const interventionTypes = [...new Set(data.all_links.map(l => l.intervention_type))].sort();

  return (
    <div style={{ padding: '24px 28px', background: 'linear-gradient(to bottom, rgba(15,15,15,0.5), rgba(15,15,15,0))', minHeight: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#e2eaf4', marginBottom: 8 }}>
          PMS Maintenance Programme
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
          Priority-ranked road interventions - {data.network_summary.total_links} links, ${data.network_summary.total_programme_cost_millions.toLocaleString('en-US', { maximumFractionDigits: 1 })}M budget
        </p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(${data.network_summary.total_links > 900 ? '255,51,102' : '0,245,255'},0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Total Links</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#e2eaf4' }}>
            {data.network_summary.total_links.toLocaleString()}
          </div>
        </div>

        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(255,51,102,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Very Poor</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ff3366' }}>
            {data.network_summary.condition_distribution['Very Poor'] || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(255,107,53,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Total Cost</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ff6b35' }}>
            ${data.network_summary.total_programme_cost_millions.toLocaleString('en-US', { maximumFractionDigits: 0 })}M
          </div>
        </div>

        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(0,255,136,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Top Intervention</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff88' }}>
            {Object.entries(data.intervention_types)
              .reduce((max, [type, info]) => info.count > max.count ? { type, count: info.count } : max, { type: '', count: 0 })
              .type || '-'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Annual Budget */}
        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: '1px solid rgba(0,245,255,0.15)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4', marginBottom: 12 }}>Annual Budget Allocation</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="year" stroke="rgba(148,163,184,0.4)" tick={{ fontSize: 10 }} />
              <YAxis stroke="rgba(148,163,184,0.4)" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: `1px solid ${C.cyan}`, borderRadius: 6 }}
                labelStyle={{ color: C.cyan }} formatter={(v) => `$${v}M`} />
              <Bar dataKey="budget" fill={C.cyan} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Condition Distribution */}
        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: '1px solid rgba(185,103,255,0.15)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4', marginBottom: 12 }}>Condition Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={conditionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {conditionData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(185,103,255,0.5)', borderRadius: 6 }}
                labelStyle={{ color: '#b967ff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Interventions */}
      <div style={{
        background: 'rgba(15,15,15,0.7)',
        border: '1px solid rgba(255,107,53,0.15)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 28,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4', marginBottom: 12 }}>Intervention Types by Cost</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={interventionData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis type="number" stroke="rgba(148,163,184,0.4)" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" stroke="rgba(148,163,184,0.4)" tick={{ fontSize: 10 }} width={150} />
            <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,107,53,0.5)', borderRadius: 6 }}
              labelStyle={{ color: C.orange }} formatter={(v) => `$${v}M`} />
            <Bar dataKey="cost" fill={C.orange} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Priority Table */}
      <div style={{
        background: 'rgba(15,15,15,0.7)',
        border: '1px solid rgba(77,159,255,0.15)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4' }}>Priority Links</h3>
            <span className="record-badge">{filteredAndSorted.length.toLocaleString()} links</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); }}
              style={{
                background: 'rgba(15,15,15,0.8)',
                border: `1px solid rgba(77,159,255,0.3)`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#e2eaf4',
              }}>
              <option value="all">All Classes</option>
              {roadClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            <select value={filterIntervention} onChange={(e) => { setFilterIntervention(e.target.value); }}
              style={{
                background: 'rgba(15,15,15,0.8)',
                border: `1px solid rgba(77,159,255,0.3)`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#e2eaf4',
              }}>
              <option value="all">All Interventions</option>
              {interventionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: 'rgba(15,15,15,0.8)',
                border: `1px solid rgba(77,159,255,0.3)`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#e2eaf4',
              }}>
              <option value="priority">Priority Rank</option>
              <option value="cost">Cost</option>
              <option value="iri">IRI</option>
            </select>
          </div>
        </div>

        <div ref={containerRef} className="dt-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(77,159,255,0.2)' }}>
                {([
                  ['Rank', 'priority_rank', 'left'],
                  ['Road', 'road_name', 'left'],
                  ['Class', 'road_class', 'left'],
                  ['Current IRI', 'current_iri', 'center'],
                  ['Condition', 'condition_now', 'left'],
                  ['Intervention', 'intervention_type', 'left'],
                  ['Length (km)', 'length_km', 'center'],
                  ['Cost (USD)', 'estimated_cost_usd', 'right'],
                ] as [string, LinkSortKey, 'left' | 'center' | 'right'][]).map(([label, key, align]) => (
                  <th key={key} className="dt-sticky-th" style={{ padding: '10px 8px', textAlign: align, color: colSortKey === key ? '#ffd23f' : 'rgba(148,163,184,0.7)', fontWeight: 600, background: '#0f0f0f', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => cycleSort(key)}>
                    {label}<SortArrow active={colSortKey === key} dir={colSortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 && (
                <tr aria-hidden style={{ height: topSpacerHeight }}><td colSpan={COLUMN_COUNT} style={{ padding: 0, border: 'none' }} /></tr>
              )}
              {paginated.map((link, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(77,159,255,0.1)', background: idx % 2 ? 'rgba(77,159,255,0.02)' : 'transparent', ...criticalRowStyle(link.condition_now === 'Very Poor') }}>
                  <td style={{ padding: '10px 8px', color: C.cyan, fontWeight: 600 }}>#{link.priority_rank}</td>
                  <td style={{ padding: '10px 8px', color: '#e2eaf4' }}>{link.road_name}</td>
                  <td style={{ padding: '10px 8px' }}><RoadClassPill cls={link.road_class} /></td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', color: link.current_iri > 9 ? C.red : link.current_iri > 6.5 ? C.orange : C.green }}>
                    {link.current_iri.toFixed(1)}
                  </td>
                  <td style={{ padding: '10px 8px' }}><ConditionLabelBadge label={link.condition_now} /></td>
                  <td style={{ padding: '10px 8px', color: 'rgba(148,163,184,0.8)', fontSize: 11 }}>{link.intervention_type}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', color: 'rgba(148,163,184,0.8)' }}>
                    <NullableCell value={link.length_km}>{link.length_km.toFixed(1)}</NullableCell>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.yellow, fontWeight: 600 }}>
                    <NullableCell value={link.estimated_cost_usd}>${(link.estimated_cost_usd / 1e6).toFixed(1)}M</NullableCell>
                  </td>
                </tr>
              ))}
              {bottomSpacerHeight > 0 && (
                <tr aria-hidden style={{ height: bottomSpacerHeight }}><td colSpan={COLUMN_COUNT} style={{ padding: 0, border: 'none' }} /></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
