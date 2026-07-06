/**
 * Loads the real GeoJSON bridge/culvert data from /public and augments each
 * feature with synthetic condition ratings, inspection dates, defects, costs
 * and priority scores — all deterministically generated from the structure's
 * own properties so they are stable across page loads.
 */

import type {
  Structure, ConditionRating, TrafficLevel,
  Inspection, WorkOrder, BridgeDocument,
} from '../types';
import {
  seededRandom, seededInt, generateConditionHistory,
  generateDefects, calcPriorityScore, getInspector,
  trafficForRoad, addMonths,
} from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

// ─── Raw GeoJSON feature interfaces ──────────────────────────────────────────

interface BridgeProps {
  bridge_no:   string;
  bridge_nam:  string;
  bridgename:  string;
  link_name:   string;
  roaddescrp:  string;
  roadnumber:  string;
  region:      string;
  km:          number;
  x_new:       number;
  y_new:       number;
  no_of_spans: number;
  no_of_lanes: number;
  no_of_piers: number;
  surface_ty:  string;
  type_cross:  string;
  year_compl:  string | number;
  maintenanc:  string;
  river_1:     string;
  no_of_expa:  number;
}

interface CulvertProps {
  culvert_n: string;
  road:      string;
  link_name: string;
  link_no:   string;
  region:    string;
  type:      string;
  district:  string;
  parish:    string;
  subcounty: string;
  county_2:  string;
  surface_t: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function ratingFromAge(yearBuilt: number, seed: number): ConditionRating {
  const age  = 2024 - yearBuilt;
  let base   = 5 - Math.min(4, Math.floor(age / 15)); // degrades every 15 yr
  const noise = (seededRandom(seed) - 0.5) * 1.6;
  const r    = Math.round(Math.max(1, Math.min(5, base + noise)));
  return r as ConditionRating;
}

function inspectionDates(seed: number, conditionRating: ConditionRating): {
  last: string; next: string; due: boolean;
} {
  // Frequency: critical=6m, poor=12m, fair=18m, good/excellent=24m
  const freqMonths = [0, 6, 12, 18, 24, 24][conditionRating];
  const monthsAgo  = seededInt(seed, 1, freqMonths);
  const last = addMonths('2024-01-01', -monthsAgo);
  const next = addMonths(last, freqMonths);
  const due  = new Date(next) <= new Date('2024-12-31');
  return { last, next, due };
}

function span(seed: number, crossType: string): number {
  const ct = (crossType ?? '').toLowerCase();
  if (ct.includes('river') || ct.includes('stream')) return seededInt(seed, 15, 180);
  if (ct.includes('road') || ct.includes('railway')) return seededInt(seed, 20, 60);
  return seededInt(seed, 5, 40);
}

function width(seed: number, lanes: number): number {
  return Math.max(6, lanes * 3.5 + seededRandom(seed) * 2 - 1);
}

function material(seed: number): string {
  const mats = [
    'Reinforced Concrete', 'Prestressed Concrete', 'Steel Composite',
    'Steel Truss', 'Masonry', 'Timber', 'Steel Girder',
  ];
  return mats[Math.floor(seededRandom(seed) * mats.length)];
}

function replacementCost(spanLen: number, noSpans: number, seed: number): number {
  // UGX: roughly 1–5 Bn depending on size
  const base = spanLen * noSpans * seededInt(seed, 8_000_000, 20_000_000);
  return Math.round(base / 1_000_000) * 1_000_000; // round to nearest 1M
}

function maintenanceCostHistory(seed: number, rating: ConditionRating): { year: number; cost: number }[] {
  return [2020, 2021, 2022, 2023, 2024].map((yr, i) => {
    const base = (6 - rating) * 50_000_000; // worse → more cost
    const var_ = seededRandom(seed + i * 7) * 30_000_000;
    return { year: yr, cost: Math.round((base + var_) / 1_000_000) * 1_000_000 };
  });
}

// ─── Main loader: bridges ─────────────────────────────────────────────────────

// Map a BMS overall-rating (text or numeric) to the 1-5 condition scale.
function ratingFromBms(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  const t = String(v).toLowerCase();
  if (t.includes('excellent') || t.includes('very good')) return 5;
  if (t.includes('good')) return 4;
  if (t.includes('fair')) return 3;
  if (t.includes('poor') && !t.includes('very')) return 2;
  if (t.includes('critical') || t.includes('very poor') || t.includes('failed')) return 1;
  return null;
}

// ─── Main loader — authoritative DNR 2026 inventory ──────────────────────────
// Source: "Bridges and Culverts 2026-FINAL 3.xlsx" (DNR Bridge Section),
// exported to public/data/structures2026.json. Condition ratings are the REAL
// per-structure BMS overall ratings (0–10 scale) with DNR condition categories:
//   0–1 Critical · 2–3 Poor · 4–5 Marginal · 6 Satisfactory · 7–10 Good
// Only inspection scheduling, cost models and defect synthesis remain derived —
// and they are now seeded off the real rating rather than a random one.

const CAT_RATING: Record<string, ConditionRating> = {
  'Critical': 1, 'Poor': 2, 'Marginal': 3, 'Satisfactory': 4, 'Good': 5,
};

interface Struct2026 {
  id: string; oldId: string; name: string; type: 'bridge' | 'culvert';
  river: string; road: string; roadNo: string; linkId: string; roadClass: string;
  km: number | null; lat: number | null; lng: number | null;
  spans?: number | null; piers?: number | null; lanes?: number | null;
  cells?: number | null; spanOrDia?: number | null;
  lengthM: number | null; widthM: number | null;
  completionYear?: number | null; surface: string; station: string; region: string;
  inspector?: string; inspected: string;
  ratings: Record<string, number | null>;
  overallRating: number | null; category: string | null; comment: string;
}

function toStructure(s: Struct2026, idx: number): Structure {
  const id   = (s.id || `${s.type === 'bridge' ? 'B' : 'C'}${idx}`).replace(/\s/g, '');
  const seed = hashStr(id + s.type);

  const underConstruction = s.category === 'Under Construction';
  const condRating = (CAT_RATING[s.category ?? ''] ?? 3) as ConditionRating;

  const yearBuilt = s.completionYear || (1970 + seededInt(seed, 0, 45));
  const noSpans   = s.spans ?? s.cells ?? 1;
  const noLanes   = s.lanes ?? 1;
  const spanLen   = s.lengthM
    ? +(s.lengthM / Math.max(noSpans, 1)).toFixed(1)
    : (s.spanOrDia ?? span(seed + 4, 'River'));
  const w         = s.widthM ? +s.widthM.toFixed(1) : parseFloat(width(seed + 5, noLanes).toFixed(1));
  const road      = s.road || 'Unknown Road';
  const traffic   = trafficForRoad(road, seed + 7) as TrafficLevel;
  const strategic = (s.type === 'bridge'
    ? seededInt(seed + 8, 2, 5)
    : seededInt(seed + 8, 1, 3)) as 1|2|3|4|5;
  const { next, due } = inspectionDates(seed + 9, condRating);

  return {
    id,
    name:         s.name,
    type:         s.type,
    road,
    roadNumber:   s.roadNo || '',
    region:       s.region || 'Central',
    chainage:     s.km != null ? +s.km.toFixed(2) : 0,
    lat:          s.lat ?? 0,
    lng:          s.lng ?? 0,
    spanLength:   spanLen,
    noOfSpans:    noSpans,
    noOfLanes:    noLanes,
    noOfPiers:    s.piers ?? Math.max(0, noSpans - 1),
    width:        w,
    material:     s.type === 'culvert' ? 'Reinforced Concrete' : material(seed + 6),
    crossingType: s.river ? 'River' : 'Stream',
    surfaceType:  s.surface || 'Gravel',
    yearBuilt,
    maintenanceArea: s.station || s.region || 'Regional',
    river:        s.river,
    conditionRating: condRating,
    conditionHistory: generateConditionHistory(seed + 10, condRating, yearBuilt),
    lastInspection:   s.inspected || inspectionDates(seed + 9, condRating).last,
    nextInspection:   next,
    inspectionDue:    due,
    traffic,
    strategicImportance: strategic,
    priorityScore:   underConstruction ? 0 : calcPriorityScore(condRating, traffic, yearBuilt, strategic),
    priorityRank:    0,
    estimatedReplacementCost: replacementCost(spanLen, noSpans, seed + 11),
    maintenanceCostHistory:   maintenanceCostHistory(seed + 12, condRating),
    defects:      underConstruction ? [] : generateDefects(seed + 13, condRating),
    notes:        [
      underConstruction ? 'Under Construction — not condition-rated' : '',
      s.overallRating != null ? `BMS overall rating ${s.overallRating}/10 (${s.category})` : '',
      s.comment,
    ].filter(Boolean).join(' · '),
  };
}

let _structs2026: { bridges: Struct2026[]; culverts: Struct2026[] } | null = null;

async function loadStructures2026() {
  if (_structs2026) return _structs2026;
  const res = await fetch(`${import.meta.env.BASE_URL}data/structures2026.json`);
  _structs2026 = await res.json();
  return _structs2026!;
}

async function loadBridges(): Promise<Structure[]> {
  const data = await loadStructures2026();
  return data.bridges.map((s, i) => toStructure(s, i));
}

async function loadCulverts(): Promise<Structure[]> {
  const data = await loadStructures2026();
  return data.culverts.map((s, i) => toStructure(s, i));
}


// ─── Sample inspections ───────────────────────────────────────────────────────

export function generateSampleInspections(structures: Structure[]): Inspection[] {
  const sample = structures
    .sort((a, b) => a.conditionRating - b.conditionRating)
    .slice(0, 60);                                       // 60 most critical

  return sample.map((s, i) => {
    const seed   = hashStr(s.id + 'INSP') + i;
    const types  = ['Routine', 'Principal', 'Special', 'Emergency'] as const;
    const iType  = types[seededInt(seed, 0, 3)];
    const deck   = seededInt(seed + 1, Math.max(1, s.conditionRating * 2 - 2), Math.min(9, s.conditionRating * 2 + 1));
    const sup    = seededInt(seed + 2, Math.max(1, deck - 1), Math.min(9, deck + 1));
    const sub    = seededInt(seed + 3, Math.max(1, deck - 2), Math.min(9, deck + 2));
    const chan   = seededInt(seed + 4, Math.max(1, sub - 1), Math.min(9, sub + 2));
    const visual = seededInt(seed + 5, (s.conditionRating - 1) * 18, s.conditionRating * 20);

    return {
      id:               uuidv4(),
      structureId:      s.id,
      structureName:    s.name,
      date:             s.lastInspection,
      inspector:        getInspector(seed + 6),
      type:             iType,
      deckRating:       deck,
      superstructureRating: sup,
      substructureRating:   sub,
      channelRating:    chan,
      overallCondition: s.conditionRating,
      visualScore:      Math.min(100, visual),
      findings:         s.defects.join('. ') + '.',
      defects:          s.defects,
      recommendations:  s.conditionRating <= 2
        ? 'Immediate rehabilitation required. Close to traffic pending works.'
        : s.conditionRating === 3
        ? 'Schedule preventive maintenance within 6 months.'
        : 'Continue routine monitoring. No immediate action required.',
      photos:           [`${s.id}_IMG001.jpg`, `${s.id}_IMG002.jpg`],
      nextInspection:   s.nextInspection,
      completedAt:      new Date(s.lastInspection).toISOString(),
    };
  });
}

// ─── Sample work orders ───────────────────────────────────────────────────────

export function generateSampleWorkOrders(structures: Structure[]): WorkOrder[] {
  const critical = structures
    .filter(s => s.conditionRating <= 2)
    .slice(0, 30);

  const types    = ['Routine Maintenance', 'Preventive', 'Rehabilitation', 'Emergency Repair', 'Reconstruction'] as const;
  const statuses = ['Planned', 'In Progress', 'Completed', 'On Hold'] as const;
  const contrs   = [
    'Roko Construction Ltd', 'CICO Ltd', 'Stirling Civil Engineering',
    'Spencon Ltd', 'China Communications Construction', 'Zhongmei Engineering',
    'Victoria Construction', 'Dott Services Ltd',
  ];
  const engs = [
    'ENG-001', 'ENG-002', 'ENG-003', 'ENG-004', 'ENG-005',
  ];

  return critical.map((s, i) => {
    const seed   = hashStr(s.id + 'WO') + i;
    const t      = types[seededInt(seed, 0, 4)];
    const st     = statuses[seededInt(seed + 1, 0, 3)];
    const cost   = s.estimatedReplacementCost * seededRandom(seed + 2) * 0.4;
    const start  = addMonths('2024-01-01', seededInt(seed + 3, -6, 6));
    const dur    = seededInt(seed + 4, 1, 18); // months

    return {
      id:              uuidv4(),
      structureId:     s.id,
      structureName:   s.name,
      title:           `${t} — ${s.name}`,
      description:     `${t} works addressing: ${s.defects.slice(0, 2).join(', ')}.`,
      type:            t,
      status:          st,
      priority:        s.conditionRating <= 1 ? 'Critical' : s.conditionRating === 2 ? 'High' : 'Medium',
      startDate:       start,
      endDate:         addMonths(start, dur),
      cost:            Math.round(cost / 1_000_000) * 1_000_000,
      contractor:      contrs[seededInt(seed + 5, 0, contrs.length - 1)],
      engineerInCharge: engs[seededInt(seed + 6, 0, engs.length - 1)],
      createdAt:       new Date(start).toISOString(),
      notes:           '',
    };
  });
}

// ─── Sample documents ─────────────────────────────────────────────────────────

export function generateSampleDocuments(structures: Structure[]): BridgeDocument[] {
  const cats = [
    'Design Drawing', 'Inspection Report', 'As-Built',
    'Contract', 'Photo', 'Maintenance Record',
  ] as const;
  const ftypes = ['PDF', 'DWG', 'XLSX', 'DOCX', 'JPG'];
  const uploaders = UPLOADERS;
  const docs: BridgeDocument[] = [];

  structures.slice(0, 80).forEach((s, i) => {
    const seed  = hashStr(s.id + 'DOC') + i;
    const count = seededInt(seed, 2, 5);
    for (let j = 0; j < count; j++) {
      const cat  = cats[seededInt(seed + j, 0, cats.length - 1)];
      const ft   = ftypes[seededInt(seed + j + 1, 0, ftypes.length - 1)];
      const size = `${seededInt(seed + j + 2, 200, 9000)} KB`;
      docs.push({
        id:          uuidv4(),
        structureId: s.id,
        structureName: s.name,
        name:        `${s.id}_${cat.replace(/ /g, '_')}_v${j + 1}.${ft.toLowerCase()}`,
        category:    cat,
        description: `${cat} for ${s.name}`,
        fileType:    ft,
        fileSize:    size,
        uploadedBy:  uploaders[seededInt(seed + j + 3, 0, uploaders.length - 1)],
        uploadedAt:  addMonths('2024-01-01', -seededInt(seed + j + 4, 0, 24)),
        version:     `${j + 1}.0`,
      });
    }
  });

  return docs;
}

const UPLOADERS = [
  'INS-001', 'INS-002', 'INS-003',
  'INS-004', 'Records Dept.', 'DNR GIS Unit',
];

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function loadAllStructures(): Promise<Structure[]> {
  const [bridges, culverts] = await Promise.all([loadBridges(), loadCulverts()]);
  const all = [...bridges, ...culverts];

  // Assign priority ranks (1 = most urgent)
  const sorted = [...all].sort((a, b) => b.priorityScore - a.priorityScore);
  sorted.forEach((s, i) => { s.priorityRank = i + 1; });

  return sorted;
}
