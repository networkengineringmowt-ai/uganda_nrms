import { useEffect, useState } from 'react';
import { Book, FileText, Download, FolderOpen, ExternalLink } from 'lucide-react';

interface Manual {
  id: string;
  title: string;
  category: string;
  url: string;
  sizeBytes: number;
  type: string;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function PavementCatalogue() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}manuals/pavement/manifest.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Catalogue request failed (${r.status})`);
        return r.json();
      })
      .then(data => {
        setManuals(data);
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to load pavement manuals manifest', e);
        setLoading(false);
      });
  }, []);

  const categories = ['All', ...Array.from(new Set(manuals.map(m => m.category))).sort()];

  const filtered = activeCategory === 'All'
    ? manuals
    : manuals.filter(m => m.category === activeCategory);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>📚</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(16,185,129,1)',letterSpacing:-0.5}}>Pavement Catalogue</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Pavement Types · Layer Design · ROMDAS · MoWT Standards · Design Life</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Comprehensive pavement catalogue for Uganda's national road network - documenting pavement layer compositions, material specifications, ROMDAS survey data, structural design standards, and expected design life by road class and climate zone.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Pavement Types","Layer Design","Material Specs","ROMDAS Data","MoWT Standards","Design Life"].map(b=>(
                <span key={b} style={{background:'rgba(16,185,129,0.12)',color:'rgba(16,185,129,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ color: '#f59e0b', fontSize: 14 }}>Loading design catalogue...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px', background: 'rgba(8,14,28,0.5)', minHeight: '100%' }}>
      <div>
        <h2 style={{ color: '#f59e0b', marginBottom: 8, fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Book size={20} />
          PAVEMENT DESIGN CATALOGUE
        </h2>
        <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12, marginBottom: 20 }}>
          Official Ministry of Works & Transport Pavement Design Manuals and Guidelines
        </p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeCategory === cat ? 700 : 500,
              background: activeCategory === cat ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
              color: activeCategory === cat ? '#f59e0b' : 'rgba(148,163,184,0.7)',
              transition: 'all 0.15s',
            }}
          >
            {cat === 'General' ? 'General Guidelines' : cat}
          </button>
        ))}
      </div>

      {/* Manuals Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'rgba(148,163,184,0.5)', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
          No manuals found in this category.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(m => {
            const isPdf = m.type.toLowerCase() === 'pdf';
            const fileUrl = `${import.meta.env.BASE_URL}${m.url}`;
            return (
              <div key={m.id} style={{
                background: 'rgba(15,30,50,0.6)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: isPdf ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                    color: isPdf ? '#ef4444' : '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4', lineHeight: 1.4, marginBottom: 4, wordBreak: 'break-word' }}>
                      {m.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FolderOpen size={10} /> {m.category}</span>
                      <span>{formatBytes(m.sizeBytes)}</span>
                      <span style={{ textTransform: 'uppercase', fontWeight: 700, color: isPdf ? '#ef4444' : '#3b82f6' }}>{m.type}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
                  <a href={fileUrl} target="_blank" rel="noreferrer" style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.1)',
                    color: '#f59e0b', fontSize: 11, fontWeight: 700, textDecoration: 'none',
                    border: '1px solid rgba(245,158,11,0.2)'
                  }}>
                    <ExternalLink size={14} /> Open
                  </a>
                  <a href={fileUrl} download style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36,
                    borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#e2eaf4',
                    border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none'
                  }} title="Download File">
                    <Download size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
