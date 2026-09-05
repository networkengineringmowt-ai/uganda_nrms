/**
 * MapGISControls - Google-Earth-Pro-style map toolbar for Leaflet maps.
 * Renders zoom in/out, full-extent (home), pan/select/measure tool modes,
 * and a live measure-distance readout. Must be mounted as a child of
 * <MapContainer> (uses react-leaflet's useMap/useMapEvents hooks).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ZoomIn, ZoomOut, Home, MousePointer2, Hand, Ruler, X } from 'lucide-react';

type Tool = 'pan' | 'select' | 'measure';

export interface MapGISControlsProps {
  /** Fallback center used for "Full Extent" when `bounds` is not supplied. */
  homeCenter?: [number, number];
  homeZoom?: number;
  /** Preferred full-extent target - fits the map to these bounds. */
  bounds?: L.LatLngBoundsExpression;
  position?: 'bottomright' | 'topright' | 'bottomleft' | 'topleft';
  /** Accent colour for active-tool highlighting (defaults to platform cyan). */
  accent?: string;
  /** Fine-tune placement (e.g. to clear another overlay already in that corner). */
  style?: CSSProperties;
}

/** Approximate national bounding box - used as the default "Full Extent" target. */
export const UGANDA_BOUNDS: L.LatLngBoundsExpression = [[-1.6, 29.4], [4.3, 35.2]];

function fmtDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m.toFixed(0)} m`;
}

export default function MapGISControls({
  homeCenter = [1.4, 32.3],
  homeZoom = 7,
  bounds = UGANDA_BOUNDS,
  position = 'bottomright',
  accent = '#64d2ff',
  style,
}: MapGISControlsProps) {
  const map = useMap();
  const [tool, setTool] = useState<Tool>('pan');
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const lineRef = useRef<L.Polyline | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The toolbar is a plain DOM child of the map container (not a real Leaflet
  // control), so without this, clicks on its buttons bubble to the map and
  // register as measure-tool clicks, and scrolling over it zooms the map.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // Dedicated layer group for measurement graphics - created once per map instance.
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;
    return () => { group.remove(); };
  }, [map]);

  const clearMeasure = useCallback(() => {
    groupRef.current?.clearLayers();
    lineRef.current = null;
    setPoints([]);
  }, []);

  useMapEvents({
    click(e) {
      if (tool !== 'measure') return;
      const group = groupRef.current;
      if (!group) return;
      L.circleMarker(e.latlng, {
        radius: 4, color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 1, weight: 1.5,
      }).addTo(group);
      setPoints(prev => {
        const next = [...prev, e.latlng];
        if (next.length > 1) {
          if (lineRef.current) lineRef.current.setLatLngs(next);
          else lineRef.current = L.polyline(next, { color: '#fbbf24', weight: 2, dashArray: '5 4' }).addTo(group);
        }
        return next;
      });
    },
  });

  // Cursor feedback per active tool.
  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = tool === 'measure' ? 'crosshair' : '';
  }, [tool, map]);

  const totalDistance = useMemo(() => {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += points[i - 1].distanceTo(points[i]);
    return d;
  }, [points]);

  function selectTool(t: Tool) {
    setTool(t);
    if (t !== 'measure') clearMeasure();
  }

  function fullExtent() {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
    else map.setView(homeCenter, homeZoom);
  }

  const posStyle: CSSProperties =
    position === 'bottomright' ? { bottom: 24, right: 12 } :
    position === 'topright'    ? { top: 12, right: 12 } :
    position === 'bottomleft'  ? { bottom: 24, left: 12 } :
    { top: 12, left: 12 };

  return (
    <div ref={rootRef} style={{ position: 'absolute', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, ...posStyle, ...style }}>
      <div style={toolbarStyle}>
        <GBtn title="Zoom in" onClick={() => map.zoomIn()} accent={accent}><ZoomIn size={14}/></GBtn>
        <GBtn title="Zoom out" onClick={() => map.zoomOut()} accent={accent}><ZoomOut size={14}/></GBtn>
        <GBtn title="Full extent" onClick={fullExtent} accent={accent}><Home size={14}/></GBtn>
      </div>
      <div style={toolbarStyle}>
        <GBtn title="Pan" active={tool === 'pan'} onClick={() => selectTool('pan')} accent={accent}><Hand size={14}/></GBtn>
        <GBtn title="Select / inspect" active={tool === 'select'} onClick={() => selectTool('select')} accent={accent}><MousePointer2 size={14}/></GBtn>
        <GBtn title="Measure distance" active={tool === 'measure'} onClick={() => selectTool('measure')} accent={accent}><Ruler size={14}/></GBtn>
      </div>
      {tool === 'measure' && (
        <div style={{ ...toolbarStyle, flexDirection: 'column', alignItems: 'stretch', padding: '8px 10px', minWidth: 152 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(251,191,36,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Measure Distance
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>{fmtDistance(totalDistance)}</div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>
            {points.length} point{points.length !== 1 ? 's' : ''} · click map to add
          </div>
          {points.length > 0 && (
            <button onClick={clearMeasure} style={{
              marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer',
            }}>
              <X size={11}/> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: 'flex', gap: 2, padding: 4, borderRadius: 8,
  background: 'rgba(6,13,24,0.9)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(100, 210, 255,0.15)',
};

function GBtn({ children, onClick, title, active, accent }: {
  children: ReactNode; onClick: () => void; title: string; active?: boolean; accent: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6, cursor: 'pointer', border: active ? `1px solid ${accent}80` : '1px solid transparent',
      background: active ? `${accent}26` : 'transparent',
      color: active ? accent : 'rgba(226,234,244,0.75)',
    }}>
      {children}
    </button>
  );
}
