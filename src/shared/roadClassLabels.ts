// src/shared/roadClassLabels.ts
// Authoritative Uganda road class definitions
// M class = Grade-Separated Highways (NOT municipal/urban/Kampala)

export const ROAD_CLASS_LABELS: Record<string, string> = {
  A: 'National Highway (Class A)',
  B: 'National Road (Class B)',
  C: 'Regional Road (Class C)',
  D: 'District Road (Class D)',
  M: 'Grade-Separated Highway (Class M)',
  U: 'Urban Road (Class U)',
};

export const ROAD_CLASS_COLORS: Record<string, string> = {
  A: '#ef4444',  // red
  B: '#f97316',  // orange
  C: '#eab308',  // yellow
  D: '#22c55e',  // green
  M: '#6366f1',  // indigo — grade-separated
  U: '#8b5cf6',  // purple
};

export const ROAD_CLASS_DESCRIPTIONS: Record<string, string> = {
  A: 'Main international and inter-regional highways',
  B: 'Secondary national roads linking major towns',
  C: 'Regional roads connecting district headquarters',
  D: 'District roads managed by district governments',
  M: 'Grade-separated interchanges and expressways',
  U: 'Roads within urban council boundaries',
};

/** Source: MoWT Road Class Guidelines + networkXY2026.xlsx */
export const LINK_ID_FORMAT = '{Road_No}_Link{NN}';
export const LINK_ID_SOURCE = 'networkXY2026.xlsx';
export const TOTAL_LINKS_2026 = 1015;
