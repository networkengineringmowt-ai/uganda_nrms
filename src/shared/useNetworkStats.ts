/**
 * useNetworkStats - single source of truth for all network KPIs.
 *
 * Loads network2026.geojson (1,014 links as of the current dataset - this
 * count moves as links are added/split/merged, so tabs must always read it
 * from this hook rather than repeating a snapshot number) and
 * bridges2026.geojson once, computes every statistic used across the
 * platform, and caches the result. All tabs MUST import this hook instead
 * of hardcoding numbers - a hardcoded copy of totalKm/totalLinks WILL drift
 * from this hook's live count the next time the source GeoJSON changes.
 *
 * Data vintage: DNR GIS Section 18 Jun 2025
 */

/**
 * Official total network length - Department of National Roads FY 2025/26.
 * Source: NDPIV Investment Programme FY 2025–2026 (MoWT/DNR, June 2025).
 * This is the gazetted figure; it differs from GeoJSON-computed totalKm
 * because some links (mainly unclassified / recently gazetted roads) are
 * not yet in the GIS dataset.
 */
export const OFFICIAL_NETWORK_KM = 21302;
import { useState, useEffect } from 'react';

export interface NetworkStats {
  // Totals - GeoJSON mapped vs official Department of National Roads figure
  totalKm: number;       // from network2026.geojson (mapped)
  officialKm: number;    // = OFFICIAL_NETWORK_KM (21,302 km) - NDPIV FY25/26
  totalLinks: number;
  // Surface
  pavedKm: number;
  unpavedKm: number;
  pavedPct: number;
  // Road class
  classKm: Record<string, number>;
  classLinks: Record<string, number>;
  classPavedKm: Record<string, number>;
  classUnpavedKm: Record<string, number>;
  // Region
  regionKm: Record<string, number>;
  regionLinks: Record<string, number>;
  regionPavedKm: Record<string, number>;
  regionUnpavedKm: Record<string, number>;
  // Structures
  totalBridges: number;
  // Survey vintage
  dataVintage: string;
  loaded: boolean;
  error?: string;
}

// Condition stats from bot_results Q12 (surveyed subset only - not full network)
export interface SurveyedCondition {
  totalSurveyedLinks: number;
  goodLinks: number;
  fairLinks: number;
  poorLinks: number;
  criticalLinks: number;
  meanIri: number;
  meanPci: number;
}

// Module-level singleton cache
let _cache: NetworkStats | null = null;
let _promise: Promise<NetworkStats> | null = null;

async function _load(): Promise<NetworkStats> {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = (async () => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;

    const [netRes, bridgeRes] = await Promise.all([
      fetch(`${base}data/network2026.geojson`).then(r => r.json()).catch(() => null),
      fetch(`${base}data/bridges2026.geojson`).then(r => r.json()).catch(() => null),
    ]);

    if (!netRes || !Array.isArray(netRes.features)) {
      throw new Error('Failed to load road network GeoJSON');
    }

    const features: Array<{ properties: Record<string, unknown> }> = netRes.features;

    let totalKm = 0;
    let pavedKm = 0;
    let unpavedKm = 0;
    const classKm: Record<string, number> = {};
    const classLinks: Record<string, number> = {};
    const classPavedKm: Record<string, number> = {};
    const classUnpavedKm: Record<string, number> = {};
    const regionKm: Record<string, number> = {};
    const regionLinks: Record<string, number> = {};
    const regionPavedKm: Record<string, number> = {};
    const regionUnpavedKm: Record<string, number> = {};

    for (const feat of features) {
      const p = feat.properties;
      const km = parseFloat(String(p.length_km1 ?? 0)) || 0;
      const cls = String(p.road_class ?? 'Unknown');
      const region = String(p.maintena_1 ?? 'Unknown');
      const surface = String(p.surface_ty ?? '');
      const isPaved = surface === 'Bituminous';

      totalKm += km;
      if (isPaved) pavedKm += km;
      else unpavedKm += km;

      classKm[cls] = (classKm[cls] ?? 0) + km;
      classLinks[cls] = (classLinks[cls] ?? 0) + 1;
      regionKm[region] = (regionKm[region] ?? 0) + km;
      regionLinks[region] = (regionLinks[region] ?? 0) + 1;
      if (isPaved) {
        classPavedKm[cls] = (classPavedKm[cls] ?? 0) + km;
        regionPavedKm[region] = (regionPavedKm[region] ?? 0) + km;
      } else {
        classUnpavedKm[cls] = (classUnpavedKm[cls] ?? 0) + km;
        regionUnpavedKm[region] = (regionUnpavedKm[region] ?? 0) + km;
      }
    }

    const totalBridges = bridgeRes?.features?.length ?? 546;

    _cache = {
      totalKm:     Math.round(totalKm),
      officialKm:  OFFICIAL_NETWORK_KM,
      totalLinks:  features.length,
      pavedKm:     Math.round(pavedKm),
      unpavedKm:   Math.round(unpavedKm),
      pavedPct:    totalKm > 0 ? parseFloat(((pavedKm / totalKm) * 100).toFixed(1)) : 0,
      classKm:     Object.fromEntries(Object.entries(classKm).map(([k, v]) => [k, Math.round(v)])),
      classLinks,
      classPavedKm:   Object.fromEntries(Object.entries(classPavedKm).map(([k, v]) => [k, Math.round(v)])),
      classUnpavedKm: Object.fromEntries(Object.entries(classUnpavedKm).map(([k, v]) => [k, Math.round(v)])),
      regionKm:    Object.fromEntries(Object.entries(regionKm).map(([k, v]) => [k, Math.round(v)])),
      regionLinks,
      regionPavedKm:   Object.fromEntries(Object.entries(regionPavedKm).map(([k, v]) => [k, Math.round(v)])),
      regionUnpavedKm: Object.fromEntries(Object.entries(regionUnpavedKm).map(([k, v]) => [k, Math.round(v)])),
      totalBridges,
      dataVintage: 'DNR GIS / NDPIV FY25-26',
      loaded: true,
    };

    return _cache;
  })();

  return _promise;
}

export function useNetworkStats(): NetworkStats {
  const [stats, setStats] = useState<NetworkStats>(
    _cache ?? {
      totalKm: 21137, officialKm: OFFICIAL_NETWORK_KM, totalLinks: 1014,
      pavedKm: 6405, unpavedKm: 14732, pavedPct: 30.3,
      classKm: { A: 2605, B: 2860, C: 15527, M: 145 },
      classLinks: { A: 89, B: 77, C: 770, M: 78 },
      classPavedKm: { A: 2605, B: 1805, C: 1851, M: 145 },
      classUnpavedKm: { A: 0, B: 1055, C: 13676, M: 0 },
      regionKm: { Central: 4760, Eastern: 2765, 'North Eastern': 2666, Northern: 4604, Southern: 3551, Western: 2791 },
      regionLinks: { Central: 322, Eastern: 157, 'North Eastern': 93, Northern: 158, Southern: 173, Western: 111 },
      regionPavedKm: { Central: 1791, Eastern: 845, 'North Eastern': 446, Northern: 947, Southern: 1119, Western: 1257 },
      regionUnpavedKm: { Central: 2969, Eastern: 1920, 'North Eastern': 2220, Northern: 3657, Southern: 2432, Western: 1534 },
      totalBridges: 546,
      dataVintage: 'DNR GIS / NDPIV FY25-26',
      loaded: !!_cache,
    }
  );

  useEffect(() => {
    if (_cache) return;
    _load()
      .then(s => setStats(s))
      .catch(e => setStats(prev => ({ ...prev, error: String(e), loaded: true })));
  }, []);

  return stats;
}

/** Sync accessor - returns defaults if not yet loaded. Safe to call outside React. */
export function getNetworkStats(): NetworkStats {
  return _cache ?? {
    totalKm: 21137, officialKm: OFFICIAL_NETWORK_KM, totalLinks: 1014,
    pavedKm: 6405, unpavedKm: 14732, pavedPct: 30.3,
    classKm: { A: 2605, B: 2860, C: 15527, M: 145 },
    classLinks: { A: 89, B: 77, C: 770, M: 78 },
    classPavedKm: { A: 2605, B: 1805, C: 1851, M: 145 },
    classUnpavedKm: { A: 0, B: 1055, C: 13676, M: 0 },
    regionKm: { Central: 4760, Eastern: 2765, 'North Eastern': 2666, Northern: 4604, Southern: 3551, Western: 2791 },
    regionLinks: { Central: 322, Eastern: 157, 'North Eastern': 93, Northern: 158, Southern: 173, Western: 111 },
    regionPavedKm: { Central: 1791, Eastern: 845, 'North Eastern': 446, Northern: 947, Southern: 1119, Western: 1257 },
    regionUnpavedKm: { Central: 2969, Eastern: 1920, 'North Eastern': 2220, Northern: 3657, Southern: 2432, Western: 1534 },
    totalBridges: 546,
    dataVintage: 'DNR GIS Jun 2025',
    loaded: false,
  };
}

// Preload on module import so data is ready by the time components mount
_load().catch(() => null);
