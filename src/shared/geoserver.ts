/**
 * geoserver.ts — optional GeoNode/GeoServer WMS integration for the NRMS platform.
 *
 * When VITE_GEOSERVER_WMS_URL is set (e.g. http://localhost/geoserver/ows for a
 * local GeoNode, or https://gis.unra.go.ug/geoserver/ows for a hosted one) the
 * GIS section can overlay the enterprise GeoNode layers as live WMS tiles.
 * When it is unset / the server is offline, callers fall back to the bundled
 * GeoJSON layers — nothing breaks.
 *
 * See geonode/ for the GeoNode stack that publishes these layers.
 */

export const GEOSERVER_WMS_URL: string =
  (import.meta.env.VITE_GEOSERVER_WMS_URL as string | undefined)?.replace(/\/+$/, '') || '';

export const GEOSERVER_ENABLED = GEOSERVER_WMS_URL.length > 0;

/** Workspace the import script publishes Uganda NRMS layers under. */
export const GEONODE_WORKSPACE =
  (import.meta.env.VITE_GEOSERVER_WORKSPACE as string | undefined) || 'geonode';

export interface WmsLayerDef {
  id: string;
  /** GeoServer layer name (workspace:layer). */
  layer: string;
  label: string;
  /** Optional published SLD style name. */
  style?: string;
  group: 'Network' | 'Structures' | 'Traffic' | 'Context';
}

/** Layers published by geonode/scripts/import_layers.sh (see layers_config.yml). */
export const GEONODE_LAYERS: WmsLayerDef[] = [
  { id: 'roads',        layer: `${GEONODE_WORKSPACE}:national_road_network`, label: 'National Road Network', style: 'road_network',    group: 'Network' },
  { id: 'condition',    layer: `${GEONODE_WORKSPACE}:road_condition`,        label: 'Pavement Condition (IRI)', style: 'road_condition', group: 'Network' },
  { id: 'district',     layer: `${GEONODE_WORKSPACE}:district_roads`,        label: 'District Roads',        style: 'road_network',    group: 'Network' },
  { id: 'bridges',      layer: `${GEONODE_WORKSPACE}:bridges`,               label: 'Bridges',               style: 'bridges',         group: 'Structures' },
  { id: 'culverts',     layer: `${GEONODE_WORKSPACE}:major_culverts`,        label: 'Major Culverts',        style: 'bridges',         group: 'Structures' },
  { id: 'atc',          layer: `${GEONODE_WORKSPACE}:traffic_count_stations`,label: 'Traffic Count Stations',style: 'traffic_stations',group: 'Traffic' },
  { id: 'weighbridges', layer: `${GEONODE_WORKSPACE}:weighbridges`,          label: 'Weighbridges',          style: 'traffic_stations',group: 'Traffic' },
  { id: 'stations',     layer: `${GEONODE_WORKSPACE}:mowt_stations`,         label: 'Maintenance Stations',  style: 'traffic_stations',group: 'Traffic' },
  { id: 'districts',    layer: `${GEONODE_WORKSPACE}:districts`,             label: 'District Boundaries',   group: 'Context' },
  { id: 'protected',    layer: `${GEONODE_WORKSPACE}:protected_areas`,       label: 'Protected Areas',       group: 'Context' },
];

/** Base props for a react-leaflet <WMSTileLayer/>. */
export function wmsProps(def: WmsLayerDef) {
  return {
    url: GEOSERVER_WMS_URL,
    layers: def.layer,
    styles: def.style ?? '',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    attribution: 'MoWT · DNR · GeoNode',
  };
}

/** Quick liveness probe (GetCapabilities) — used to decide WMS vs GeoJSON fallback. */
export async function geoserverOnline(timeoutMs = 4000): Promise<boolean> {
  if (!GEOSERVER_ENABLED) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(
      `${GEOSERVER_WMS_URL}?service=WMS&version=1.3.0&request=GetCapabilities`,
      { signal: ctrl.signal, mode: 'cors' },
    );
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
