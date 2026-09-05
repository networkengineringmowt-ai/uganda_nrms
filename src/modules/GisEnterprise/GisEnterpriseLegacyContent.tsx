import React, { useState } from 'react';
import { Layers, Database, Monitor, Globe, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, WMSTileLayer, ZoomControl } from 'react-leaflet';
import { GEOSERVER_WMS_URL, GEONODE_LAYERS } from '../../shared/geoserver';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import 'leaflet/dist/leaflet.css';
import SectionDashboard from '../Dashboard/SectionDashboard';

const N = {
  indigo: '#5e5ce6', cyan:   '#00f5ff', orange: '#ff6b35',
  teal:   '#00d4aa', blue:   '#4d9fff', purple: '#b967ff',
  green:  '#00ff88', yellow: '#ffd23f', pink:   '#ff2d78',
  gray:   '#94a3b8',
};

export default function GisEnterpriseLegacyContent({ hideTabBar }: { hideTabBar?: boolean } = {}) {
  const [wmsOnline, setWmsOnline] = useState<boolean | null>(null);
  const [tab, setTab] = useState('map');

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 overflow-y-auto">
      {/* GisEnterprise tab nav */}
      {!hideTabBar && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {['dashboard', 'map'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', background: tab === t ? '#4d9fff' : 'rgba(77, 159, 255,0.08)', color: tab === t ? '#020202' : 'rgba(77, 159, 255,0.7)', transition: 'all .15s' }}>
            {t === 'map' ? 'GIS Map' : 'Dashboard'}
          </button>
        ))}
      </div>
      )}
      {tab === 'dashboard' && <SectionDashboard sectionId="gisenterprise" accent="#4d9fff" />}
      {tab === 'map' && (<>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Layers className="text-purple-400" size={26} />
            GIS Enterprise Architecture
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Tier-by-tier breakdown of components, modules, interactions, and design principles.
          </p>
        </div>
      </div>

      {/* Dashboard stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { v: '5',      l: 'ARCHITECTURE TIERS',   c: '#c084fc' },
          { v: '1,014',  l: 'GIS ROAD LINKS',       c: '#00f5ff' },
          { v: '312',    l: 'BRIDGES MAPPED',       c: '#60a5fa' },
          { v: '234',    l: 'CULVERTS MAPPED',      c: '#38bdf8' },
          { v: 'WMS/WFS',l: 'OGC SERVICES LIVE',    c: '#00ff88' },
        ].map(k => (
          <div key={k.l} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4" style={{ borderLeft: `3px solid ${k.c}` }}>
            <div className="text-2xl font-black" style={{ color: k.c }}>{k.v}</div>
            <div className="text-[11px] font-bold text-slate-300 tracking-wider mt-1">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Tier 4 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <Database className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-slate-200">Tier 4: Data Layer</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            The relational and spatial database backend. Replaces ArcGIS Data Store.
          </p>
          <div className="space-y-2">
            <Badge label="Supabase PostgreSQL" color="blue" />
            <Badge label="PostGIS Spatial Ext." color="blue" />
          </div>
        </div>

        {/* Tier 3 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-md border-t-2 border-t-purple-500 shadow-[0_0_15px_rgba(185, 103, 255,0.15)]">
          <div className="flex items-center gap-3 mb-3">
            <Server className="text-purple-400" size={20} />
            <h2 className="text-lg font-bold text-slate-200">Tier 3: Services (Logic)</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Spatial publishing and processing. Replaces ArcGIS Server & Portal.
          </p>
          <div className="space-y-2">
            <Badge label="GeoServer (Docker)" color="purple" />
            <Badge label="OGC WMS / WFS" color="purple" />
          </div>
        </div>

        {/* Tier 1 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <Monitor className="text-cyan-400" size={20} />
            <h2 className="text-lg font-bold text-slate-200">Tier 1: Presentation</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            The user interfaces consuming the services. Replaces Map Viewer & Pro.
          </p>
          <div className="space-y-2 flex flex-wrap gap-2">
            <Badge label="React Web App" color="cyan" />
            <Badge label="QGIS Desktop" color="cyan" />
            <Badge label="Leaflet JS" color="cyan" />
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[500px]">
        {/* Map Demo Area */}
        <div className="lg:col-span-3 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden relative shadow-xl">
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start pointer-events-none">
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide shadow-black drop-shadow-md">Tier 1 $\rightarrow$ Tier 3 Connection Demo</h3>
              <p className="text-slate-300 text-xs drop-shadow-md">Streaming WMS from localhost:8081/geoserver</p>
            </div>
            <div className="bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">GeoServer Listener</span>
            </div>
          </div>
          
          <MapContainer 
            center={[1.3733, 32.2903]} 
            zoom={7} 
            zoomControl={false}
            style={{ height: '100%', width: '100%', backgroundColor: '#0d0d0d' }}
          >
            <ZoomControl position="bottomright" />
            {/* Base map â Esri World Imagery + reference labels (always-on, non-removable) */}
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7} />
            {/* GeoNode / GeoServer WMS layers â configurable via VITE_GEOSERVER_WMS_URL.
                Falls back to a local GeoNode (see geonode/). When offline the tiles
                simply fail and wmsOnline flips false â the rest of the UI is unaffected. */}
            {(() => {
              const base = GEOSERVER_WMS_URL || 'http://localhost/geoserver/ows';
              const show = GEONODE_LAYERS.filter(l => ['roads', 'condition', 'bridges', 'atc'].includes(l.id));
              return show.map((l, i) => (
                <WMSTileLayer
                  key={l.id}
                  url={base}
                  layers={l.layer}
                  styles={l.style ?? ''}
                  format="image/png"
                  transparent={true}
                  version="1.3.0"
                  eventHandlers={i === 0 ? {
                    tileload: () => setWmsOnline(true),
                    tileerror: () => setWmsOnline(false),
                  } : undefined}
                />
              ));
            })()}
          </MapContainer>
        </div>

        {/* Action Panel */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Globe className="text-teal-400" size={18} />
              Setup Automation
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              If the map WMS stream fails to load, ensure you have executed the automated setup bot to configure your datastores and SLD styles.
            </p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[10px] text-slate-300 break-all shadow-inner">
              <span className="text-pink-400">python</span> geoserver_setup_bot.py --db-host "aws-0..." --db-password "***"
            </div>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wider">QGIS Plugin Stack</h4>
              <ul className="text-xs text-slate-400 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500"/> QNEAT3 (Network)</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500"/> pgRouting</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500"/> GeoServer Explorer</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-800/50">
             {wmsOnline === false && (
                <div className="flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>WMS tile error. Ensure GeoServer is running on port 8081 and `road_links` is published.</p>
                </div>
             )}
             {wmsOnline === true && (
                <div className="flex items-start gap-2 text-green-400 text-xs">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <p>Connection active. Streaming vector tiles from local GeoServer instance.</p>
                </div>
             )}
          </div>
        </div>
      </div>
      </>)}
    </div>
  );
}

function Badge({ label, color }: { label: string, color: keyof typeof N }) {
  const hex = N[color];
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return (
    <div className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider" 
         style={{ backgroundColor: `rgba(${r},${g},${b},0.15)`, color: hex, border: `1px solid rgba(${r},${g},${b},0.3)` }}>
      {label}
    </div>
  );
}
