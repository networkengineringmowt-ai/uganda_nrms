/**
 * SchemaExplorer - the platform relational model.
 * One SQL table per section / tab, primary and foreign keys, and EVERY
 * linking query shown in full. Rendered per section: the section's own table
 * is highlighted, its direct relations listed, and all join queries printed.
 */
import { useMemo, useState } from 'react';
import { useDbStatus } from '../../shared/useDbStatus';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const CARD: React.CSSProperties = { background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 };

interface TableDef { section: string; name: string; pk: string; ddl: string; fks: { col: string; ref: string }[] }

// One table per section / tab - the platform database.
const TABLES: TableDef[] = [
  { section: 'rms', name: 'rms_road_links', pk: 'link_id', fks: [], ddl:
`CREATE TABLE rms_road_links (
  link_id        VARCHAR(24) PRIMARY KEY,
  road_no        VARCHAR(12) NOT NULL,
  link_name      VARCHAR(200),
  road_class     CHAR(1) CHECK (road_class IN ('A','B','C','M')),
  region         VARCHAR(40) NOT NULL,
  district       VARCHAR(80),
  length_km      NUMERIC(8,2) NOT NULL,
  surface_type   VARCHAR(30),          -- Paved / Gravel / Earth
  lanes          SMALLINT DEFAULT 2,
  gazette_status VARCHAR(30),
  updated_at     TIMESTAMPTZ DEFAULT now()
);` },
  { section: 'pms', name: 'pms_condition_assessments', pk: 'assessment_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }], ddl:
`CREATE TABLE pms_condition_assessments (
  assessment_id  BIGSERIAL PRIMARY KEY,
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  survey_year    INTEGER NOT NULL,
  iri_m_km       NUMERIC(5,2),
  rut_depth_mm   NUMERIC(5,1),
  condition      VARCHAR(10) CHECK (condition IN ('Good','Fair','Poor','Bad')),
  vci_score      NUMERIC(5,1),
  affected_km    NUMERIC(8,2),
  UNIQUE (link_id, survey_year)
);` },
  { section: 'tis', name: 'tis_traffic_counts', pk: 'count_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }, { col: 'station_id', ref: 'tis_stations(station_id)' }], ddl:
`CREATE TABLE tis_traffic_counts (
  count_id       BIGSERIAL PRIMARY KEY,
  station_id     INTEGER NOT NULL REFERENCES tis_stations(station_id),
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  count_year     INTEGER NOT NULL,
  aadt           INTEGER NOT NULL,
  heavy_pct      NUMERIC(5,2),
  esal_daily     NUMERIC(12,2),
  UNIQUE (station_id, count_year)
);

CREATE TABLE tis_stations (
  station_id     INTEGER PRIMARY KEY,          -- TCS_NO
  station_name   VARCHAR(120),
  link_id        VARCHAR(24) REFERENCES rms_road_links(link_id),
  region         VARCHAR(40),
  station_type   VARCHAR(20)                   -- ATC / TIS survey
);` },
  { section: 'bms', name: 'bms_structures', pk: 'structure_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }], ddl:
`CREATE TABLE bms_structures (
  structure_id   VARCHAR(20) PRIMARY KEY,
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  structure_type VARCHAR(20) CHECK (structure_type IN ('Bridge','Culvert','Drift')),
  span_m         NUMERIC(7,2),
  condition_rating SMALLINT CHECK (condition_rating BETWEEN 1 AND 5),
  load_limit_t   NUMERIC(6,1),
  last_inspection DATE,
  affected_km    NUMERIC(6,2)                  -- road length served by structure
);` },
  { section: 'ducar', name: 'ducar_works', pk: 'work_id', fks: [{ col: 'district', ref: 'socio_districts(district_name)' }], ddl:
`CREATE TABLE ducar_works (
  work_id        BIGSERIAL PRIMARY KEY,
  district       VARCHAR(80) NOT NULL REFERENCES socio_districts(district_name),
  road_name      VARCHAR(200),
  network_type   VARCHAR(20) CHECK (network_type IN ('Urban','District','Community')),
  work_type      VARCHAR(40),                  -- Routine / Periodic / Rehab
  status         VARCHAR(20),                  -- Planned / In Progress / Completed / Suspended
  length_km      NUMERIC(8,2),
  cost_ugx_m     NUMERIC(12,2),
  fy             VARCHAR(9)
);` },
];

const TABLES2: TableDef[] = [
  { section: 'reserve', name: 'reserve_encroachments', pk: 'case_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }], ddl:
`CREATE TABLE reserve_encroachments (
  case_id        BIGSERIAL PRIMARY KEY,
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  encroach_type  VARCHAR(40),                  -- Structure / Cultivation / Utility / Market
  status         VARCHAR(20) CHECK (status IN ('Pending','Under Review','Resolved','Escalated')),
  affected_km    NUMERIC(6,2),
  reported_on    DATE,
  permit_id      BIGINT REFERENCES reserve_permits(permit_id)
);

CREATE TABLE reserve_permits (
  permit_id      BIGSERIAL PRIMARY KEY,
  link_id        VARCHAR(24) REFERENCES rms_road_links(link_id),
  permit_type    VARCHAR(40),                  -- Utility crossing / Access / Advertisement
  issued_on      DATE,
  expires_on     DATE
);` },
  { section: 'pim', name: 'pim_projects', pk: 'project_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }, { col: 'budget_line_id', ref: 'budget_lines(budget_line_id)' }], ddl:
`CREATE TABLE pim_projects (
  project_id     BIGSERIAL PRIMARY KEY,
  project_name   VARCHAR(200) NOT NULL,
  link_id        VARCHAR(24) REFERENCES rms_road_links(link_id),
  category       VARCHAR(40),                  -- Construction / Rehab / Bridge / Equipment / Donor
  status         VARCHAR(20),                  -- Planned / Ongoing / Completed
  length_km      NUMERIC(8,2),
  cost_ugx_bn    NUMERIC(12,3),
  budget_line_id BIGINT REFERENCES budget_lines(budget_line_id),
  npv_ugx_bn     NUMERIC(12,3)
);` },
  { section: 'budget', name: 'budget_lines', pk: 'budget_line_id', fks: [], ddl:
`CREATE TABLE budget_lines (
  budget_line_id BIGSERIAL PRIMARY KEY,
  fy             VARCHAR(9) NOT NULL,          -- e.g. FY25/26
  category       VARCHAR(60) NOT NULL,
  allocation_ugx_bn NUMERIC(12,3) NOT NULL,
  released_ugx_bn   NUMERIC(12,3) DEFAULT 0,
  absorbed_ugx_bn   NUMERIC(12,3) DEFAULT 0
);` },
  { section: 'lifecycle', name: 'lifecycle_costs', pk: 'lc_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }], ddl:
`CREATE TABLE lifecycle_costs (
  lc_id          BIGSERIAL PRIMARY KEY,
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  treatment      VARCHAR(60),                  -- Reseal / Overlay / Reconstruction
  design_life_yr SMALLINT,
  unit_cost_usd_km NUMERIC(12,2),
  scheduled_year INTEGER,
  cum_esal_design NUMERIC(14,0)
);` },
  { section: 'safety', name: 'safety_blackspots', pk: 'spot_id', fks: [{ col: 'link_id', ref: 'rms_road_links(link_id)' }], ddl:
`CREATE TABLE safety_blackspots (
  spot_id        BIGSERIAL PRIMARY KEY,
  link_id        VARCHAR(24) NOT NULL REFERENCES rms_road_links(link_id),
  severity_band  VARCHAR(12) CHECK (severity_band IN ('Critical','High','Medium','Low')),
  crashes_5yr    INTEGER,                      -- aggregate counts only
  affected_km    NUMERIC(6,2),
  countermeasure VARCHAR(120)
);` },
  { section: 'socio', name: 'socio_districts', pk: 'district_name', fks: [], ddl:
`CREATE TABLE socio_districts (
  district_name  VARCHAR(80) PRIMARY KEY,
  region         VARCHAR(40) NOT NULL,
  population     BIGINT,
  area_km2       NUMERIC(10,2),
  gdp_usd_m      NUMERIC(12,2),
  poverty_pct    NUMERIC(5,2),
  literacy_pct   NUMERIC(5,2)
);` },
  { section: 'casestudies', name: 'cs_agencies', pk: 'agency_id', fks: [], ddl:
`CREATE TABLE cs_agencies (
  agency_id      SERIAL PRIMARY KEY,
  agency_name    VARCHAR(120) NOT NULL,
  country        VARCHAR(80),
  region_global  VARCHAR(30),                  -- Africa / Europe / Americas / Asia-Pacific
  network_km     INTEGER,
  paved_pct      NUMERIC(5,2),
  budget_usd_km  INTEGER,
  system_used    VARCHAR(80)
);` },
  { section: 'gis', name: 'gis_layers', pk: 'layer_id', fks: [{ col: 'source_table', ref: 'pg_catalog (metadata)' }], ddl:
`CREATE TABLE gis_layers (
  layer_id       SERIAL PRIMARY KEY,
  layer_name     VARCHAR(120) NOT NULL,
  source_table   VARCHAR(80) NOT NULL,         -- e.g. rms_road_links
  geometry_type  VARCHAR(20),                  -- LineString / Point / Polygon
  wms_endpoint   VARCHAR(200),
  refresh_cron   VARCHAR(40)
);` },
];
const ALL_TABLES = [...TABLES, ...TABLES2];

// Every linking query - the joins that tie the sections together.
interface LinkQuery { id: string; title: string; sections: string[]; sql: string }
const QUERIES: LinkQuery[] = [
  { id: 'q1', title: 'RMS ⋈ PMS - latest condition per link with km affected', sections: ['rms','pms'], sql:
`SELECT l.link_id, l.road_no, l.link_name, l.region, l.length_km,
       c.survey_year, c.condition, c.iri_m_km, c.affected_km
FROM rms_road_links l
JOIN LATERAL (
  SELECT * FROM pms_condition_assessments c
  WHERE c.link_id = l.link_id
  ORDER BY c.survey_year DESC LIMIT 1
) c ON TRUE
ORDER BY c.iri_m_km DESC;` },
  { id: 'q2', title: 'RMS ⋈ TIS - AADT and ESAL joined to link inventory', sections: ['rms','tis'], sql:
`SELECT l.link_id, l.road_no, l.road_class, l.length_km,
       s.station_name, t.count_year, t.aadt, t.heavy_pct, t.esal_daily,
       t.aadt * l.length_km AS vkm_daily
FROM rms_road_links l
JOIN tis_traffic_counts t ON t.link_id = l.link_id
JOIN tis_stations s       ON s.station_id = t.station_id
WHERE t.count_year = (SELECT MAX(count_year) FROM tis_traffic_counts);` },
  { id: 'q3', title: 'RMS ⋈ BMS - structures per link with condition counts and km served', sections: ['rms','bms'], sql:
`SELECT l.link_id, l.road_no,
       COUNT(*) FILTER (WHERE b.structure_type='Bridge')  AS bridges,
       COUNT(*) FILTER (WHERE b.structure_type='Culvert') AS culverts,
       COUNT(*) FILTER (WHERE b.condition_rating >= 4)    AS poor_structures,
       SUM(b.affected_km)                                 AS km_served
FROM rms_road_links l
LEFT JOIN bms_structures b ON b.link_id = l.link_id
GROUP BY l.link_id, l.road_no
ORDER BY poor_structures DESC NULLS LAST;` },
  { id: 'q4', title: 'PMS ⋈ TIS ⋈ Lifecycle - treatment triggers from condition and loading', sections: ['pms','tis','lifecycle'], sql:
`SELECT l.link_id, l.road_no, c.condition, c.iri_m_km,
       t.aadt, t.esal_daily, lc.treatment, lc.scheduled_year,
       365 * t.esal_daily * lc.design_life_yr AS design_window_esal
FROM rms_road_links l
JOIN pms_condition_assessments c ON c.link_id = l.link_id
JOIN tis_traffic_counts t        ON t.link_id = l.link_id
JOIN lifecycle_costs lc          ON lc.link_id = l.link_id
WHERE c.condition IN ('Poor','Bad') AND t.aadt > 1000
ORDER BY t.esal_daily DESC;` },
  { id: 'q5', title: 'DUCAR ⋈ Socio - works coverage against district need', sections: ['ducar','socio'], sql:
`SELECT d.district_name, d.region, d.population, d.poverty_pct,
       COUNT(w.work_id)                                   AS works,
       SUM(w.length_km)                                   AS km_worked,
       SUM(w.cost_ugx_m)                                  AS spend_ugx_m,
       ROUND(SUM(w.length_km) * 100000.0 / d.population, 2) AS km_per_100k_pop
FROM socio_districts d
LEFT JOIN ducar_works w ON w.district = d.district_name
GROUP BY d.district_name, d.region, d.population, d.poverty_pct
ORDER BY d.poverty_pct DESC;` },
  { id: 'q6', title: 'Reserve ⋈ RMS - encroachment burden per corridor', sections: ['reserve','rms'], sql:
`SELECT l.road_no, l.region,
       COUNT(e.case_id)                          AS cases,
       COUNT(*) FILTER (WHERE e.status='Pending') AS pending,
       SUM(e.affected_km)                        AS km_affected,
       ROUND(100.0 * SUM(e.affected_km) / SUM(l.length_km), 2) AS pct_corridor_affected
FROM rms_road_links l
JOIN reserve_encroachments e ON e.link_id = l.link_id
GROUP BY l.road_no, l.region
ORDER BY km_affected DESC;` },
  { id: 'q7', title: 'PIM ⋈ Budget ⋈ RMS - project spend traced to corridors and lines', sections: ['pim','budget','rms'], sql:
`SELECT p.project_name, p.status, p.length_km, p.cost_ugx_bn,
       b.fy, b.category, b.allocation_ugx_bn,
       ROUND(100.0 * b.absorbed_ugx_bn / NULLIF(b.allocation_ugx_bn,0), 1) AS absorption_pct,
       l.road_no, l.region
FROM pim_projects p
JOIN budget_lines b   ON b.budget_line_id = p.budget_line_id
LEFT JOIN rms_road_links l ON l.link_id = p.link_id
ORDER BY p.cost_ugx_bn DESC;` },
  { id: 'q8', title: 'Safety ⋈ TIS ⋈ PMS - blackspot exposure and surface condition', sections: ['safety','tis','pms'], sql:
`SELECT s.spot_id, l.road_no, s.severity_band, s.crashes_5yr, s.affected_km,
       t.aadt, c.condition,
       ROUND(s.crashes_5yr * 1e6 / NULLIF(t.aadt * 365 * 5 * s.affected_km, 0), 3)
         AS crash_rate_per_mvkm
FROM safety_blackspots s
JOIN rms_road_links l            ON l.link_id = s.link_id
JOIN tis_traffic_counts t        ON t.link_id = s.link_id
JOIN pms_condition_assessments c ON c.link_id = s.link_id
ORDER BY crash_rate_per_mvkm DESC;` },
  { id: 'q9', title: 'Cross-platform master view - one row per link, all sections joined', sections: ['rms','pms','tis','bms','reserve','safety','lifecycle'], sql:
`CREATE VIEW v_link_master AS
SELECT l.*, c.condition, c.iri_m_km, t.aadt, t.heavy_pct,
       bs.bridges, bs.poor_structures,
       en.cases AS encroachment_cases, en.km_affected AS encroach_km,
       sb.crashes_5yr, lc.treatment AS next_treatment, lc.scheduled_year
FROM rms_road_links l
LEFT JOIN LATERAL (SELECT condition, iri_m_km FROM pms_condition_assessments
                   WHERE link_id=l.link_id ORDER BY survey_year DESC LIMIT 1) c ON TRUE
LEFT JOIN LATERAL (SELECT aadt, heavy_pct FROM tis_traffic_counts
                   WHERE link_id=l.link_id ORDER BY count_year DESC LIMIT 1) t ON TRUE
LEFT JOIN LATERAL (SELECT COUNT(*) bridges,
                          COUNT(*) FILTER (WHERE condition_rating>=4) poor_structures
                   FROM bms_structures WHERE link_id=l.link_id) bs ON TRUE
LEFT JOIN LATERAL (SELECT COUNT(*) cases, SUM(affected_km) km_affected
                   FROM reserve_encroachments WHERE link_id=l.link_id) en ON TRUE
LEFT JOIN LATERAL (SELECT SUM(crashes_5yr) crashes_5yr
                   FROM safety_blackspots WHERE link_id=l.link_id) sb ON TRUE
LEFT JOIN LATERAL (SELECT treatment, scheduled_year FROM lifecycle_costs
                   WHERE link_id=l.link_id ORDER BY scheduled_year LIMIT 1) lc ON TRUE;` },
  { id: 'q10', title: 'Case Studies ⋈ RMS - Uganda benchmarked against 209 agencies', sections: ['casestudies','rms'], sql:
`SELECT a.agency_name, a.country, a.region_global, a.network_km, a.paved_pct,
       a.budget_usd_km,
       (SELECT ROUND(100.0 * SUM(length_km) FILTER (WHERE surface_type='Paved')
               / SUM(length_km), 1) FROM rms_road_links) AS uganda_paved_pct
FROM cs_agencies a
ORDER BY a.paved_pct DESC;` },
];

// ── Renderer ──────────────────────────────────────────────────────────────────
function CodeBlock({ sql, accent }: { sql: string; accent: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { try { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} }}
        style={{ position: 'absolute', top: 6, right: 8, background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)',
          borderRadius: 5, color: accent, fontSize: 9, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>
        {copied ? 'Copied' : 'Copy SQL'}
      </button>
      <pre style={{ margin: 0, background: 'rgba(2,6,23,0.7)', borderRadius: 8, padding: '10px 12px',
        fontSize: 10.5, lineHeight: 1.65, color: '#4ade80', overflowX: 'auto', fontFamily: MONO, whiteSpace: 'pre' }}>{sql}</pre>
    </div>
  );
}

export function SchemaExplorer({ sectionId, accent = '#00f5ff' }: { sectionId: string; accent?: string }) {
  const [showAll, setShowAll] = useState(false);
  const dbStatus = useDbStatus();
  const own = useMemo(() => ALL_TABLES.filter(t => t.section === sectionId), [sectionId]);
  const related = useMemo(() => {
    const ownNames = own.map(t => t.name);
    return ALL_TABLES.filter(t => t.section !== sectionId && (
      t.fks.some(fk => ownNames.some(n => fk.ref.startsWith(n))) ||
      own.some(o => o.fks.some(fk => fk.ref.startsWith(t.name)))
    ));
  }, [own, sectionId]);
  const queries = useMemo(() => QUERIES.filter(q => showAll || q.sections.includes(sectionId) || sectionId === 'rms'), [sectionId, showAll]);
  const shown = own.length ? own : ALL_TABLES.slice(0, 1);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0 8px', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: accent }}>
          SQL DATABASE AND SCHEMA · {ALL_TABLES.length} SECTION TABLES · {QUERIES.length} LINKING QUERIES
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live check against the Supabase project, not the static schema
              text below - this tab used to only show designed DDL with no
              indication of whether the platform is actually connected. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: dbStatus === 'connected' ? '#00ff88' : dbStatus === 'offline' ? '#ff2d78' : '#94a3b8',
              boxShadow: dbStatus === 'connected' ? '0 0 6px #00ff88' : dbStatus === 'offline' ? '0 0 6px #ff2d78' : 'none' }}/>
            <span style={{ fontSize: 10, fontWeight: 700,
              color: dbStatus === 'connected' ? '#00ff88' : dbStatus === 'offline' ? '#ff2d78' : '#94a3b8' }}>
              {dbStatus === 'connected' ? 'Server: Live' : dbStatus === 'offline' ? 'Server: Unreachable' : 'Server: Checking…'}
            </span>
          </div>
          <button onClick={() => setShowAll(v => !v)}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
              color: '#94a3b8', fontSize: 10, padding: '3px 10px', cursor: 'pointer' }}>
            {showAll ? 'Show section queries' : 'Show all queries'}
          </button>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(148,163,184,0.9)', marginBottom: 8 }}>
          RELATIONAL MAP - EVERY SECTION IS ONE TABLE, LINKED BY KEYS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_TABLES.map(t => (
            <span key={t.name} style={{ fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 6,
              border: '1px solid ' + (t.section === sectionId ? accent : 'rgba(255,255,255,0.12)'),
              color: t.section === sectionId ? accent : '#94a3b8',
              background: t.section === sectionId ? 'rgba(0,245,255,0.08)' : 'transparent' }}>
              {t.name} <span style={{ color: '#475569' }}>PK {t.pk}</span>
              {t.fks.map(fk => <span key={fk.col} style={{ color: '#b967ff' }}> · FK {fk.col} → {fk.ref.split('(')[0]}</span>)}
            </span>
          ))}
        </div>
      </div>

      {shown.map(t => (
        <div key={t.name} style={{ ...CARD, borderLeft: '3px solid ' + accent }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: accent, marginBottom: 6 }}>
            SECTION TABLE - {t.name.toUpperCase()}
          </div>
          <CodeBlock sql={t.ddl} accent={accent}/>
        </div>
      ))}
      {related.map(t => (
        <div key={t.name} style={CARD}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(148,163,184,0.9)', marginBottom: 6 }}>
            LINKED TABLE - {t.name.toUpperCase()} ({t.section.toUpperCase()})
          </div>
          <CodeBlock sql={t.ddl} accent={accent}/>
        </div>
      ))}

      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(148,163,184,0.9)', margin: '12px 0 6px' }}>
        LINKING QUERIES - ALL JOINS SHOWN IN FULL
      </div>
      {queries.map(q => (
        <div key={q.id} style={{ ...CARD, borderLeft: '3px solid #b967ff' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
            {q.title} <span style={{ color: '#475569', fontFamily: MONO }}>[{q.sections.join(' ⋈ ')}]</span>
          </div>
          <CodeBlock sql={q.sql} accent={accent}/>
        </div>
      ))}
    </div>
  );
}

export default SchemaExplorer;
