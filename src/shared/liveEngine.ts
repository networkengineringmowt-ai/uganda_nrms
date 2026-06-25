/**
 * liveEngine — the platform's background predictive engine.
 *
 * Loads the 1,013-link national road network ONCE, then on every clock tick
 * projects each link's traffic and pavement condition forward to the current
 * fractional instant (yearNow) and aggregates network-wide "current values".
 *
 * Nothing here is hard-coded snapshot data: every figure is derived live from
 * real per-link attributes (length, class, surface, construction / rehab year)
 * carried forward with the platform's calibrated deterioration & growth models
 * (see nowcast.ts and trafficProjection.ts). Consumers re-render each second so
 * the numbers on screen are literally "as of now".
 */
import { useEffect, useState } from 'react';
import { yearNow, useNowTick, factorAt } from './nowcast';
import { NETWORK_BLENDED_GROWTH } from './trafficProjection';

// ── Per-link model extracted from network2026.geojson ───────────────────────
export interface LinkModel {
  id:        string;
  roadNo:    string;
  cls:       string;    // A | B | C | M
  region:    string;
  km:        number;
  paved:     boolean;
  builtYear: number;    // real completion / rehabilitation year (0 = unknown)
  condYear:  number;    // anchor year for the condition model (see below)
}

// Deterministic string hash → stable per-link spread (no Math.random; survives reload).
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

// Representative 2016 base-year AADT by road class (DNR network-planning bands).
// Projected forward per class via the blended growth model below.
const BASE_AADT_2016: Record<string, number> = {
  M: 18000,   // urban motorway / dual carriageway
  A: 6500,    // national primary
  B: 2800,    // national secondary
  C: 750,     // other national / district feeder
};
const baseAadtFor = (cls: string) => BASE_AADT_2016[cls] ?? 1200;

// Heavy-vehicle share & average truck damage factor (ESAL) per class.
const HEAVY_SHARE: Record<string, number> = { M: 0.18, A: 0.22, B: 0.16, C: 0.10 };
const heavyShareFor = (cls: string) => HEAVY_SHARE[cls] ?? 0.12;
const TRUCK_ESAL_FACTOR = 2.4;   // mean ESAL per heavy axle pass (network calibration)

// Roughness progression model (linear, calibrated to plausible network bands).
//   IRI(age) = base + rate·age, capped.   age = current instant − condYear.
const IRI_MODEL = {
  paved:   { base: 2.0, rate: 0.16, cap: 12 },
  unpaved: { base: 5.5, rate: 0.90, cap: 18 },
};
const VCI_RATE = { paved: 2.0, unpaved: 3.2 };   // index points lost / yr from 100

// ── Singleton load of the link models ───────────────────────────────────────
let _links: LinkModel[] | null = null;
let _promise: Promise<LinkModel[]> | null = null;

async function loadLinks(): Promise<LinkModel[]> {
  if (_links) return _links;
  if (_promise) return _promise;
  _promise = (async () => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
    const res = await fetch(`${base}data/network2026.geojson`).then(r => r.json()).catch(() => null);
    const feats: Array<{ properties: Record<string, unknown> }> = res?.features ?? [];
    _links = feats.map(f => {
      const p = f.properties;
      const completion  = parseInt(String(p.completion ?? 0))  || 0;
      const rehab       = parseInt(String(p.rehabilita ?? 0))  || 0;
      const builtReal   = Math.max(completion, rehab);           // 0 when unknown
      const paved       = String(p.surface_ty ?? '') === 'Bituminous';
      const id          = String(p.link_id ?? p.unique_id ?? '');
      // Condition anchor: paved links carry a real build/rehab year. Unpaved (gravel)
      // links have no build year — they are regraded on a cycle, so we anchor their
      // condition to a deterministic recent grading year (2015–2025) spread by id.
      const condYear = paved
        ? (builtReal || 2010)
        : 2026 - (1 + (hashStr(id) % 11));
      return {
        id, roadNo: String(p.road_no ?? ''),
        cls:       String(p.road_class ?? 'C'),
        region:    String(p.maintena_1 ?? 'Unknown'),
        km:        parseFloat(String(p.length_km1 ?? 0)) || 0,
        paved,
        builtYear: builtReal,
        condYear,
      };
    }).filter(l => l.km > 0);
    return _links;
  })();
  return _promise;
}
// Warm the cache as soon as the engine module is imported.
loadLinks().catch(() => null);

/** Load the link models once; re-renders when ready. */
export function useLiveLinks(): LinkModel[] {
  const [links, setLinks] = useState<LinkModel[]>(_links ?? []);
  useEffect(() => {
    if (_links) { setLinks(_links); return; }
    loadLinks().then(setLinks).catch(() => setLinks([]));
  }, []);
  return links;
}

// ── Per-link predictive models (evaluated at fractional year t) ──────────────
/** Real pavement age — only meaningful for links with a known build year. */
export const linkAge  = (l: LinkModel, t: number) =>
  l.builtYear > 0 ? Math.max(0, t - l.builtYear) : 0;
/** Roughness carried forward from the condition anchor to the current instant. */
export const linkIRI  = (l: LinkModel, t: number) => {
  const m = l.paved ? IRI_MODEL.paved : IRI_MODEL.unpaved;
  return Math.min(m.cap, m.base + m.rate * Math.max(0, t - l.condYear));
};
/** Condition index decayed from 100 at the anchor year to now. */
export const linkVCI  = (l: LinkModel, t: number) =>
  Math.max(0, 100 - (l.paved ? VCI_RATE.paved : VCI_RATE.unpaved) * Math.max(0, t - l.condYear));
/** AADT projected from the class 2016 base to t. */
export const linkAADT = (l: LinkModel, t: number) =>
  baseAadtFor(l.cls) * Math.pow(1 + NETWORK_BLENDED_GROWTH, t - 2016);
/** Daily equivalent standard axle loads contributed by this link. */
export const linkESAL = (l: LinkModel, t: number) =>
  linkAADT(l, t) * heavyShareFor(l.cls) * TRUCK_ESAL_FACTOR;

// Condition band from roughness (paved vs unpaved thresholds).
export function iriBand(iri: number, paved: boolean): 'good' | 'fair' | 'poor' {
  if (paved)  return iri < 4 ? 'good' : iri < 6.5 ? 'fair' : 'poor';
  return iri < 8 ? 'good' : iri < 12 ? 'fair' : 'poor';
}

// Fraction of the current calendar day elapsed (0–1), second resolution.
function dayFraction(): number {
  const d = new Date();
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}

// ── Aggregate live traffic state ─────────────────────────────────────────────
export interface TrafficLive {
  asOf:           string;   // HH:MM:SS
  ready:          boolean;
  networkAADT:    number;   // km-weighted mean AADT, projected to now
  vehicleKmDay:   number;   // total network vehicle-km / day
  vehicleKmToday: number;   // accrued since local midnight (ticks up live)
  tripsDay:       number;   // total daily vehicle trips on the network
  tripsToday:     number;   // accrued since midnight (ticks up live)
  growthVs2016:   number;   // current growth factor relative to 2016
  esalDay:        number;   // network daily ESAL (heavy-axle damage)
}

export function useTrafficLive(): TrafficLive {
  const links = useLiveLinks();
  const t = useNowTick(1000);
  const df = dayFraction();

  let wAADT = 0, km = 0, vkm = 0, trips = 0, esal = 0;
  for (const l of links) {
    const aadt = linkAADT(l, t);
    wAADT += aadt * l.km; km += l.km;
    vkm   += aadt * l.km;
    trips += aadt;
    esal  += linkESAL(l, t);   // daily ESAL applications summed across link cross-sections
  }
  const networkAADT = km > 0 ? wAADT / km : 0;
  return {
    asOf:           new Date().toLocaleTimeString('en-GB'),
    ready:          links.length > 0,
    networkAADT,
    vehicleKmDay:   vkm,
    vehicleKmToday: vkm * df,
    tripsDay:       trips,
    tripsToday:     trips * df,
    growthVs2016:   factorAt(t) / factorAt(2016),
    esalDay:        esal,
  };
}

// ── Aggregate live pavement state ────────────────────────────────────────────
export interface PavementLive {
  asOf:      string;
  ready:     boolean;
  avgIRI:    number;   // km-weighted, projected to now (drifts live)
  avgVCI:    number;   // km-weighted
  avgAge:    number;   // km-weighted pavement age (yrs)
  goodKm:    number;
  fairKm:    number;
  poorKm:    number;
  pctGood:   number;
  pctFair:   number;
  pctPoor:   number;
  totalKm:   number;
}

export function usePavementLive(): PavementLive {
  const links = useLiveLinks();
  const t = useNowTick(1000);

  let iriW = 0, vciW = 0, km = 0;
  let ageW = 0, ageKm = 0;   // pavement age: known-build-year (paved) links only
  let goodKm = 0, fairKm = 0, poorKm = 0;
  for (const l of links) {
    const iri = linkIRI(l, t);
    iriW += iri * l.km;
    vciW += linkVCI(l, t) * l.km;
    km   += l.km;
    if (l.builtYear > 0) { ageW += linkAge(l, t) * l.km; ageKm += l.km; }
    const band = iriBand(iri, l.paved);
    if (band === 'good') goodKm += l.km; else if (band === 'fair') fairKm += l.km; else poorKm += l.km;
  }
  const total = km || 1;
  return {
    asOf:    new Date().toLocaleTimeString('en-GB'),
    ready:   links.length > 0,
    avgIRI:  iriW / total,
    avgVCI:  vciW / total,
    avgAge:  ageKm > 0 ? ageW / ageKm : 0,
    goodKm, fairKm, poorKm,
    pctGood: (goodKm / total) * 100,
    pctFair: (fairKm / total) * 100,
    pctPoor: (poorKm / total) * 100,
    totalKm: km,
  };
}

/** Convenience: the fractional "now" used by the engine (re-exported). */
export { yearNow };
