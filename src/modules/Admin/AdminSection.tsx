/**
 * AdminSection — Admin Tools unified 2-tab view.
 * Tabs: Platform Mind Map | Data Audit
 * Follows the exact BMS tab-bar pattern.
 */
import { lazy, Suspense, useState } from 'react';
import { Activity, BookOpen, Cpu, ShieldCheck, Users } from 'lucide-react';
import type { ActiveView } from '../../index';

const ADMIN_Identity  = lazy(() => import('./IdentityManager'));
const ADMIN_Activity  = lazy(() => import('./ActivityLog'));
const ADMIN_MindMap   = lazy(() => import('../MindMap/MindMapSection'));
const ADMIN_DataAudit = lazy(() => import('../DataAudit/DataAuditPanel'));
const ADMIN_Docs      = lazy(() => import('./SystemDocumentation'));

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77,159,255,0.18)', borderTopColor: '#4d9fff',
        animation: 'admin-spin .8s linear infinite',
      }}/>
    </div>
  );
}

const MAIN_TABS = [
  { id: 'identity'  as const, label: 'Identity Manager',   icon: <Users size={13}/> },
  { id: 'activity'  as const, label: 'Activity Log',       icon: <Activity size={13}/> },
  { id: 'mindmap'   as const, label: 'Platform Mind Map',  icon: <Cpu size={13}/> },
  { id: 'dataaudit' as const, label: 'Data Audit',         icon: <ShieldCheck size={13}/> },
  { id: 'docs'      as const, label: 'System Documentation', icon: <BookOpen size={13}/> },
];
type TabId = typeof MAIN_TABS[number]['id'];

export default function AdminSection({
  onNavigate,
}: {
  onNavigate?: (v: ActiveView) => void;
}) {
  const [tab, setTab] = useState<TabId>('identity');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes admin-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── BMS-style main tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {MAIN_TABS.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(100,116,139,0.04)',border:'1px solid rgba(100,116,139,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>⚙️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(100,116,139,1)',letterSpacing:-0.5}}>System Administration</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>MoWT IT · Role-Based Access · ISO 27001</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Secure administration console for Uganda NRMS — managing user roles, system configuration, audit logs, and compliance monitoring in alignment with MoWT IT governance and ISO 27001 information security standards.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Role-Based Access","Audit Logs","User Mgmt","System Config","MoWT IT","ISO 27001"].map(b=>(
                <span key={b} style={{background:'rgba(100,116,139,0.12)',color:'rgba(100,116,139,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
        <Suspense fallback={<Spinner />}>
          {tab === 'identity' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_Identity />
            </div>
          )}
          {tab === 'activity' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_Activity />
            </div>
          )}
          {tab === 'mindmap'   && (
            <div style={{ position:'absolute', inset:0 }}>
              <ADMIN_MindMap />
            </div>
          )}
          {tab === 'dataaudit' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_DataAudit />
            </div>
          )}
          {tab === 'docs' && (
            <div style={{ position:'absolute', inset:0, overflowY:'auto' }}>
              <ADMIN_Docs />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
