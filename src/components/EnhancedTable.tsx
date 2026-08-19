import React, { useState, useMemo, useCallback } from 'react';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface EnhancedTableProps {
  data: any[];
  columns: Column[];
  conditionKey?: string;
  aadtKey?: string;
  title?: string;
}

type SortDir = 'asc' | 'desc' | null;

function getCondClass(val: string | undefined): string {
  if (!val) return 'cond-null';
  const v = String(val).toLowerCase();
  if (v.includes('good')) return 'cond-good';
  if (v.includes('fair')) return 'cond-fair';
  if (v.includes('poor') || v.includes('bad')) return 'cond-poor';
  return '';
}

function aadtClass(v: number): string {
  if (!v || v === 0) return 'aadt-heat-low';
  if (v < 500) return 'aadt-heat-low';
  if (v < 2000) return 'aadt-heat-medium';
  return 'aadt-heat-high';
}

export const EnhancedTable: React.FC<EnhancedTableProps> = ({
  data, columns, conditionKey = 'condition', aadtKey = 'aadt', title
}) => {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = useCallback((key: string) => {
    if (sortCol !== key) { setSortCol(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortCol(null); setSortDir(null);
  }, [sortCol, sortDir]);

  const sortIcon = (key: string) => {
    if (sortCol !== key) return <span className="mowt-sort-btn">ss</span>;
    return <span className="mowt-sort-btn active">{sortDir === 'asc' ? 'up' : 'dn'}</span>;
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)));
    }
    if (sortCol && sortDir) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        const an = parseFloat(av), bn = parseFloat(bv);
        const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, sortCol, sortDir, columns]);

  return (
    <div>
      {title && <h3 style={{marginBottom:6}}>{title}</h3>}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <span className="mowt-record-count">Showing {filtered.length} of {data.length} records</span>
        <input type="text" placeholder="Filter rows..." value={search} onChange={e => setSearch(e.target.value)}
          style={{padding:'4px 10px',borderRadius:6,border:'1px solid #334155',background:'#1e293b',color:'#f8fafc',fontSize:'0.82rem',minWidth:200}} />
      </div>
      <div className="mowt-table-wrap">
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{columns.map(c => <th key={c.key} onClick={() => handleSort(c.key)} style={{cursor:'pointer'}}>{c.label}{sortIcon(c.key)}</th>)}</tr></thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} className={getCondClass(row[conditionKey])}>
                {columns.map(c => <td key={c.key}>{c.render ? c.render(row[c.key], row) : c.key === aadtKey && row[c.key] != null ? <span className={aadtClass(Number(row[c.key]))}>{row[c.key]}</span> : String(row[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EnhancedTable;
