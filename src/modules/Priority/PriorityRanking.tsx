import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, Filter } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { conditionColor, conditionLabel, conditionBadge, formatUGX, CONDITION_COLORS } from '../../utils/helpers';
import type { Structure } from '../../index';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

type FilterMode = 'all' | 'bridges' | 'culverts' | 'critical' | 'poor';

export default function PriorityRanking() {
  const { state }    = useBMS();
  const { structures } = state;
  const [mode, setMode] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    let list = [...structures].sort((a, b) => b.priorityScore - a.priorityScore);
    if (mode === 'bridges')  list = list.filter(s => s.type === 'bridge');
    if (mode === 'culverts') list = list.filter(s => s.type === 'culvert');
    if (mode === 'critical') list = list.filter(s => s.conditionRating === 1);
    if (mode === 'poor')     list = list.filter(s => s.conditionRating <= 2);
    return list;
  }, [structures, mode]);

  const top10 = filtered.slice(0, 10);

  // Scatter data: priority score vs age (respects the active mode filter, same as the table/top10)
  const scatterData = useMemo(() =>
    filtered.slice(0, 200).map(s => ({
      x: 2024 - s.yearBuilt,
      y: s.priorityScore,
      rating: s.conditionRating,
      name: s.name,
      id: s.id,
    })),
    [filtered],
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* ─── Definition card ─── */}
      <div style={{ background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.14)', borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <span style={{ fontSize:26 }}>🎯</span>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Road Priority Ranking</div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>HDM-4 · URF Priority · PCI · Resource Optimisation</div>
          </div>
        </div>
        <p style={{ fontSize:11, color:'rgba(148,163,184,0.72)', lineHeight:1.6, margin:0 }}>
          Evidence-based road intervention priority ranking across Uganda's national network - combining HDM-4 economic modelling, pavement condition index, traffic volumes, and social impact scores to optimise URF maintenance budget allocation.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
          {['HDM-4 Ranking','URF Priority','PCI Based','Traffic Weighted','Social Impact','Budget Optimised'].map((b: string)=>(
            <span key={b} style={{ fontSize:9, fontWeight:700, color:'#ff6b9d', background:'rgba(255,107,157,0.07)', border:'1px solid rgba(255,107,157,0.18)', borderRadius:20, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{b}</span>
          ))}
        </div>
      </div>
      {/* Header / filter bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/50">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-slate-500" />
          {(['all','bridges','culverts','critical','poor'] as FilterMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors
                ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >{m}</button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{filtered.length} structures ranked</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main ranked list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top 10 spotlight */}
          <div className="flex-shrink-0 p-4 border-b border-slate-700/60">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Top 10 Highest Priority</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {top10.map((s, i) => (
                <TopCard key={s.id} structure={s} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Full table - every ranked structure, sortable/searchable/exportable */}
          <div className="flex-1 mowt-table-wrap p-3">
            <SortableFilterableTable<Structure>
              accent="#ff6b9d"
              exportName="priority-ranking"
              initialSort="priorityRank"
              columns={[
                { key: 'priorityRank', label: 'Rank', numeric: true, render: s => (
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0
                      ${s.priorityRank <= 3 ? 'bg-red-500 text-white' :
                        s.priorityRank <= 10 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-700 text-slate-400'}`}
                    >
                      {s.priorityRank}
                    </span>
                  ) },
                { key: 'id', label: 'ID', render: s => <span className="text-xs font-mono text-blue-400 font-bold">{s.id}</span> },
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type', render: s => <span className={`badge ${s.type === 'bridge' ? 'badge-blue' : 'badge-purple'}`}>{s.type}</span> },
                { key: 'road', label: 'Road' },
                { key: 'region', label: 'Region' },
                { key: 'conditionRating', label: 'Condition', numeric: true, render: s => (
                    <span className={`badge ${conditionBadge(s.conditionRating)}`}>
                      {s.conditionRating} – {conditionLabel(s.conditionRating)}
                    </span>
                  ) },
                { key: 'traffic', label: 'Traffic', render: s => (
                    <span className={`badge ${
                      s.traffic === 'Very High' ? 'badge-critical' :
                      s.traffic === 'High'      ? 'badge-poor' :
                      s.traffic === 'Medium'    ? 'badge-fair' : 'badge-good'
                    }`}>{s.traffic}</span>
                  ) },
                { key: 'yearBuilt', label: 'Age (yrs)', numeric: true, render: s => 2024 - s.yearBuilt },
                { key: 'strategicImportance', label: 'Strategic Imp.', numeric: true, render: s => <StarRating value={s.strategicImportance} /> },
                { key: 'priorityScore', label: 'Priority Score', numeric: true, render: s => (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2 min-w-[50px]">
                        <div
                          className="rounded-full h-2"
                          style={{ width: `${s.priorityScore}%`, background: conditionColor(s.conditionRating) }}
                        />
                      </div>
                      <span className="text-xs font-bold" style={{ color: conditionColor(s.conditionRating) }}>
                        {s.priorityScore}
                      </span>
                    </div>
                  ) },
                { key: 'estimatedReplacementCost', label: 'Est. Cost', numeric: true, total: 'sum',
                  render: s => formatUGX(s.estimatedReplacementCost) },
              ] as STColumn<Structure>[]}
              rows={filtered}
            />
          </div>
        </div>

        {/* Right: scatter plot */}
        <div className="w-80 border-l border-slate-700/60 bg-slate-900/30 flex-shrink-0 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Age vs Priority Score</span>
          </div>

          <div className="bms-card p-3">
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="x" name="Age (yrs)" tick={{ fill:'#64748b', fontSize:9 }} label={{ value:'Age (yrs)', position:'insideBottom', fill:'#475569', fontSize:10, dy:8 }} />
                <YAxis dataKey="y" name="Priority" tick={{ fill:'#64748b', fontSize:9 }} label={{ value:'Priority', angle:-90, position:'insideLeft', fill:'#475569', fontSize:10 }} />
                <Tooltip
                  cursor={{ strokeDasharray:'3 3', stroke:'#475569' }}
                  contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:10 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-2 text-[10px]">
                        <div className="font-bold text-white">{d.name}</div>
                        <div className="text-slate-400">Age: {d.x} yrs · Priority: {d.y}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} animationDuration={800}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={CONDITION_COLORS[d.rating as 1|2|3|4|5]} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            {[5,4,3,2,1].map(r => (
              <div key={r} className="flex items-center gap-2 text-[10px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CONDITION_COLORS[r] }} />
                <span className="text-slate-400">Condition {r} – {conditionLabel(r)}</span>
              </div>
            ))}
          </div>

          {/* Score formula explanation */}
          <div className="bms-card p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Score Formula</div>
            <div className="text-[10px] text-slate-400 space-y-1 font-mono">
              <div>Condition:  × 3 (max 12)</div>
              <div>Traffic:    × 2 (max 8)</div>
              <div>Age:        × 1 (max 4)</div>
              <div>Strategic:  × 1 (max 5)</div>
              <div className="border-t border-slate-700 pt-1 text-slate-300">Total → scaled 0–100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Top 10 Card ──────────────────────────────────────────────────────────────
function TopCard({ structure: s, rank }: { structure: Structure; rank: number }) {
  return (
    <div
      className="flex-shrink-0 w-52 rounded-xl border p-3 cursor-default"
      style={{
        background: conditionColor(s.conditionRating) + '11',
        borderColor: conditionColor(s.conditionRating) + '44',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
          style={{ background: rank <= 3 ? '#ef4444' : '#f97316' }}
        >{rank}</span>
        <span className="text-xs font-bold text-slate-200 truncate">{s.name}</span>
      </div>
      <div className="text-[10px] text-slate-500 truncate mb-2">{s.road}</div>
      <div className="flex items-center justify-between">
        <span className={`badge ${conditionBadge(s.conditionRating)} text-[9px]`}>{conditionLabel(s.conditionRating)}</span>
        <span className="text-sm font-black" style={{ color: conditionColor(s.conditionRating) }}>{s.priorityScore}</span>
      </div>
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-xs ${i <= value ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
      ))}
    </div>
  );
}
