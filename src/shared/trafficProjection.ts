// src/shared/trafficProjection.ts
// Uganda fleet composition 2026 — MoWT Traffic Surveys
// M class = Grade-Separated Highways (NOT urban/Kampala)

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
