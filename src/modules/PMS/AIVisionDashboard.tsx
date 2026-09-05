import { useState, useEffect } from 'react';
import { Camera, Activity, AlertTriangle, Scan, Server, FileVideo, Cpu } from 'lucide-react';

export default function AIVisionDashboard() {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  // Falls back to a synthetic road-surface backdrop if the sample frame
  // asset is unavailable, rather than leaving a broken-image icon under the
  // bounding-box overlays - this panel is already labelled "Demonstration"
  // above, so a synthetic backdrop is consistent with that framing.
  const [frameError, setFrameError] = useState(false);

  useEffect(() => {
    // Simulate initial scan
    setAnalyzing(true);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setAnalyzing(false);
          return 100;
        }
        return p + 5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#0a0f1e' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(168,85,247,0.04)',border:'1px solid rgba(168,85,247,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>👁️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(168,85,247,1)',letterSpacing:-0.5}}>AI Vision Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Computer Vision · Defect Detection · Surface Classification · ML</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>AI-powered pavement vision dashboard for Uganda NRMS - applying computer vision models to road survey imagery for automated defect detection, surface condition classification, and distress mapping feeding directly into the PMS workflow.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Computer Vision","Defect Detection","Surface Class","ML Model","Real-Time","PMS Linked"].map(b=>(
                <span key={b} style={{background:'rgba(168,85,247,0.12)',color:'rgba(168,85,247,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#64d2ff', marginBottom: 8, fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={20} />
            CNN VISION & VCI PIPELINE
          </h2>
          <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>
            Demonstration of automated defect identification from a ROMDAS survey frame
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(48, 209, 88,0.1)', border: '1px solid rgba(48, 209, 88,0.3)', padding: '6px 12px', borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158', boxShadow: '0 0 8px #30d158' }} />
            <span style={{ fontSize: 11, color: '#30d158', fontWeight: 700 }}>Demonstration Model Ready</span>
          </div>
        </div>
      </div>

      {/* Main Analysis View */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20 }}>
        
        {/* Video Feed & Detection */}
        <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(100, 210, 255,0.15)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(4,9,18,0.8)', borderBottom: '1px solid rgba(100, 210, 255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2eaf4', fontSize: 12, fontWeight: 700 }}>
              <FileVideo size={16} color="#64d2ff" /> Frame Analysis Demo: A001_Link03
            </div>
            <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 11, fontFamily: 'monospace' }}>
              CH 14+320 | Reference frame
            </div>
          </div>
          
          <div style={{ position: 'relative', flex: 1, minHeight: 400, background: '#000' }}>
            {!frameError ? (
              <img
                src={`${import.meta.env.BASE_URL}media/romdas_sample.svg`}
                alt="ROMDAS Frame"
                onError={() => setFrameError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: analyzing ? 0.5 : 1, transition: 'opacity 0.3s' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', opacity: analyzing ? 0.5 : 1, transition: 'opacity 0.3s',
                background: 'repeating-linear-gradient(100deg, #23262b 0px, #23262b 3px, #1a1c20 3px, #1a1c20 7px), linear-gradient(160deg, #2a2d33, #1c1e22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.5)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  SYNTHETIC ROAD SURFACE BACKDROP - SAMPLE FRAME UNAVAILABLE
                </span>
              </div>
            )}

            {/* Simulated Scanner Line */}
            {analyzing && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: '#64d2ff',
                boxShadow: '0 0 10px #64d2ff, 0 0 20px #64d2ff',
                animation: 'scan-line 2s infinite linear'
              }} />
            )}

            {/* Bounding Boxes (Only show when analysis complete) */}
            {!analyzing && (
              <>
                <div style={{ position: 'absolute', top: '40%', left: '30%', width: '15%', height: '15%', border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -20, left: -2, background: '#ef4444', color: '#fff', fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                    Pothole 94%
                  </div>
                </div>
                <div style={{ position: 'absolute', top: '60%', left: '55%', width: '25%', height: '10%', border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.1)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -20, left: -2, background: '#f59e0b', color: '#fff', fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                    Crocodile Cracking 88%
                  </div>
                </div>
              </>
            )}

            <style>{`
              @keyframes scan-line {
                0% { top: 0; }
                50% { top: 100%; }
                100% { top: 0; }
              }
            `}</style>
          </div>
        </div>

        {/* Inference Stats & VCI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(100, 210, 255,0.15)', borderRadius: 8, padding: 16 }}>
            <h3 style={{ color: '#64d2ff', fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Automated VCI Calculation</h3>
            
            {analyzing ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Activity size={32} color="#64d2ff" style={{ animation: 'pms-spin 1s infinite linear', marginBottom: 12 }} />
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)' }}>Processing Frame... {progress}%</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>58.5</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,158,11,0.8)', fontWeight: 700 }}>CONDITION: FAIR</div>
                </div>
                
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', marginBottom: 4 }}>Defect Deductions:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
                    <span style={{ color: '#e2eaf4' }}>Base VCI</span>
                    <span style={{ color: '#30d158' }}>100.0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: 4, marginBottom: 4 }}>
                    <span style={{ color: '#ef4444' }}>Pothole (x1)</span>
                    <span style={{ color: '#ef4444' }}>-15.5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, background: 'rgba(245,158,11,0.1)', padding: '6px 8px', borderRadius: 4 }}>
                    <span style={{ color: '#f59e0b' }}>Crocodile Cracking (10m²)</span>
                    <span style={{ color: '#f59e0b' }}>-26.0</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(15,30,50,0.6)', border: '1px solid rgba(100, 210, 255,0.15)', borderRadius: 8, padding: 16, flex: 1 }}>
            <h3 style={{ color: '#64d2ff', fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>System Telemetry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11, color: 'rgba(148,163,184,0.9)' }}>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Model:</span> ResNet50 + Faster R-CNN</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Reference latency:</span> 42ms / frame</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Example confidence:</span> 0.89 avg</div>
              <div><span style={{ color: 'rgba(148,163,184,0.5)' }}>Source:</span> bundled demonstration frame</div>
            </div>
            
            <button 
              onClick={() => { setProgress(0); setAnalyzing(true); }}
              style={{ width: '100%', marginTop: 24, padding: '8px', background: 'rgba(100, 210, 255,0.1)', border: '1px solid #64d2ff', color: '#64d2ff', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
              Rescan Frame
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
