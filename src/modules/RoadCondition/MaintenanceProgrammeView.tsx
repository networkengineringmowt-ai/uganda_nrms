import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, PieChart, Pie,
} from 'recharts';
import { AlertTriangle, TrendingUp, DollarSign, Wrench, Filter, Download } from 'lucide-react';
import { RoadClassPill, ConditionLabelBadge, criticalRowStyle, NullableCell } from '../../shared/tableFormatting';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

const C = {
  cyan: '#64d2ff', green: '#30d158', yellow: '#ffd60a',
  orange: '#ff9f0a', purple: '#bf5af2', blue: '#0a84ff',
  red: '#ff453a', teal: '#66d4cf',
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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/maintenance_programme.json`)
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

    return [...filtered].sort((a, b) => (a.priority_rank || 999) - (b.priority_rank || 999));
  }, [data, filterClass, filterIntervention]);

  const filteredKm = useMemo(
    () => filteredAndSorted.reduce((s, l) => s + (l.length_km ?? 0), 0),
    [filteredAndSorted],
  );

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
          border: `1px solid rgba(${data.network_summary.total_links > 900 ? '255, 69, 58' : '100, 210, 255'},0.2)`,
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
          border: `1px solid rgba(255, 69, 58,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Very Poor</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ff453a' }}>
            {data.network_summary.condition_distribution['Very Poor'] || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(255, 159, 10,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Total Cost</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ff9f0a' }}>
            ${data.network_summary.total_programme_cost_millions.toLocaleString('en-US', { maximumFractionDigits: 0 })}M
          </div>
        </div>

        <div style={{
          background: 'rgba(15,15,15,0.7)',
          border: `1px solid rgba(48, 209, 88,0.2)`,
          borderRadius: 12,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>Top Intervention</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#30d158' }}>
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
          border: '1px solid rgba(100, 210, 255,0.15)',
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
          border: '1px solid rgba(191, 90, 242,0.15)',
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
              <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(191, 90, 242,0.5)', borderRadius: 6 }}
                labelStyle={{ color: '#bf5af2' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Interventions */}
      <div style={{
        background: 'rgba(15,15,15,0.7)',
        border: '1px solid rgba(255, 159, 10,0.15)',
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
            <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255, 159, 10,0.5)', borderRadius: 6 }}
              labelStyle={{ color: C.orange }} formatter={(v) => `$${v}M`} />
            <Bar dataKey="cost" fill={C.orange} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Priority Table */}
      <div style={{
        background: 'rgba(15,15,15,0.7)',
        border: '1px solid rgba(10, 132, 255,0.15)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4' }}>Priority Links</h3>
            <span className="record-badge">{filteredAndSorted.length.toLocaleString()} links</span>
            <span className="record-badge">{filteredKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <SearchableSelect value={filterClass} onChange={setFilterClass}
              style={{
                background: 'rgba(15,15,15,0.8)',
                border: `1px solid rgba(10, 132, 255,0.3)`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#e2eaf4',
              }}>
              <option value="all">All Classes</option>
              {roadClasses.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </SearchableSelect>

            <SearchableSelect value={filterIntervention} onChange={setFilterIntervention}
              style={{
                background: 'rgba(15,15,15,0.8)',
                border: `1px solid rgba(10, 132, 255,0.3)`,
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#e2eaf4',
              }}>
              <option value="all">All Interventions</option>
              {interventionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </SearchableSelect>
          </div>
        </div>

        <SortableFilterableTable<PriorityLink>
          accent={C.blue}
          exportName="priority-links"
          initialSort="priority_rank"
          rowStyle={link => criticalRowStyle(link.condition_now === 'Very Poor')}
          columns={[
            { key: 'priority_rank', label: 'Rank', numeric: true, render: link => `#${link.priority_rank}` },
            { key: 'road_name', label: 'Road' },
            { key: 'road_class', label: 'Class', render: link => <RoadClassPill cls={link.road_class} /> },
            { key: 'current_iri', label: 'Current IRI', numeric: true, render: link => (
                <span style={{ color: link.current_iri > 9 ? C.red : link.current_iri > 6.5 ? C.orange : C.green, fontWeight: 700 }}>
                  {link.current_iri.toFixed(1)}
                </span>
              ) },
            { key: 'condition_now', label: 'Condition', render: link => <ConditionLabelBadge label={link.condition_now} /> },
            { key: 'intervention_type', label: 'Intervention' },
            { key: 'length_km', label: 'Length (km)', numeric: true, total: 'sum',
              render: link => <NullableCell value={link.length_km}>{link.length_km.toFixed(1)}</NullableCell> },
            { key: 'estimated_cost_usd', label: 'Cost (USD)', numeric: true, total: 'sum',
              render: link => <NullableCell value={link.estimated_cost_usd}>${(link.estimated_cost_usd / 1e6).toFixed(1)}M</NullableCell> },
          ] as STColumn<PriorityLink>[]}
          rows={filteredAndSorted}
        />
      </div>
    </div>
  );
}
