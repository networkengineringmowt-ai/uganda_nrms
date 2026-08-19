import React, { useState, Suspense, lazy } from 'react';
import { LayoutDashboard, Building2, Map, Route, Users, Wrench, FileText } from 'lucide-react';

const SectionDashboard = lazy(() => import('../Dashboard/SectionDashboard'));

type Tab = 'dashboard' | 'overview' | 'network' | 'works';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard size={13}/> },
  { id: 'overview',  label: 'Overview',     icon: <Building2 size={13}/> },
  { id: 'network',   label: 'Road Network', icon: <Route size={13}/> },
  { id: 'works',     label: 'Works & Maintenance', icon: <Wrench size={13}/> },
];

const ACC = '#ff6b35';

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      padding: '3px 8px', borderRadius: 3,
      border: `1px solid ${ACC}55`,
      color: ACC, background: `${ACC}10`,
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

const KPIs = [
  { label: 'Urban Roads',     value: '2,300 km',  sub: 'City & town roads',      color: '#ff6b35' },
  { label: 'District Roads',  value: '16,500 km', sub: 'Feeder & rural links',   color: '#ffd23f' },
  { label: 'Community Roads', value: '12,000 km', sub: 'Village access routes',  color: '#00d4aa' },
  { label: 'Paved Ratio',     value: '18%',        sub: 'Urban + district paved', color: '#b967ff' },
  { label: 'Local Gov Units', value: '146',        sub: 'Districts & cities',     color: '#4d9fff' },
  { label: 'Annual Budget',   value: 'UGX 800 Bn', sub: 'FY25-26 envelope',      color: '#00ff88' },
];

function OverviewTab() {
  return (
    <div style={{ padding: 24, overflowY: 'auto', maxHeight: '100%' }}>
      {/* Definition card */}
      <div style={{
        background: 'rgba(255,107,53,0.05)',
        border: '1px solid rgba(255,107,53,0.2)',
        borderRadius: 10, padding: '18px 22px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(255,107,53,0.1)',
            border: '1px solid rgba(255,107,53,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={18} color={ACC} />
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: ACC, textTransform: 'uppercase' }}>DEPARTMENT</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
              DUCAR — District, Urban & Community Access Roads
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(200,200,200,0.85)', lineHeight: 1.75, marginBottom: 14 }}>
          The <strong style={{ color: ACC }}>Department of Urban and Community Access Roads</strong> (DUCAR) oversees
          the planning, construction, and maintenance of <em>urban roads, district feeder roads, and community access
          routes</em> across Uganda. Working through 146 Local Government Units, DUCAR bridges the gap between the
          national road network and last-mile rural connectivity — serving farmers, schools, health facilities, and
          trading centres with all-weather surface access. DUCAR integrates Road Rehabilitation, Routine Maintenance,
          Emergency Works, and the Urban Road Upgrading Programme under a single asset management framework aligned
          with NDP IV strategic outcomes.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['NDP IV Aligned','World Bank Funded','Urban Roads Programme','Community Access Roads','Feeder Roads','Labour-Based Works'].map(c => <Chip key={c} label={c}/>)}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {KPIs.map(k => (
          <div key={k.label} style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${k.color}30`,
            borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, color: 'rgba(160,160,180,0.7)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(160,160,180,0.6)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Mandate areas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { icon: <Map size={14}/>, title: 'Urban Roads', items: ['City road networks (Kampala, Gulu, Mbarara, Jinja)','Town roads in 22 municipalities','Road lighting, drainage & walkways','Traffic signal infrastructure'] },
          { icon: <Route size={14}/>, title: 'District Feeder Roads', items: ['16,500 km district road network','Market & agricultural access routes','Bi-annual grading & gravelling','District Road Committees oversight'] },
          { icon: <Users size={14}/>, title: 'Community Access', items: ['12,000 km community tracks','Village connectivity (2 km RAI target)','Labour-based maintenance contracts','Women & youth employment programmes'] },
          { icon: <Wrench size={14}/>, title: 'Works Delivery', items: ['UNRA-aligned maintenance standards','Force Account & contractor mix','Equipment pools per region','Emergency repair mobilisation'] },
        ].map(s => (
          <div key={s.title} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,107,53,0.1)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: ACC }}>
              {s.icon}
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.title}</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
              {s.items.map(it => <li key={it} style={{ fontSize: 11, color: 'rgba(190,190,210,0.85)', marginBottom: 4, lineHeight: 1.5 }}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function DucarOverviewPanel() {
  return <OverviewTab />;
}
