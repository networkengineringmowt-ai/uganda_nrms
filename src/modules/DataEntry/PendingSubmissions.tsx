import { useEffect, useState } from 'react';
import { ProtectedRoute } from '../Auth/ProtectedRoute';
import { fetchCapturedTable } from '../../shared/useCapturedRecords';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { NullableCell } from '../../shared/tableFormatting';

// Vivid platform palette (reused rather than the module's old muted indigo/red).
const NEON = { cyan: '#00f5ff', green: '#00ff88', amber: '#ffd23f', orange: '#ff6b35', red: '#ff3366' };

// Overall-condition scale used by ConditionSurveyForm - colour-coded the
// same way condition ratings are everywhere else on the platform.
const CONDITION_COLOR: Record<string, string> = {
  'Good': NEON.green, 'Fair': NEON.amber, 'Poor': NEON.orange,
  'Bad': NEON.red, 'Very Bad': NEON.red,
};

// Mirrors WRITABLE_TABLES in server/index.js (kept as a plain label map here
// since this panel only needs table -> display name, not the write rules).
const SYNCED_TABLES: Record<string, string> = {
  road_link_condition:         'RMS — Condition Surveys',
  structure_condition_history: 'BMS — Structure Condition History',
  inspections:                 'BMS — Inspections',
  work_orders:                 'BMS — Work Orders',
  bridge_documents:            'BMS — Bridge Documents',
  maintenance_programme:       'PMS — Maintenance Programme',
  road_reserve_records:        'Road Reserve — Records',
  road_reserve_encroachments:  'Road Reserve — Encroachments',
  road_reserve_gazette:        'Road Reserve — Gazette Status',
  road_reserve_applicants:     'Road Reserve — Applicants (PII)',
  road_reserve_applications:   'Road Reserve — Applications (PII)',
  project_tracker:             'Project Tracker',
};

function SyncedCapturesPanel() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Object.keys(SYNCED_TABLES).map(table =>
        fetchCapturedTable(table).then(records => [table, records.length] as const)
      )
    ).then(entries => {
      if (!cancelled) setCounts(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, []);

  const rows = Object.entries(SYNCED_TABLES).map(([table, label]) => ({
    table, label, count: counts?.[table] ?? 0, loading: counts === null,
  }));
  const totalSynced = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div style={{ padding:'20px 24px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ color:'#e2e8f0', fontSize:15, fontWeight:700 }}>Synced Field Captures</div>
      <div style={{ color:'#64748b', fontSize:11, marginTop:2, marginBottom:14 }}>
        From captures/&lt;table&gt;.jsonl (written by the data-entry server), folded into
        public/data/captures_&lt;table&gt;.json by <code>drive_sync.py</code> as of the last build —
        {' '}{totalSynced} record{totalSynced !== 1 ? 's' : ''} across {rows.length} table{rows.length !== 1 ? 's' : ''} in this deploy.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8 }}>
        {rows.map(r => (
          <div key={r.table} style={{
            padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ color:'#94a3b8', fontSize:11, fontWeight:600 }}>{r.label}</div>
            <div style={{ color: r.count ? '#e2e8f0' : '#475569', fontSize:18, fontWeight:700, marginTop:4 }}>
              {r.loading ? '…' : r.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SurveyPayload {
  id: string;
  link_id: string;
  survey_date: string;
  iri_measured: number;
  cracking_pct: number;
  rutting_mm: number;
  pothole_count: number;
  drainage_score: number;
  overall_condition: string;
  surveyor_name: string;
  notes: string;
  submitted_at: string;
  status: string;
}

function downloadCsv(rows: SurveyPayload[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]) as (keyof SurveyPayload)[];
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `condition_surveys_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PendingSubmissionsInner() {
  const [submissions, setSubmissions] = useState<SurveyPayload[]>(() => {
    try { return JSON.parse(localStorage.getItem('dnr_pending_surveys') ?? '[]'); }
    catch { return []; }
  });

  function clearAll() {
    localStorage.removeItem('dnr_pending_surveys');
    setSubmissions([]);
  }

  function remove(id: string) {
    const updated = submissions.filter(s => s.id !== id);
    localStorage.setItem('dnr_pending_surveys', JSON.stringify(updated));
    setSubmissions(updated);
  }

  const columns: STColumn<SurveyPayload>[] = [
    { key: 'link_id', label: 'Link ID' },
    { key: 'survey_date', label: 'Survey Date', date: true },
    { key: 'overall_condition', label: 'Condition', render: s => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
          background: `${CONDITION_COLOR[s.overall_condition] ?? '#94a3b8'}1f`,
          border: `1px solid ${CONDITION_COLOR[s.overall_condition] ?? '#94a3b8'}55`,
          color: CONDITION_COLOR[s.overall_condition] ?? '#94a3b8', fontSize: 10, fontWeight: 800,
        }}>{s.overall_condition}</span>
      ) },
    { key: 'iri_measured', label: 'IRI (m/km)', numeric: true, render: s => <NullableCell value={s.iri_measured}>{s.iri_measured}</NullableCell> },
    { key: 'rutting_mm', label: 'Rutting (mm)', numeric: true, render: s => <NullableCell value={s.rutting_mm}>{s.rutting_mm}</NullableCell> },
    // Role only (e.g. "Field team (NRMS)") - never the submitter's individual
    // name; do not swap this for identity detail (platform-wide rule).
    { key: 'surveyor_name', label: 'Submitted By (Role)' },
    { key: 'submitted_at', label: 'Submitted', date: true, render: s => new Date(s.submitted_at).toLocaleString() },
    { key: 'id', label: 'Remove', render: s => (
        <button onClick={() => remove(s.id)} style={{ background:'none', border:'none', color: NEON.red, cursor:'pointer', fontSize:13, padding:0 }}>✕ Remove</button>
      ) },
  ];

  return (
    <div style={{ padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ color:'#e2e8f0', fontSize:15, fontWeight:700 }}>Pending Survey Submissions</div>
          <div style={{ color:'#64748b', fontSize:11, marginTop:2 }}>
            {submissions.length} record{submissions.length !== 1 ? 's' : ''} queued locally · download CSV for bulk DB import
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => downloadCsv(submissions)} disabled={!submissions.length} style={{
            padding:'7px 14px', borderRadius:8, background: submissions.length ? NEON.cyan : 'rgba(255,255,255,0.05)',
            border:'none', color: submissions.length ? '#04141a' : '#475569', fontWeight:700, fontSize:12, cursor: submissions.length ? 'pointer' : 'default',
          }}>
            Export CSV
          </button>
          <button onClick={clearAll} disabled={!submissions.length} style={{
            padding:'7px 14px', borderRadius:8, background: submissions.length ? `${NEON.red}26` : 'rgba(255,255,255,0.05)',
            border: `1px solid ${submissions.length ? `${NEON.red}55` : 'rgba(255,255,255,0.05)'}`,
            color: submissions.length ? NEON.red : '#475569', fontSize:12, cursor: submissions.length ? 'pointer' : 'default',
          }}>
            Clear All
          </button>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#475569' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
          <div style={{ fontSize:13 }}>No pending submissions</div>
          <div style={{ fontSize:11, marginTop:4 }}>Submit condition surveys from the Road Condition module</div>
        </div>
      ) : (
        <SortableFilterableTable
          columns={columns}
          rows={submissions}
          accent={NEON.cyan}
          exportName="pending-survey-submissions"
          initialSort="submitted_at"
        />
      )}

      <SyncedCapturesPanel />
    </div>
  );
}

export function PendingSubmissions() {
  return (
    <ProtectedRoute permission="canSubmitSurvey">
      <PendingSubmissionsInner />
    </ProtectedRoute>
  );
}
