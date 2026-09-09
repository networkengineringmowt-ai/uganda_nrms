import { useState, useMemo, type CSSProperties } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Structure } from '../../index';
import { conditionLabel, conditionColor, conditionBadge, formatDate, formatUGX } from '../../utils/helpers';
import { downloadGeoJSON, downloadKML } from '../../utils/downloads';
import StructureDetailModal from './StructureDetailModal';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

// Equivalent of the .bms-select CSS class (text-xs py-1.5), as an inline
// style object - SearchableSelect takes `style`, not `className`.
const filterSelectStyle: CSSProperties = {
  appearance: 'none', cursor: 'pointer', background: 'rgba(6,13,24,0.8)',
  border: '1px solid rgba(0, 245, 255,0.12)', borderRadius: 8, padding: '6px 12px',
  fontSize: 12, color: '#e2eaf4', outline: 'none',
};

export default function StructureRegistry() {
  const { state } = useBMS();
  const { structures } = state;

  const [query,     setQuery]     = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bridge' | 'culvert'>('all');
  const [condFilter, setCondFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [regionFilter, setRegion]  = useState('all');
  const [selected,  setSelected]  = useState<Structure | null>(null);

  const regions = useMemo(() => {
    const r = new Set(structures.map(s => s.region).filter(Boolean));
    return ['all', ...Array.from(r).sort()];
  }, [structures]);

  const filtered = useMemo(() => {
    let list = structures;
    if (typeFilter !== 'all') list = list.filter(s => s.type === typeFilter);
    if (condFilter !== 'all') list = list.filter(s => String(s.conditionRating) === condFilter);
    if (regionFilter !== 'all') list = list.filter(s => s.region === regionFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.road.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.river.toLowerCase().includes(q),
      );
    }
    return list;
  }, [structures, query, typeFilter, condFilter, regionFilter]);

  function exportCSV() {
    const rows = [
      ['ID','Name','Type','Road','Region','Chainage(km)','Lat','Lng','Span(m)','Spans','Lanes','Width(m)',
       'Material','Year Built','Condition','Last Inspection','Next Inspection','Traffic','Priority Score','Priority Rank',
       'Est. Replacement Cost (UGX)'].join(','),
      ...filtered.map(s => [
        s.id, `"${s.name}"`, s.type, `"${s.road}"`, s.region, s.chainage,
        s.lat, s.lng, s.spanLength, s.noOfSpans, s.noOfLanes, s.width,
        `"${s.material}"`, s.yearBuilt, conditionLabel(s.conditionRating),
        s.lastInspection, s.nextInspection, s.traffic, s.priorityScore, s.priorityRank,
        s.estimatedReplacementCost,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'DNR_Structures_Registry.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: STColumn<Structure>[] = useMemo(() => [
    { key: 'priorityRank',    label: 'Rank', numeric: true, render: (s) => `#${s.priorityRank}` },
    { key: 'id',              label: 'ID' },
    { key: 'name',            label: 'Name' },
    { key: 'type',            label: 'Type', render: (s) => (
        <span className={`badge ${s.type === 'bridge' ? 'badge-blue' : 'badge-purple'}`}>
          {s.type === 'bridge' ? 'Bridge' : 'Culvert'}
        </span>
      ) },
    { key: 'road',            label: 'Road' },
    { key: 'region',          label: 'Region' },
    { key: 'chainage',        label: 'Chainage (km)', numeric: true, render: (s) => s.chainage.toFixed(1) },
    { key: 'spanLength',      label: 'Span (m)', numeric: true, render: (s) => `${s.spanLength} m` },
    { key: 'noOfSpans',       label: 'Spans', numeric: true },
    { key: 'noOfLanes',       label: 'Lanes', numeric: true },
    { key: 'material',        label: 'Material' },
    { key: 'yearBuilt',       label: 'Year Built', numeric: true },
    { key: 'conditionRating', label: 'Condition', render: (s) => (
        <span className={`badge ${conditionBadge(s.conditionRating)}`}>
          {s.conditionRating} – {conditionLabel(s.conditionRating)}
        </span>
      ) },
    { key: 'lastInspection',  label: 'Last Inspection', date: true, render: (s) => formatDate(s.lastInspection) },
    { key: 'nextInspection',  label: 'Next Inspection', date: true, render: (s) => (
        <span className={s.inspectionDue ? 'text-red-400 font-semibold' : 'text-slate-400'}>
          {formatDate(s.nextInspection)}
        </span>
      ) },
    { key: 'traffic',         label: 'Traffic Level', render: (s) => (
        <span className={`badge ${
          s.traffic === 'Very High' ? 'badge-critical' :
          s.traffic === 'High' ? 'badge-poor' :
          s.traffic === 'Medium' ? 'badge-fair' : 'badge-good'
        }`}>{s.traffic}</span>
      ) },
    { key: 'priorityScore',   label: 'Priority Score', numeric: true, render: (s) => (
        <div className="flex items-center gap-2 justify-end">
          <div className="flex-1 bg-slate-700 rounded-full h-1.5 min-w-[40px]">
            <div className="rounded-full h-1.5 transition-all"
              style={{ width: `${s.priorityScore}%`, background: conditionColor(s.conditionRating) }} />
          </div>
          <span className="text-xs text-slate-400 font-mono w-6 text-right">{s.priorityScore}</span>
        </div>
      ) },
    { key: 'notes', label: 'Details', render: (s) => (
        <button
          onClick={e => { e.stopPropagation(); setSelected(s); }}
          className="p-1.5 rounded-md bg-slate-700 hover:bg-blue-600/30 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <Eye size={13} />
        </button>
      ) },
  ], []);

  return (
    <div className="flex flex-col h-full animate-fade-in">

        <div style={{background:'rgba(6,182,212,0.04)',border:'1px solid rgba(6,182,212,0.14)',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:15,fontWeight:800,color:'rgba(6,182,212,1)',letterSpacing:-0.3}}>Structure Registry</span>
          <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>MoWT · Bridge Inventory · NBI · Culverts</span>
        </div>
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Name, ID, road, region…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            <Filter size={13} className="text-slate-500" />
            <SearchableSelect value={typeFilter} onChange={v => setTypeFilter(v as typeof typeFilter)} style={filterSelectStyle}>
              <option value="all">All Types</option>
              <option value="bridge">Bridges</option>
              <option value="culvert">Culverts</option>
            </SearchableSelect>
          </div>
          <SearchableSelect value={condFilter} onChange={v => setCondFilter(v as typeof condFilter)} style={filterSelectStyle}>
            <option value="all">All Conditions</option>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Fair</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Critical</option>
          </SearchableSelect>
          <SearchableSelect value={regionFilter} onChange={setRegion} style={filterSelectStyle}>
            {regions.map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
            ))}
          </SearchableSelect>

          {/* Spacer + count + export */}
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} structures</span>
          <button onClick={exportCSV} className="bms-btn-secondary text-xs py-1.5">
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => downloadGeoJSON(filtered, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.geojson`)}
            className="bms-btn-secondary text-xs py-1.5"
          >
            <Download size={13} /> GeoJSON
          </button>
          <button
            onClick={() => downloadKML(filtered, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.kml`)}
            className="bms-btn-secondary text-xs py-1.5"
          >
            <Download size={13} /> KML
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <SortableFilterableTable
          columns={columns}
          rows={filtered}
          accent="#00f5ff"
          exportName="structure-registry"
          initialSort="priorityRank"
        />
      </div>

      {/* Detail modal */}
      {selected && <StructureDetailModal structure={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
