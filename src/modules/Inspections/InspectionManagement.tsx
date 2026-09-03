import { useState, useMemo } from 'react';
import { Plus, Search, ClipboardCheck, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Inspection, InspectionType } from '../../index';
import { conditionColor, conditionLabel, conditionBadge, formatDate, INSPECTORS } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

// Vivid platform palette (rule: reuse these, never invent muted colours).
const NEON = { green: '#00ff88', amber: '#ffd23f', orange: '#ff6b35', red: '#ff3366', purple: '#b967ff' };

// Equivalent of the plain .bms-select CSS class, as inline style -
// SearchableSelect takes `style`, not `className`.
const bmsSelectStyle = {
  appearance: 'none' as const, cursor: 'pointer', background: 'rgba(6,13,24,0.8)',
  border: '1px solid rgba(0,245,255,0.12)', borderRadius: 8, padding: '8px 12px',
  fontSize: 13, color: '#e2eaf4', outline: 'none', width: '100%',
};

export default function InspectionManagement() {
  const { state, dispatch } = useBMS();
  const { inspections, structures } = state;

  const [query,       setQuery]       = useState('');
  const [typeFilter,  setTypeFilter]  = useState<'all' | InspectionType>('all');
  const [showForm,    setShowForm]    = useState(false);

  const filtered = useMemo(() => {
    let list = [...inspections].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
    if (typeFilter !== 'all') list = list.filter(i => i.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        i.structureName.toLowerCase().includes(q) ||
        i.inspector.toLowerCase().includes(q) ||
        i.structureId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [inspections, query, typeFilter]);

  const columns: STColumn<Inspection>[] = useMemo(() => [
    { key: 'structureName', label: 'Structure', render: i => (
        <div>
          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{i.structureName}</div>
          <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.6)' }}>{i.structureId}</div>
        </div>
      ) },
    { key: 'date', label: 'Date', date: true, render: i => formatDate(i.date) },
    // Inspector shows the anonymised inspector code (e.g. INS-004), never a real name -
    // do not swap this for identity detail (platform-wide rule).
    { key: 'inspector', label: 'Inspector' },
    { key: 'type', label: 'Inspection Type', render: i => (
        <span className={`badge text-[10px] ${
          i.type === 'Emergency' ? 'badge-critical' :
          i.type === 'Special'   ? 'badge-fair' :
          i.type === 'Principal' ? 'badge-blue' : 'badge-slate'
        }`}>{i.type}</span>
      ) },
    { key: 'deckRating', label: 'Deck', numeric: true, render: i => <RatingDot v={i.deckRating} /> },
    { key: 'superstructureRating', label: 'Superstructure', numeric: true, render: i => <RatingDot v={i.superstructureRating} /> },
    { key: 'substructureRating', label: 'Substructure', numeric: true, render: i => <RatingDot v={i.substructureRating} /> },
    { key: 'channelRating', label: 'Channel', numeric: true, render: i => <RatingDot v={i.channelRating} /> },
    { key: 'visualScore', label: 'Visual Score', numeric: true, render: i => (
        <div className="flex items-center gap-2 justify-end">
          <div className="flex-1 bg-slate-700 rounded-full h-1.5 min-w-[40px]">
            <div className="rounded-full h-1.5" style={{ width: `${i.visualScore}%`, background: conditionColor(i.overallCondition) }} />
          </div>
          <span className="text-[10px] text-slate-400 w-7 text-right">{i.visualScore}</span>
        </div>
      ) },
    { key: 'overallCondition', label: 'Overall Condition', render: i => (
        <span className={`badge ${conditionBadge(i.overallCondition)}`}>
          {i.overallCondition} – {conditionLabel(i.overallCondition)}
        </span>
      ) },
    { key: 'nextInspection', label: 'Next Due', date: true, render: i => formatDate(i.nextInspection) },
    { key: 'photos', label: 'Photos', numeric: true, render: i => (
        <span className="inline-flex items-center gap-1 justify-end text-slate-400">
          <Camera size={12} /> {i.photos.length}
        </span>
      ) },
    { key: 'defects', label: 'Defects Recorded', render: i => i.defects.length === 0 ? (
        <span style={{ color: 'rgba(148,163,184,0.45)' }}>No defects recorded</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {i.defects.map(d => <span key={d} className="badge badge-critical text-[9px]">{d}</span>)}
        </div>
      ) },
    { key: 'findings', label: 'Findings', render: i => (
        <span title={i.findings} style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
          {i.findings || <span style={{ color: 'rgba(148,163,184,0.45)' }}>No findings recorded</span>}
        </span>
      ) },
    { key: 'recommendations', label: 'Recommendations', render: i => (
        <span title={i.recommendations} style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
          {i.recommendations || <span style={{ color: 'rgba(148,163,184,0.45)' }}>No recommendations recorded</span>}
        </span>
      ) },
  ], []);

  // Upcoming due
  const upcomingDue = useMemo(() =>
    structures.filter(s => s.inspectionDue)
      .sort((a, b) => new Date(a.nextInspection).getTime() - new Date(b.nextInspection).getTime())
      .slice(0, 8),
    [structures],
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* ─── Definition card ─── */}
      <div style={{ background:'rgba(185,103,255,0.04)', border:'1px solid rgba(185,103,255,0.14)', borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <span style={{ fontSize:26 }}>🔍</span>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Inspection Management</div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>MoWT Bridge & Road Inspections · NBI Protocol</div>
          </div>
        </div>
        <p style={{ fontSize:11, color:'rgba(148,163,184,0.72)', lineHeight:1.6, margin:0 }}>
          Structured field inspection records for Uganda's road and bridge network - managing visual condition surveys, NBI bridge inspections, structural assessments, defect recording, inspector assignments, and compliance tracking against MoWT annual inspection schedules.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
          {['MoWT Standards','NBI Protocol','UNRA Bridges','Visual Survey','Annual Schedule','Field Data'].map((b: string)=>(
            <span key={b} style={{ fontSize:9, fontWeight:700, color:'#b967ff', background:'rgba(185,103,255,0.07)', border:'1px solid rgba(185,103,255,0.18)', borderRadius:20, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{b}</span>
          ))}
        </div>
      </div>
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Search by structure, inspector…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <SearchableSelect value={typeFilter} onChange={v => setTypeFilter(v as typeof typeFilter)}
            style={{ appearance: 'none', cursor: 'pointer', background: 'rgba(6,13,24,0.8)',
              border: '1px solid rgba(0,245,255,0.12)', borderRadius: 8, padding: '6px 12px',
              fontSize: 12, color: '#e2eaf4', outline: 'none' }}>
            <option value="all">All Types</option>
            <option value="Routine">Routine</option>
            <option value="Principal">Principal</option>
            <option value="Special">Special</option>
            <option value="Emergency">Emergency</option>
          </SearchableSelect>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} inspections</span>
          <button onClick={() => setShowForm(true)} className="bms-btn-primary text-xs py-1.5">
            <Plus size={13} /> Log Inspection
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main table */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <SortableFilterableTable
            columns={columns}
            rows={filtered}
            accent={NEON.purple}
            exportName="inspection-log"
            initialSort="date"
          />
        </div>

        {/* Right panel: upcoming due */}
        <div className="w-72 border-l border-slate-700/60 bg-slate-900/30 flex-shrink-0 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Inspections Due</span>
          </div>
          <div className="space-y-2">
            {upcomingDue.map(s => (
              <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-200 truncate">{s.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.road}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`badge ${conditionBadge(s.conditionRating)} text-[9px]`}>
                    {conditionLabel(s.conditionRating)}
                  </span>
                  <span className="text-[10px] text-red-400 font-semibold">{formatDate(s.nextInspection)}</span>
                </div>
              </div>
            ))}
            {upcomingDue.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 size={14} />
                All inspections current
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Inspection Form */}
      {showForm && (
        <InspectionForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          onSave={(insp) => {
            dispatch({ type: 'ADD_INSPECTION', payload: insp });
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function RatingDot({ v }: { v: number }) {
  // NBI 0-9 component rating, coloured on the platform's vivid palette.
  const color = v >= 7 ? NEON.green : v >= 5 ? NEON.amber : v >= 3 ? NEON.orange : NEON.red;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
      style={{ background: color + '22', color }}>
      {v}
    </span>
  );
}

// ─── Log Form ─────────────────────────────────────────────────────────────────
function InspectionForm({
  structures, onSave, onClose,
}: {
  structures: { id: string; name: string }[];
  onSave: (i: Inspection) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    structureId:          structures[0]?.id ?? '',
    date:                 new Date().toISOString().split('T')[0],
    inspector:            INSPECTORS[0],
    type:                 'Routine' as InspectionType,
    deckRating:           7,
    superstructureRating: 7,
    substructureRating:   7,
    channelRating:        7,
    overallCondition:     4,
    visualScore:          75,
    findings:             '',
    recommendations:      '',
    nextInspection:       '',
  });

  function set(key: string, value: string | number) {
    setF(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    const struct = structures.find(s => s.id === f.structureId);
    const insp: Inspection = {
      id:                   uuidv4(),
      structureId:          f.structureId,
      structureName:        struct?.name ?? f.structureId,
      date:                 f.date,
      inspector:            f.inspector,
      type:                 f.type,
      deckRating:           Number(f.deckRating),
      superstructureRating: Number(f.superstructureRating),
      substructureRating:   Number(f.substructureRating),
      channelRating:        Number(f.channelRating),
      overallCondition:     Number(f.overallCondition) as 1|2|3|4|5,
      visualScore:          Number(f.visualScore),
      findings:             f.findings,
      defects:              [],
      recommendations:      f.recommendations,
      photos:               [],
      nextInspection:       f.nextInspection || new Date(new Date(f.date).setMonth(new Date(f.date).getMonth() + 24)).toISOString().split('T')[0],
      completedAt:          new Date().toISOString(),
    };
    onSave(insp);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-400" />
            <span className="font-bold text-white">Log New Inspection</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto max-h-[70vh]">
          <div className="col-span-2">
            <label className="bms-label">Structure</label>
            <SearchableSelect value={f.structureId} onChange={v => set('structureId', v)} style={bmsSelectStyle}>
              {structures.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </SearchableSelect>
          </div>
          <FormField label="Date" type="date" value={f.date} onChange={v => set('date', v)} />
          <div>
            <label className="bms-label">Inspector</label>
            <SearchableSelect value={f.inspector} onChange={v => set('inspector', v)} style={bmsSelectStyle}>
              {INSPECTORS.map(i => <option key={i} value={i}>{i}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label className="bms-label">Inspection Type</label>
            <SearchableSelect value={f.type} onChange={v => set('type', v)} style={bmsSelectStyle}>
              {['Routine', 'Principal', 'Special', 'Emergency'].map(t => <option key={t} value={t}>{t}</option>)}
            </SearchableSelect>
          </div>
          <FormField label="Overall Condition (1-5)" type="number" value={f.overallCondition} onChange={v => set('overallCondition', v)} min={1} max={5} />
          <FormField label="Deck Rating (NBI 0-9)"          type="number" value={f.deckRating}           onChange={v => set('deckRating', v)} min={0} max={9} />
          <FormField label="Superstructure Rating (0-9)"    type="number" value={f.superstructureRating} onChange={v => set('superstructureRating', v)} min={0} max={9} />
          <FormField label="Substructure Rating (0-9)"      type="number" value={f.substructureRating}   onChange={v => set('substructureRating', v)} min={0} max={9} />
          <FormField label="Channel Rating (0-9)"           type="number" value={f.channelRating}        onChange={v => set('channelRating', v)} min={0} max={9} />
          <FormField label="Visual Score (0-100)"           type="number" value={f.visualScore}          onChange={v => set('visualScore', v)} min={0} max={100} />
          <FormField label="Next Inspection Date"           type="date"   value={f.nextInspection}       onChange={v => set('nextInspection', v)} />
          <div className="col-span-2">
            <label className="bms-label">Findings</label>
            <textarea className="bms-input h-24 resize-none" value={f.findings} onChange={e => set('findings', e.target.value)} placeholder="Describe observations…" />
          </div>
          <div className="col-span-2">
            <label className="bms-label">Recommendations</label>
            <textarea className="bms-input h-20 resize-none" value={f.recommendations} onChange={e => set('recommendations', e.target.value)} placeholder="Actions required…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="bms-btn-secondary">Cancel</button>
          <button onClick={save} className="bms-btn-primary">
            <CheckCircle2 size={14} /> Save Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, type, value, onChange, min, max,
}: {
  label: string; type: string; value: string | number;
  onChange: (v: string) => void;
  min?: number; max?: number;
}) {
  return (
    <div>
      <label className="bms-label">{label}</label>
      <input
        className="bms-input"
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
