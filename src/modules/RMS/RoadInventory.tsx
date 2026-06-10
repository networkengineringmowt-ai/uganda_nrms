/**
 * RoadInventory — RMS → Road Inventory: the 8-way inventory split, grounded in
 * UNRA's official taxonomy (Visual Inspections manual, Feb 2012).
 * Compact layout: sub-tab ribbon (same style as BMS sub-tabs), collapsible
 * manual-reference strip, table fills the view.
 */
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Database } from 'lucide-react';
import {
  INVENTORY_CATEGORIES, GRADE_SCALE, MANUAL_SOURCE_NOTE,
} from '../../shared/unraStandards';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

interface LinkRow {
  link_id: string; road_no: string; road_class: string; link_name: string;
  length_km: number; surface_type: string; maintenance_region: string;
  maintenance_station: string;
}

const C = { cyan: '#00f5ff', teal: '#00d4aa', yellow: '#ffd23f', gray: '#94a3b8' };

export default function RoadInventory() {
  const [cat, setCat] = useState(INVENTORY_CATEGORIES[0].id);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/network_links.json`)
      .then(r => r.json())
      .then(d => setLinks(d))
      .catch(() => setLinks([]));
  }, []);

  const active = INVENTORY_CATEGORIES.find(c => c.id === cat)!;

  const carriagewayCols: STColumn<LinkRow>[] = useMemo(() => [
    { key: 'link_id',    label: 'Link ID',  comment: 'UNRA AMS location-referencing link identifier.' },
    { key: 'road_no',    label: 'Road No.', comment: 'Nationally accepted road/route number (manual: Inventory Items).' },
    { key: 'link_name',  label: 'Link Name' },
    { key: 'road_class', label: 'Class',    comment: 'Road class A / B / C / M.' },
    { key: 'surface_type', label: 'Pavement Type',
      comment: 'Official inventory item "Pavement Type" — carriageway paved/unpaved + wearing course.' },
    { key: 'length_km',  label: 'Length (km)', numeric: true, total: 'sum',
      comment: 'Official inventory item "Dimensions" — section length. SUM = network total.' },
    { key: 'maintenance_region',  label: 'Region' },
    { key: 'maintenance_station', label: 'Station',
      comment: 'Maintenance station responsible (manual: Inventory Items → Station).' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* ── Category sub-tab ribbon (same pattern as BMS sub-tabs) ── */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px 12px 0', flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(4,9,18,0.6)', flexShrink: 0,
      }}>
        {INVENTORY_CATEGORIES.map(c => {
          const on = c.id === cat;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px 7px', fontSize: 10, fontWeight: on ? 700 : 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: on ? C.teal : 'rgba(148,163,184,0.65)',
              borderBottom: on ? `2px solid ${C.teal}` : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* ── Compact header + collapsible manual reference ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '7px 10px', marginBottom: 10, borderRadius: 8,
          background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.18)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e2eaf4' }}>{active.label}</span>
          <span style={{ fontSize: 10.5, color: 'rgba(203,213,225,0.75)' }}>{active.description}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowRef(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px',
            borderRadius: 6, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: C.teal,
          }}>
            <BookOpen size={10} /> Manual reference {showRef ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>

        {showRef && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12,
            padding: '10px 12px', marginBottom: 10, borderRadius: 8,
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Official inventory items (manual)
              </div>
              {active.manualItems.map(m => (
                <div key={m} style={{ fontSize: 10, color: '#c4d2e1', padding: '1px 0' }}>• {m}</div>
              ))}
            </div>
            {active.relatedDefects.length > 0 && (
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Related survey defects (graded 1–5)
                </div>
                {active.relatedDefects.map(d => (
                  <div key={d} style={{ fontSize: 10, color: '#c4d2e1', padding: '1px 0' }}>• {d}</div>
                ))}
              </div>
            )}
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Official grade scale
              </div>
              {GRADE_SCALE.map(g => (
                <div key={g.grade} style={{ fontSize: 9.5, color: 'rgba(196,210,225,0.75)', padding: '1px 0' }}>
                  <strong style={{ color: '#e2eaf4' }}>{g.grade}</strong> — {g.meaning}
                </div>
              ))}
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 8.5, color: 'rgba(148,163,184,0.5)' }}>
              {MANUAL_SOURCE_NOTE} Ingested from: 0. Manuals / Asset Management Manuals.
            </div>
          </div>
        )}

        {/* ── Table fills the view ── */}
        {cat === 'carriageway' ? (
          <SortableFilterableTable
            columns={carriagewayCols}
            rows={links}
            accent={C.teal}
            exportName="road-inventory-carriageway"
            initialSort="road_no"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px dashed rgba(148,163,184,0.3)' }}>
            <Database size={14} style={{ color: C.gray }} />
            <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.8)' }}>
              Field data for <strong style={{ color: '#e2eaf4' }}>{active.label}</strong> is collected per the
              manual items (see Manual reference) — submissions via the Data Capture hub write to the Supabase
              Unified DB and this table will populate automatically.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
