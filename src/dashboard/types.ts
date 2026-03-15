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
  harvestDate?: string
  contractStartDate?: string
  contractEndDate?: string

  scheduledActivities: ScheduledActivity[]

  voiceEntryConfigId?: string

  notes?: string
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
}

export const DEFAULT_DASHBOARD_DATA: DashboardData = {
  farm: null,
  seasons: [],
  fields: [],
  plots: [],
  clients: [],
  trials: [],
}
