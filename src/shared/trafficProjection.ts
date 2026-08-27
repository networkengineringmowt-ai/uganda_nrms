// src/shared/trafficProjection.ts
// Uganda fleet composition 2026 - MoWT Traffic Surveys
// M class = Grade-Separated Highways (NOT urban/Kampala)

import { CURRENT_YEAR } from './year';
export { CURRENT_YEAR };

export interface VehicleClass {
  id: string; label: string; sharePct: number; growthRate: number; avgOccupancy?: number;
}

export const UGANDA_FLEET: VehicleClass[] = [
  { id: 'MC',  label: 'Motorcycles',      sharePct: 38, growthRate: 0.045 },
  { id: 'CAR', label: 'Cars & Taxis',      sharePct: 31, growthRate: 0.032, avgOccupancy: 2.1 },
  { id: 'MB',  label: 'Minibus',           sharePct: 8,  growthRate: 0.028, avgOccupancy: 14 },
  { id: 'BUS', label: 'Bus',               sharePct: 4,  growthRate: 0.020, avgOccupancy: 45 },
  { id: 'LT',  label: 'Light Truck',       sharePct: 7,  growthRate: 0.035 },
  { id: 'MT',  label: 'Medium Truck',      sharePct: 5,  growthRate: 0.030 },
  { id: 'HT',  label: 'Heavy Truck',       sharePct: 4,  growthRate: 0.025 },
  { id: 'AT',  label: 'Articulated Truck', sharePct: 2,  growthRate: 0.022 },
  { id: 'NMT', label: 'Other/NMT',         sharePct: 1,  growthRate: 0.010 },
];

export const BLENDED_GROWTH_RATE = 0.032;
export const BASE_YEAR = 2022;

export function projectAadt(baseAadt: number, targetYear = 2026): number {
  return Math.round(baseAadt * Math.pow(1 + BLENDED_GROWTH_RATE, targetYear - BASE_YEAR));
}

export function breakdownByClass(totalAadt: number): Record<string, number> {
  return Object.fromEntries(UGANDA_FLEET.map(v => [v.label, Math.round(totalAadt * v.sharePct / 100)]));
}

export function adtExclMotorcycles(totalAadt: number): number {
  const mcShare = UGANDA_FLEET.find(v => v.id === 'MC')?.sharePct ?? 38;
  return Math.round(totalAadt * (1 - mcShare / 100));
}

export const ROAD_CLASS_LABELS: Record<string, string> = {
  A: 'National Highway (A)', B: 'National Road (B)', C: 'Regional Road (C)',
  D: 'District Road (D)', M: 'Grade-Separated Highway (M)', U: 'Urban Road (U)',
};

// ─── Backward-compatible aliases for legacy consumers ──────────────────────
// A handful of older components (TabularSummaries, TrafficProjectionTable,
// TrafficLegacyContent, TrafficSection) were written against an earlier,
// richer surface of this module. Rather than rewrite each consumer, this
// re-exposes the same primitives above under those names.

export const NETWORK_BLENDED_GROWTH = BLENDED_GROWTH_RATE;

const VC_KEY: Record<string, string> = {
  MC: 'motorcycles', CAR: 'cars_taxis', MB: 'minibus', BUS: 'bus',
  LT: 'light_truck', MT: 'medium_truck', HT: 'heavy_truck', AT: 'trailer',
  NMT: 'other_nmt',
};

export interface VcClass {
  key: string; label: string; short: string; share: number; growth: number;
}

export const VC_CLASSES: VcClass[] = UGANDA_FLEET.map(v => ({
  key: VC_KEY[v.id] ?? v.id.toLowerCase(),
  label: v.label,
  short: v.id,
  share: v.sharePct / 100,
  growth: v.growthRate,
}));

export const VC_GROWTH: Record<string, number> = Object.fromEntries(
  VC_CLASSES.map(c => [c.key, c.growth])
);

/** Project a single class's base count forward at a fixed growth rate. */
export function projectClass(classBase: number, baseYear: number, growth: number, toYear: number = CURRENT_YEAR): number {
  return classBase * Math.pow(1 + growth, toYear - baseYear);
}

/** Project every vehicle class from a total AADT for a given base/target year. */
export function projectAllClasses(totalAadt: number, baseYear: number, toYear: number = CURRENT_YEAR) {
  return VC_CLASSES.map(c => {
    const baseCount = totalAadt * c.share;
    const projCount = projectClass(baseCount, baseYear, c.growth, toYear);
    return { key: c.key, label: c.label, short: c.short, baseCount, projCount, growth: c.growth };
  });
}

/** Total AADT (summed across all classes) projected to a target year. */
export function projectAADTByClass(totalAadt: number, baseYear: number, toYear: number = CURRENT_YEAR): number {
  return projectAllClasses(totalAadt, baseYear, toYear).reduce((s, c) => s + c.projCount, 0);
}

export { projectAadt as projectAADT };
