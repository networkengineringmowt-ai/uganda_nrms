// âââ Core Structure Types ââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type StructureType = 'bridge' | 'culvert';
export type ConditionRating = 1 | 2 | 3 | 4 | 5;
export type TrafficLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export interface ConditionHistory {
  year: number;
  rating: ConditionRating;
}

export interface Structure {
  id: string;
  name: string;
  type: StructureType;
  road: string;
  roadNumber: string;
  region: string;
  chainage: number;              // km along road
  lat: number;
  lng: number;
  // Physical properties
  spanLength: number;            // metres
  noOfSpans: number;
  noOfLanes: number;
  noOfPiers: number;
  width: number;                 // metres
  material: string;
  crossingType: string;          // river / canal / road / railway
  surfaceType: string;
  yearBuilt: number;
  maintenanceArea: string;
  river: string;
  // Condition & inspection
  conditionRating: ConditionRating;
  conditionHistory: ConditionHistory[];
  lastInspection: string;        // ISO date
  nextInspection: string;        // ISO date
  inspectionDue: boolean;
  // Risk & priority
  traffic: TrafficLevel;
  strategicImportance: 1 | 2 | 3 | 4 | 5;
  priorityScore: number;         // 0-100
  priorityRank: number;
  // Finance
  estimatedReplacementCost: number; // UGX
  maintenanceCostHistory: { year: number; cost: number }[];
  // Metadata
  defects: string[];
  notes: string;
}

// âââ Inspection Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type InspectionType = 'Routine' | 'Principal' | 'Special' | 'Emergency';

export interface Inspection {
  id: string;
  structureId: string;
  structureName: string;
  date: string;
  inspector: string;
  type: InspectionType;
  // NBI-style component ratings (0â9)
  deckRating: number;
  superstructureRating: number;
  substructureRating: number;
  channelRating: number;
  overallCondition: ConditionRating;
  // Visual
  visualScore: number;           // 0â100
  findings: string;
  defects: string[];
  recommendations: string;
  photos: string[];              // simulated filenames
  nextInspection: string;
  completedAt: string;
}

// âââ Work Order Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type WorkOrderType   = 'Routine Maintenance' | 'Preventive' | 'Rehabilitation' | 'Emergency Repair' | 'Reconstruction';
export type WorkOrderStatus = 'Planned' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
export type WorkOrderPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface WorkOrder {
  id: string;
  structureId: string;
  structureName: string;
  title: string;
  description: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  startDate: string;
  endDate: string;
  cost: number;                  // UGX
  contractor: string;
  engineerInCharge: string;
  createdAt: string;
  completedAt?: string;
  notes: string;
}

// âââ Document Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type DocumentCategory = 'Design Drawing' | 'Inspection Report' | 'As-Built' | 'Contract' | 'Photo' | 'Maintenance Record' | 'Environmental' | 'Other';

export interface BridgeDocument {
  id: string;
  structureId: string;
  structureName: string;
  name: string;
  category: DocumentCategory;
  description: string;
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  version: string;
  url?: string;
  // Kept in sync with src/types/index.ts's BridgeDocument - BMSContext types
  // state.documents against THIS interface while DocumentStore.tsx imports
  // its own BridgeDocument from src/types/index.ts; the two had drifted out
  // of sync (this one was missing these fields entirely), which surfaced as
  // "property does not exist" errors wherever a document flows from context
  // state into a component typed against the other file.
  extractedText?: string;
  pageCount?: number;
  wordCount?: number;
  keywords?: string[];
  extractionStatus?: 'ok' | 'unsupported' | 'failed';
}

// âââ App State âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// âââ Platform-level views âââââââââââââââââââââââââââââââââââââââââââââââââââââ
export type ActiveView =
  | 'platform'              // Uganda National Roads Platform dashboard
  | 'roadnetwork'           // Road network GIS map (all 1,017 links)
  | 'traffic'               // Traffic & demand analytics
  | 'roadcondition'         // Road condition & pavement data
  | 'maintenanceprogramme'  // PMS maintenance programme â priority-ranked links
  | 'projects'              // Ongoing road development projects
  // âââ BMS sub-module views ââââââââââââââââââââââââââââââââââââââââââââââââââ
  | 'dashboard'      // BMS structure dashboard
  | 'registry'       // Structure registry table
  | 'gismap'         // Structure GIS map
  | 'inspections'    // Inspection management
  | 'condition'      // Condition assessment
  | 'maintenance'    // Maintenance & works orders
  | 'analytics'      // BMS analytics
  | 'priority'       // Priority ranking
  | 'phototwin'      // Photo & digital twin
  | 'networkstory'   // Uganda Road Network historical story (1986âpresent)
  | 'trafficanalytics'  // Traffic demand analytics dashboard
  | 'trafficsummary'   // Traffic summary tables (Road Links + Stations)
  | 'oprc'             // OPRC contracts dashboard
  | 'ndpiv'            // NDP IV investment dashboard
  | 'overloading'      // Overloading analytics â ESAL risk index & hotspot map
  | 'growthfactors'   // Monthly/seasonal/annual growth factors
  // âââ New 10-module views ââââââââââââââââââââââââââââââââââââââââââââââââââ
  | 'mlarchitecture'  // Interactive ML system architecture diagram
  | 'hdm4'            // HDM-4 deterioration models, calibration, CESAL calculator
  | 'projecttracker'  // Gantt/Kanban project progress tracker
  | 'pim'             // Public Investment Management â PPPs, donor funding
  | 'budget'          // Budgeting & Maintenance planning
  | 'lifecycle'       // Life Cycle Management â per-link asset timelines
  | 'sources'           // Sources & Evidence catalogue
  | 'tabularsummaries'  // Tabular summaries â all data tables aggregated
  | 'bms'               // Bridge Management System â unified view (incl. Bridge Works tab)
  | 'pms'               // Pavement Management System â unified view (NPMS)
  | 'network'           // Network Overview â 4-tab unified view
  | 'rms'               // RMS â Road Management System hub (4-tab: overview, road map, network story, DNR RMS Engine architecture)
  | 'casestudies'       // Global RMS Case Studies â world map, cards, comparative analytics, lessons
  | 'roadreserve'       // Road Reserve Management â gazette status, encroachment register, reserve map
  | 'admin'             // Admin Tools â 2-tab unified view (Mind Map + Data Audit)
  | 'pendingsurveys'    // Pending condition survey submissions
  | 'dataaudit'         // Data Audit Panel â admin-only cross-section KPI validation
  | 'datacapture'       // Data Capture Hub â login-gated forms that write to Supabase
  | 'mindmap'           // Platform Mind Map â 5D architectural schematic
  | 'gisenterprise'     // GIS Enterprise Dashboard
  | 'atc'               // ATC automatic traffic counters
  | 'bridgeworks'       // Bridge works programme
  | 'downloads'         // Downloads centre
  | 'roadatlas'         // Road atlas
  | 'roadvideo'         // Road video survey viewer
  | 'ducar'             // District, Urban and Community Access Roads
  | 'socioeconomic'     // Socio-Economic Analysis
  | 'ntis'              // National Traffic Information System (flagship AADT/growth/axle-load rollup)
  | 'npms';             // National PMS (strategic network-wide pavement performance)

// âââ Road network types âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export type RoadClass   = 'A' | 'B' | 'C' | 'M';
export type SurfaceType = 'Bituminous' | 'Unsealed';

export interface RoadLink {
  road_no:             string;
  link_id:             string;
  link_name:           string;
  road_class:          string;
  surface_type:        string;
  length_km:           number;
  maintenance_region:  string;
  maintenance_station: string;
  chainage_from:       number;
  chainage_to:         number;
}

export interface OngoingProject {
  project_name:          string;
  funding_agency:        string;
  location:              string;
  regions:               string;
  parsed_length_km:      number;
  planned_progress_pct:  number | null;
  actual_progress_pct:   number | null;
  financial_progress_pct: number | null;
  target_completion_date: string;
  contractor:            string;
  supervisor:            string;
  behind_schedule:       boolean;
}

export interface TrafficYearSummary {
  year:                               number;
  covered_length_km:                  number;
  observed_links:                     number;
  network_weighted_motorised_aadt:    number;
  network_weighted_non_motorised_aadt: number;
  total_vehicle_km:                   number;
}

export interface WtssRecord {
  ndp:                   string;
  financial_year:        string;
  annual_increase_km:    number;
  stock_of_paved_roads_km: number;
  percent_paved_network: number;
}

export interface AppState {
  structures:          Structure[];
  inspections:         Inspection[];
  workOrders:          WorkOrder[];
  documents:           BridgeDocument[];
  activeView:          ActiveView;
  selectedStructureId: string | null;
  isLoading:           boolean;
  /** Full navigation history (browser-style back/forward) */
  viewHistory:         ActiveView[];
  historyIndex:        number;
}

export type AppAction =
  | { type: 'SET_STRUCTURES';    payload: Structure[] }
  | { type: 'SET_ACTIVE_VIEW';   payload: ActiveView }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'NAVIGATE_FORWARD' }
  | { type: 'SELECT_STRUCTURE';  payload: string | null }
  | { type: 'SEED_ALL_DATA';     payload: { inspections: Inspection[]; workOrders: WorkOrder[]; documents: BridgeDocument[] } }
  | { type: 'ADD_INSPECTION';    payload: Inspection }
  | { type: 'ADD_WORK_ORDER';    payload: WorkOrder }
  | { type: 'UPDATE_WORK_ORDER'; payload: WorkOrder }
  | { type: 'ADD_DOCUMENT';      payload: BridgeDocument }
  | { type: 'SET_LOADING';       payload: boolean }
  | { type: 'UPDATE_STRUCTURE';  payload: Partial<Structure> & { id: string } };
