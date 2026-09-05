import { useState, useMemo } from 'react';
import { Plus, Search, Wrench, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { WorkOrder, WorkOrderStatus, WorkOrderType, WorkOrderPriority } from '../../index';
import { formatDate, formatUGX } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  'Planned':     'badge-blue',
  'In Progress': 'badge-fair',
  'Completed':   'badge-excellent',
  'On Hold':     'badge-slate',
  'Cancelled':   'badge-critical',
};

const STATUS_ICONS: Record<WorkOrderStatus, React.ReactNode> = {
  'Planned':     <Clock size={12} />,
  'In Progress': <Wrench size={12} />,
  'Completed':   <CheckCircle2 size={12} />,
  'On Hold':     <AlertTriangle size={12} />,
  'Cancelled':   <XCircle size={12} />,
};

const PRIORITY_BADGE: Record<WorkOrderPriority, string> = {
  'Low':      'badge-good',
  'Medium':   'badge-fair',
  'High':     'badge-poor',
  'Critical': 'badge-critical',
};

export default function MaintenanceWorks() {
  const { state, dispatch } = useBMS();
  const { workOrders, structures } = state;

  const [query,      setQuery]      = useState('');
  const [statusF,    setStatusF]    = useState<WorkOrderStatus | 'all'>('all');
  const [priorityF,  setPriorityF]  = useState<WorkOrderPriority | 'all'>('all');
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<WorkOrder | null>(null);

  const filtered = useMemo(() => {
    let list = [...workOrders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (statusF !== 'all')   list = list.filter(w => w.status === statusF);
    if (priorityF !== 'all') list = list.filter(w => w.priority === priorityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(w =>
        w.structureName.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.contractor.toLowerCase().includes(q),
      );
    }
    return list;
  }, [workOrders, query, statusF, priorityF]);

  // KPIs
  const kpis = useMemo(() => ({
    planned:    workOrders.filter(w => w.status === 'Planned').length,
    active:     workOrders.filter(w => w.status === 'In Progress').length,
    completed:  workOrders.filter(w => w.status === 'Completed').length,
    totalCost:  workOrders.filter(w => w.status !== 'Cancelled').reduce((s, w) => s + w.cost, 0),
    activeCost: workOrders.filter(w => w.status === 'In Progress').reduce((s, w) => s + w.cost, 0),
  }), [workOrders]);

  function updateStatus(wo: WorkOrder, status: WorkOrderStatus) {
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: { ...wo, status } });
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* ─── Definition card ─── */}
      <div style={{ background:'rgba(255,215,63,0.04)', border:'1px solid rgba(255,215,63,0.14)', borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <span style={{ fontSize:26 }}>🔧</span>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Maintenance Works Programme</div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>MoWT · URF · Force Account · Community Works</div>
          </div>
        </div>
        <p style={{ fontSize:11, color:'rgba(148,163,184,0.72)', lineHeight:1.6, margin:0 }}>
          Active routine and periodic maintenance contracts across Uganda's road network - tracking contractor progress, payment disbursements, physical completion rates, and quality assurance against URF Work Plan targets for FY 2025/26.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
          {['URF Work Plan','PPDA Compliant','HDM-4 Standards','Force Account','Community Works','FY 2025/26'].map((b: string)=>(
            <span key={b} style={{ fontSize:9, fontWeight:700, color:'#ffd60a', background:'rgba(255,215,63,0.07)', border:'1px solid rgba(255,215,63,0.18)', borderRadius:20, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{b}</span>
          ))}
        </div>
      </div>
      {/* KPI strip */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-px bg-slate-700/40 border-b border-slate-700/60">
        <KPIStrip label="Planned"    value={kpis.planned}   color="text-blue-400" />
        <KPIStrip label="In Progress" value={kpis.active}   color="text-amber-400" />
        <KPIStrip label="Completed"  value={kpis.completed} color="text-green-400" />
        <KPIStrip label="Total Budget" value={formatUGX(kpis.totalCost)} color="text-slate-200" isText />
        <KPIStrip label="Active Spend" value={formatUGX(kpis.activeCost)} color="text-purple-400" isText />
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="bms-input pl-9 py-1.5 text-xs" placeholder="Search work orders…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <SearchableSelect value={statusF} onChange={v => setStatusF(v as typeof statusF)} style={{ fontSize: 11, padding: '6px 10px' }}>
            <option value="all">All Statuses</option>
            {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </SearchableSelect>
          <SearchableSelect value={priorityF} onChange={v => setPriorityF(v as typeof priorityF)} style={{ fontSize: 11, padding: '6px 10px' }}>
            <option value="all">All Priorities</option>
            {['Critical','High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
          </SearchableSelect>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} work orders</span>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="bms-btn-primary text-xs py-1.5">
            <Plus size={13} /> New Work Order
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 mowt-table-wrap p-3">
        <SortableFilterableTable<WorkOrder>
          accent="#ffd60a"
          exportName="maintenance-work-orders"
          initialSort="startDate"
          columns={[
            { key: 'title', label: 'Work Order', render: wo => (
                <div>
                  <div className="text-xs font-semibold text-slate-200 max-w-[200px] truncate">{wo.title}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{wo.id.slice(0, 8)}…</div>
                </div>
              ) },
            { key: 'structureName', label: 'Structure', render: wo => (
                <div>
                  <div className="text-xs text-slate-300 max-w-[150px] truncate">{wo.structureName}</div>
                  <div className="text-[10px] text-slate-500">{wo.structureId}</div>
                </div>
              ) },
            { key: 'type', label: 'Type' },
            { key: 'priority', label: 'Priority', render: wo => <span className={`badge ${PRIORITY_BADGE[wo.priority]}`}>{wo.priority}</span> },
            { key: 'status', label: 'Status', render: wo => (
                <span className={`badge ${STATUS_COLORS[wo.status]} flex items-center gap-1`}>
                  {STATUS_ICONS[wo.status]} {wo.status}
                </span>
              ) },
            { key: 'startDate', label: 'Start Date', date: true, render: wo => formatDate(wo.startDate) },
            { key: 'endDate', label: 'End Date', date: true, render: wo => formatDate(wo.endDate) },
            { key: 'cost', label: 'Cost (UGX)', numeric: true, total: 'sum', render: wo => formatUGX(wo.cost) },
            { key: 'contractor', label: 'Contractor' },
            { key: 'engineerInCharge', label: 'Engineer' },
            { key: 'id', label: 'Actions', render: wo => (
                <SearchableSelect
                  value={wo.status}
                  onChange={v => updateStatus(wo, v as WorkOrderStatus)}
                  style={{ fontSize: 10.5, padding: '3px 8px' }}
                >
                  {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </SearchableSelect>
              ) },
          ] as STColumn<WorkOrder>[]}
          rows={filtered}
        />
      </div>

      {/* New WO form */}
      {showForm && (
        <WorkOrderForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          initial={editing}
          onSave={wo => { dispatch({ type: 'ADD_WORK_ORDER', payload: wo }); setShowForm(false); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function KPIStrip({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="flex flex-col items-center py-3 bg-slate-900">
      <div className={`${isText ? 'text-sm' : 'text-xl'} font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 text-center px-1">{label}</div>
    </div>
  );
}

function WorkOrderForm({
  structures, initial, onSave, onClose,
}: {
  structures: { id: string; name: string }[];
  initial: WorkOrder | null;
  onSave: (wo: WorkOrder) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [f, setF] = useState<Partial<WorkOrder>>(initial ?? {
    structureId:     structures[0]?.id ?? '',
    title:           '',
    description:     '',
    type:            'Routine Maintenance',
    status:          'Planned',
    priority:        'Medium',
    startDate:       today,
    endDate:         '',
    cost:            0,
    contractor:      '',
    engineerInCharge: '',
    notes:           '',
  });

  function set(key: string, value: unknown) {
    setF(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    const struct = structures.find(s => s.id === f.structureId);
    const wo: WorkOrder = {
      id:               initial?.id ?? uuidv4(),
      structureId:      f.structureId!,
      structureName:    struct?.name ?? f.structureId!,
      title:            f.title ?? 'Untitled',
      description:      f.description ?? '',
      type:             (f.type as WorkOrderType) ?? 'Routine Maintenance',
      status:           (f.status as WorkOrderStatus) ?? 'Planned',
      priority:         (f.priority as WorkOrderPriority) ?? 'Medium',
      startDate:        f.startDate!,
      endDate:          f.endDate ?? '',
      cost:             Number(f.cost ?? 0),
      contractor:       f.contractor ?? '',
      engineerInCharge: f.engineerInCharge ?? '',
      createdAt:        initial?.createdAt ?? new Date().toISOString(),
      notes:            f.notes ?? '',
    };
    onSave(wo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-blue-400" />
            <span className="font-bold text-white">{initial ? 'Edit Work Order' : 'New Work Order'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 overflow-y-auto max-h-[70vh]">
          <div className="col-span-2">
            <label className="bms-label">Structure</label>
            <SearchableSelect value={f.structureId ?? ''} onChange={v => set('structureId', v)} style={{ fontSize: 12, padding: '7px 10px' }}>
              {structures.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </SearchableSelect>
          </div>
          <div className="col-span-2">
            <label className="bms-label">Title</label>
            <input className="bms-input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Work order title…" />
          </div>
          <div>
            <label className="bms-label">Type</label>
            <SearchableSelect value={f.type ?? ''} onChange={v => set('type', v)} style={{ fontSize: 12, padding: '7px 10px' }}>
              {['Routine Maintenance','Preventive','Rehabilitation','Emergency Repair','Reconstruction'].map(t => <option key={t} value={t}>{t}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label className="bms-label">Priority</label>
            <SearchableSelect value={f.priority ?? ''} onChange={v => set('priority', v)} style={{ fontSize: 12, padding: '7px 10px' }}>
              {['Low','Medium','High','Critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label className="bms-label">Status</label>
            <SearchableSelect value={f.status ?? ''} onChange={v => set('status', v)} style={{ fontSize: 12, padding: '7px 10px' }}>
              {['Planned','In Progress','Completed','On Hold','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </SearchableSelect>
          </div>
          <div>
            <label className="bms-label">Cost (UGX)</label>
            <input className="bms-input" type="number" value={f.cost} onChange={e => set('cost', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">Start Date</label>
            <input className="bms-input" type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">End Date</label>
            <input className="bms-input" type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
          <div>
            <label className="bms-label">Contractor</label>
            <input className="bms-input" value={f.contractor} onChange={e => set('contractor', e.target.value)} placeholder="Contractor name…" />
          </div>
          <div>
            <label className="bms-label">Engineer in Charge</label>
            <input className="bms-input" value={f.engineerInCharge} onChange={e => set('engineerInCharge', e.target.value)} placeholder="Engineer…" />
          </div>
          <div className="col-span-2">
            <label className="bms-label">Description</label>
            <textarea className="bms-input h-20 resize-none" value={f.description} onChange={e => set('description', e.target.value)} placeholder="Scope of works…" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="bms-btn-secondary">Cancel</button>
          <button onClick={save} className="bms-btn-primary">
            <CheckCircle2 size={14} /> Save Work Order
          </button>
        </div>
      </div>
    </div>
  );
}
