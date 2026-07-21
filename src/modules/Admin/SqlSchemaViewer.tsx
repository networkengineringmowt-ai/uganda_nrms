/**
 * SqlSchemaViewer — Admin Tools · SQL Schema tab.
 * Renders the comprehensive platform schema (scripts/nrms_schema.sql, shipped
 * as data/nrms_schema.sql). The schema file is the single source of truth —
 * nothing is hardcoded here.
 */
import { useEffect, useMemo, useState } from 'react';
import { Database, Download, Table2 } from 'lucide-react';

const SCHEMA_URL = `${import.meta.env.BASE_URL}data/nrms_schema.sql`;

interface SchemaObject { kind: 'table' | 'view'; name: string; body: string }

function parseObjects(sql: string): SchemaObject[] {
  const out: SchemaObject[] = [];
  const re = /CREATE\s+(TABLE|VIEW)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ kind: m[1].toLowerCase() as 'table' | 'view', name: m[2], body: '' });
  }
  return out;
}

export default function SqlSchemaViewer() {
  const [sql, setSql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    let live = true;
    fetch(SCHEMA_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(t => { if (live) setSql(t); })
      .catch(e => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, []);

  const objects = useMemo(() => (sql ? parseObjects(sql) : []), [sql]);
  const tables = objects.filter(o => o.kind === 'table');
  const views = objects.filter(o => o.kind === 'view');

  const shownSql = useMemo(() => {
    if (!sql || !filter) return sql ?? '';
    // show only the statement block(s) mentioning the filtered object
    return sql.split(/\n(?=CREATE |INSERT INTO |-- ─── )/)
      .filter(b => b.toLowerCase().includes(filter.toLowerCase()))
      .join('\n');
  }, [sql, filter]);

  const slate = 'rgba(148,163,184,0.7)';

  return (
    <div style={{ padding: 20, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Database size={18} style={{ color: '#00f5ff' }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#e2eaf4', letterSpacing: '.04em' }}>
          NRMS SQL Schema — single source of truth
        </h2>
        <a href={SCHEMA_URL} download="nrms_schema.sql" style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          color: '#00f5ff', background: 'rgba(0,245,255,0.08)',
          border: '1px solid rgba(0,245,255,0.3)', textDecoration: 'none',
        }}><Download size={12} /> Download .sql</a>
      </div>

      {error && <div style={{ color: '#ff2d78', fontSize: 12 }}>Could not load schema: {error}</div>}
      {!sql && !error && <div style={{ color: slate, fontSize: 12 }}>Loading schema…</div>}

      {sql && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => setFilter('')} style={{
              padding: '4px 12px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filter === '' ? 'rgba(0,245,255,0.5)' : 'rgba(148,163,184,0.2)'}`,
              background: filter === '' ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.03)',
              color: filter === '' ? '#00f5ff' : slate,
            }}>All ({tables.length} tables · {views.length} views)</button>
            {objects.map(o => (
              <button key={o.name} onClick={() => setFilter(o.name)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${filter === o.name ? 'rgba(0,245,255,0.5)' : 'rgba(148,163,184,0.15)'}`,
                background: filter === o.name ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.03)',
                color: filter === o.name ? '#00f5ff' : o.kind === 'view' ? '#b967ff' : slate,
              }}><Table2 size={10} />{o.name}</button>
            ))}
          </div>
          <pre style={{
            margin: 0, padding: 18, borderRadius: 12, overflow: 'auto', maxHeight: '68vh',
            background: 'rgba(2,5,8,0.75)', border: '1px solid rgba(0,245,255,0.15)',
            color: '#c7d2e0', fontSize: 11.5, lineHeight: 1.55,
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
          }}>{shownSql}</pre>
        </>
      )}
    </div>
  );
}
