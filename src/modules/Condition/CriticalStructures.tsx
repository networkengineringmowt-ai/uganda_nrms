/**
 * CriticalStructures - BMS → Inventory & Condition → Critical Structures.
 * All structures rated Critical (1) or Poor (2), ranked by priority score.
 * Bridges and major culverts are always reported as separate tables
 * (platform standing rule) - never merged into one combined list.
 */
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

const RATING_LABEL: Record<number, string> = {
  1: 'Critical', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent',
};
const RATING_COLOR: Record<number, string> = {
  1: '#ff3366', 2: '#ff6b35', 3: '#ffd23f', 4: '#00f5ff', 5: '#00ff88',
};

interface Row {
  name: string;
  road: string;
  region: string;
  rating: number;
  ratingLabel: string;
  priorityScore: number;
  priorityRank: number;
  spanLength: number;
  lastInspection: string;
  replacementCostBnUgx: number;
}

const COLUMNS: STColumn<Row>[] = [
  { key: 'name',   label: 'Structure', comment: 'Structure name from the BMS registry.' },
  { key: 'road',   label: 'Road',      comment: 'Road the structure carries (national network).' },
  { key: 'region', label: 'Region' },
  { key: 'ratingLabel', label: 'Condition',
    comment: 'BMS condition rating: 1 Critical · 2 Poor · 3 Fair · 4 Good · 5 Excellent. This view shows only 1–2.',
    render: r => (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 800, color: RATING_COLOR[r.rating],
      background: `${RATING_COLOR[r.rating]}1f`, border: `1px solid ${RATING_COLOR[r.rating]}55` }}>
      {r.ratingLabel}
    </span>
  ) },
  { key: 'priorityScore', label: 'Priority', numeric: true, total: 'avg',
    comment: 'Priority score 0–100, computed from condition, traffic level and strategic importance. Higher = more urgent.' },
  { key: 'priorityRank',  label: 'Rank',     numeric: true,
    comment: 'Network-wide priority rank (1 = most urgent).' },
  { key: 'spanLength',    label: 'Span (m)', numeric: true, total: 'sum',
    comment: 'Total span length in metres.' },
  { key: 'lastInspection', label: 'Last Inspection',
    comment: 'Date of most recent field inspection (ISO).' },
  { key: 'replacementCostBnUgx', label: 'Repl. Cost (Bn UGX)', numeric: true, total: 'sum',
    comment: 'Estimated full replacement cost in billions of UGX - SUM gives the total exposure of the critical backlog.' },
];

function toRow(s: { name: string; road: string; region: string; conditionRating: number;
  priorityScore: number; priorityRank: number; spanLength: number; lastInspection: string;
  estimatedReplacementCost: number }): Row {
  return {
    name: s.name,
    road: s.road,
    region: s.region,
    rating: s.conditionRating,
    ratingLabel: RATING_LABEL[s.conditionRating] ?? String(s.conditionRating),
    priorityScore: Math.round(s.priorityScore),
    priorityRank: s.priorityRank,
    spanLength: s.spanLength,
    lastInspection: (s.lastInspection || '').slice(0, 10),
    replacementCostBnUgx: +(s.estimatedReplacementCost / 1e9).toFixed(2),
  };
}

function CriticalTable({ title, accent, rows }: { title: string; accent: string; rows: Row[] }) {
  const criticalCount = rows.filter(r => r.rating === 1).length;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: accent }} />
        <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4' }}>Critical {title}</div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 14 }}>
        {criticalCount} critical · {rows.length - criticalCount} poor - all {title.toLowerCase()} rated
        Critical or Poor, sorted by priority. Click headers to sort, filter, or export.
      </div>
      <SortableFilterableTable
        columns={COLUMNS}
        rows={rows}
        accent={accent}
        exportName={`critical-${title.toLowerCase().replace(/\s+/g, '-')}`}
        initialSort="priorityRank"
      />
    </div>
  );
}

export default function CriticalStructures() {
  const { state } = useBMS();

  const criticalBridges = useMemo<Row[]>(() =>
    state.structures.filter(s => s.conditionRating <= 2 && s.type === 'bridge').map(toRow),
    [state.structures]);
  const criticalCulverts = useMemo<Row[]>(() =>
    state.structures.filter(s => s.conditionRating <= 2 && s.type === 'culvert').map(toRow),
    [state.structures]);

  return (
    <div style={{ padding: '12px 12px' }}>
      <CriticalTable title="Bridges" accent="#ff3366" rows={criticalBridges} />
      <CriticalTable title="Major Culverts" accent="#b967ff" rows={criticalCulverts} />
    </div>
  );
}
