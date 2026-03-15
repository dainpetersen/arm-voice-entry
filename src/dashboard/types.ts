/** GeoJSON-order coordinate pair [lng, lat] */
export type LngLat = [number, number]

/** Polygon ring: array of [lng, lat] pairs, first === last */
export type PolygonRing = LngLat[]

// --- Farm & Geography ---

export interface Farm {
  id: string
  name: string
  centerLat: number
  centerLng: number
  defaultZoom: number
  createdAt: number
}

export interface Season {
  id: string
  year: number
  name: string // e.g. "Spring 2026"
  startDate?: string // ISO date
  endDate?: string
  createdAt: number
}

export interface Field {
  id: string
  farmId: string
  name: string
  boundary: PolygonRing
  areaSqMeters?: number
  notes?: string
  createdAt: number
}

export interface Plot {
  id: string
  fieldId: string
  seasonId: string
  trialId?: string
  label: string
  boundary: PolygonRing
  areaSqMeters?: number
  /** Physical plot width in feet (e.g. 10 ft from protocol) */
  widthFt?: number
  /** Physical plot length in feet (e.g. 40 ft from protocol) */
  lengthFt?: number
  treatmentNumber?: number
  replicationNumber?: number
  createdAt: number
}

// --- Clients ---

export interface Client {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  notes?: string
  createdAt: number
}

// --- Trials ---

export type TrialStatus = 'draft' | 'planned' | 'active' | 'completed' | 'invoiced' | 'cancelled'

export const TRIAL_STATUSES: TrialStatus[] = ['draft', 'planned', 'active', 'completed', 'invoiced', 'cancelled']

export const TRIAL_STATUS_LABELS: Record<TrialStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
}

export const TRIAL_STATUS_COLORS: Record<TrialStatus, string> = {
  draft: '#9ca3af',
  planned: '#3b82f6',
  active: '#237a2d',
  completed: '#059669',
  invoiced: '#8b5cf6',
  cancelled: '#ef4444',
}

export interface TreatmentDescription {
  number: number
  name: string
  description: string
  product?: string
  rate?: string
  rateUnit?: string
}

export type ActivityType =
  | 'planting'
  | 'spray_application'
  | 'fertilizer_application'
  | 'assessment'
  | 'irrigation'
  | 'harvest'
  | 'soil_sampling'
  | 'other'

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'planting', label: 'Planting' },
  { value: 'spray_application', label: 'Spray Application' },
  { value: 'fertilizer_application', label: 'Fertilizer Application' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'harvest', label: 'Harvest' },
  { value: 'soil_sampling', label: 'Soil Sampling' },
  { value: 'other', label: 'Other' },
]

export type ActivityStatus = 'scheduled' | 'completed' | 'skipped' | 'overdue'

/** How to anchor the timing of an assessment/activity */
export type OffsetAnchor =
  | 'planting'       // Days After Planting (DAP)
  | 'emergence'      // Days After Emergence (DAE)
  | 'treatment'      // Days After Treatment (DAT)
  | 'dependency'     // Days after a workflow dependency completes
  | 'calendar'       // Fixed calendar date

export const OFFSET_ANCHORS: { value: OffsetAnchor; label: string; short: string }[] = [
  { value: 'planting', label: 'Days After Planting', short: 'DAP' },
  { value: 'emergence', label: 'Days After Emergence', short: 'DAE' },
  { value: 'treatment', label: 'Days After Treatment', short: 'DAT' },
  { value: 'dependency', label: 'After Dependency', short: 'DEP' },
  { value: 'calendar', label: 'Calendar Date', short: 'CAL' },
]

/** Assessment variable definition — what to measure */
export interface AssessmentVariable {
  id: string
  name: string              // e.g. "Crop Phytotoxicity", "Weed Control"
  scaleType: 'percent' | 'numeric' | 'ordinal' | 'text'
  scaleMin?: number         // e.g. 0
  scaleMax?: number         // e.g. 100
  scaleUnit?: string        // e.g. "%", "1-9"
  description?: string      // e.g. "0 = no reduction, 100 = complete reduction"
  compareToCheck?: boolean  // relative to nontreated check
}

/** Photo requirement for an assessment stage */
export interface PhotoRequirement {
  required: boolean
  description?: string      // e.g. "Full plot photo from most representative rep"
  scope?: 'per_plot' | 'per_rep' | 'per_trial'  // what level
  conditional?: string      // e.g. "If no phytotoxicity observed, photos not needed"
}

export interface ScheduledActivity {
  id: string
  trialId: string
  type: ActivityType
  description: string
  scheduledDate: string
  completedDate?: string
  status: ActivityStatus
  assignedTo?: string
  notes?: string
  daysAfterPlanting?: number
  /** Offset anchor for DAE/DAT scheduling */
  offsetAnchor?: OffsetAnchor
  /** Number of days after the anchor event */
  offsetDays?: number
  /** Assessment variables to record at this activity */
  assessmentVariables?: AssessmentVariable[]
  /** Photo requirements for this activity */
  photoRequirement?: PhotoRequirement
}

export interface DashboardTrial {
  id: string
  protocolCode: string
  name: string
  clientId: string
  seasonId: string
  cropType: string
  status: TrialStatus

  treatments: number
  replications: number
  treatmentDescriptions: TreatmentDescription[]

  fieldId?: string
  plotIds: string[]

  contractValue?: number
  estimatedCost?: number
  currency: string
  purchaseOrderNumber?: string

  plantingDate?: string
  emergenceDate?: string       // for DAE calculations
  applicationDates?: Record<string, string>  // appCode -> ISO date (e.g. { A: '2026-06-01' })
  harvestDate?: string
  contractStartDate?: string
  contractEndDate?: string
  dataReturnDeadline?: string  // e.g. "2026-09-01" from protocol

  /** Physical plot dimensions from protocol */
  plotWidthFt?: number         // e.g. 10
  plotLengthFt?: number        // e.g. 40

  /** Study design from protocol (e.g. RACOBL) */
  studyDesign?: string
  /** Objectives from protocol */
  objectives?: string[]
  /** Crop code from protocol (e.g. ZEAMX) */
  cropCode?: string
  /** Crop stage scale (e.g. BBCH) */
  cropStageScale?: string
  /** GLP/GEP compliance */
  conductedUnderGLP?: boolean
  conductedUnderGEP?: boolean

  /** Assessment variable templates for this trial */
  assessmentVariables?: AssessmentVariable[]

  scheduledActivities: ScheduledActivity[]
  workflowTemplateId?: string

  voiceEntryConfigId?: string

  notes?: string
  createdAt: number
  updatedAt: number
}

// --- Workflow Templates ---

export interface WorkflowStage {
  id: string
  name: string
  activityType: ActivityType
  dependsOn: string[]   // stage IDs that must complete first
  offsetDays: number    // days after last dependency completes
  /** How to anchor this stage's timing */
  offsetAnchor?: OffsetAnchor  // default: 'dependency'
  description?: string  // default description for the generated activity
  /** Assessment variables to collect at this stage */
  assessmentVariables?: AssessmentVariable[]
  /** Photo requirements for this stage */
  photoRequirement?: PhotoRequirement
}

export interface WorkflowTemplate {
  id: string
  name: string
  cropType: string       // e.g. "Corn", "Soybean", or "*" for any crop
  stages: WorkflowStage[]
  isBuiltIn?: boolean    // true for pre-built templates (not editable)
  createdAt: number
  updatedAt: number
}

// --- Aggregate ---

export interface DashboardData {
  farm: Farm | null
  seasons: Season[]
  fields: Field[]
  plots: Plot[]
  clients: Client[]
  trials: DashboardTrial[]
  workflowTemplates: WorkflowTemplate[]
}

export const DEFAULT_DASHBOARD_DATA: DashboardData = {
  farm: null,
  seasons: [],
  fields: [],
  plots: [],
  clients: [],
  trials: [],
  workflowTemplates: [],
}
