import type {
  WorkflowTemplate, WorkflowStage, DashboardTrial, ScheduledActivity,
  ActivityType, OffsetAnchor, AssessmentVariable, PhotoRequirement,
} from './types'

// ─── Built-in Workflow Templates ──────────────────────────────────────────────

function stage(
  id: string,
  name: string,
  activityType: ActivityType,
  dependsOn: string[],
  offsetDays: number,
  description?: string,
  opts?: {
    offsetAnchor?: OffsetAnchor
    assessmentVariables?: AssessmentVariable[]
    photoRequirement?: PhotoRequirement
  },
): WorkflowStage {
  return {
    id, name, activityType, dependsOn, offsetDays, description,
    offsetAnchor: opts?.offsetAnchor,
    assessmentVariables: opts?.assessmentVariables,
    photoRequirement: opts?.photoRequirement,
  }
}

// Common assessment variable definitions
const WEED_CONTROL_VAR: AssessmentVariable = {
  id: 'weed-control',
  name: 'Weed Control',
  scaleType: 'percent',
  scaleMin: 0,
  scaleMax: 100,
  scaleUnit: '%',
  description: '0 = No reduction in weed cover, 100 = Complete reduction vs. nontreated check',
  compareToCheck: true,
}

const CROP_PHYTO_VAR: AssessmentVariable = {
  id: 'crop-phyto',
  name: 'Crop Phytotoxicity',
  scaleType: 'percent',
  scaleMin: 0,
  scaleMax: 100,
  scaleUnit: '%',
  description: 'Stunting, necrosis, or both. 0 = no injury, 100 = plant death',
  compareToCheck: false,
}

const DISEASE_SEVERITY_VAR: AssessmentVariable = {
  id: 'disease-severity',
  name: 'Disease Severity',
  scaleType: 'percent',
  scaleMin: 0,
  scaleMax: 100,
  scaleUnit: '%',
  description: 'Percentage of plant tissue affected by disease',
  compareToCheck: true,
}

const INSECT_DAMAGE_VAR: AssessmentVariable = {
  id: 'insect-damage',
  name: 'Insect Damage',
  scaleType: 'percent',
  scaleMin: 0,
  scaleMax: 100,
  scaleUnit: '%',
  description: 'Percentage of plants with insect feeding damage',
  compareToCheck: true,
}

const STAND_COUNT_VAR: AssessmentVariable = {
  id: 'stand-count',
  name: 'Stand Count',
  scaleType: 'numeric',
  scaleUnit: 'plants/row',
  description: 'Number of live plants per measured row length',
}

const PHOTO_FULL_PLOT: PhotoRequirement = {
  required: true,
  description: 'Full plot photo from most representative rep',
  scope: 'per_rep',
}

const PHOTO_WEED_CONTROL: PhotoRequirement = {
  required: true,
  description: 'Weed control photo — include nontreated check for comparison',
  scope: 'per_rep',
}

const PHOTO_CONDITIONAL_PHYTO: PhotoRequirement = {
  required: true,
  description: 'Full plot photo from most representative rep',
  scope: 'per_rep',
  conditional: 'If no phytotoxicity is observed, photos are not needed',
}

export const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tmpl-corn-herbicide',
    name: 'Corn Herbicide Trial (POST)',
    cropType: 'Corn',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',       'Soil Sampling',           'soil_sampling',     [],              0,   'Pre-plant soil sampling'),
      stage('plant',      'Planting',                'planting',          ['soil'],         7,   'Plant trial plots'),
      stage('spray-a',    'POST Application',        'spray_application', ['plant'],        14,  'Post-emerge herbicide application (App A)'),
      // Phytotoxicity assessments — DAE anchored
      stage('phyto-3',    'Phyto 3 DAE',             'assessment',        ['plant'],        3,   'Crop phytotoxicity rating 3 DAE', {
        offsetAnchor: 'emergence',
        assessmentVariables: [CROP_PHYTO_VAR],
        photoRequirement: PHOTO_CONDITIONAL_PHYTO,
      }),
      stage('phyto-7',    'Phyto 7 DAE',             'assessment',        ['phyto-3'],      4,   'Crop phytotoxicity rating 7 DAE', {
        offsetAnchor: 'emergence',
        assessmentVariables: [CROP_PHYTO_VAR],
        photoRequirement: PHOTO_CONDITIONAL_PHYTO,
      }),
      stage('phyto-10',   'Phyto 10 DAE',            'assessment',        ['phyto-7'],      3,   'Crop phytotoxicity rating 10 DAE', {
        offsetAnchor: 'emergence',
        assessmentVariables: [CROP_PHYTO_VAR],
        photoRequirement: PHOTO_CONDITIONAL_PHYTO,
      }),
      stage('phyto-14',   'Phyto 14 DAE',            'assessment',        ['phyto-10'],     4,   'Crop phytotoxicity rating 14 DAE', {
        offsetAnchor: 'emergence',
        assessmentVariables: [CROP_PHYTO_VAR],
        photoRequirement: PHOTO_CONDITIONAL_PHYTO,
      }),
      stage('phyto-21',   'Phyto 21 DAE',            'assessment',        ['phyto-14'],     7,   'Crop phytotoxicity rating 21 DAE', {
        offsetAnchor: 'emergence',
        assessmentVariables: [CROP_PHYTO_VAR],
      }),
      // Weed control assessments — DAT anchored
      stage('weed-14',    'Weed Control 14 DAT',      'assessment',       ['spray-a'],      14,  'Weed control rating 14 DAT', {
        offsetAnchor: 'treatment',
        assessmentVariables: [WEED_CONTROL_VAR],
        photoRequirement: PHOTO_WEED_CONTROL,
      }),
      stage('weed-28',    'Weed Control 28 DAT',      'assessment',       ['weed-14'],      14,  'Weed control rating 28 DAT', {
        offsetAnchor: 'treatment',
        assessmentVariables: [WEED_CONTROL_VAR],
        photoRequirement: PHOTO_WEED_CONTROL,
      }),
      stage('weed-42',    'Weed Control 42 DAT',      'assessment',       ['weed-28'],      14,  'Weed control rating 42 DAT', {
        offsetAnchor: 'treatment',
        assessmentVariables: [WEED_CONTROL_VAR],
        photoRequirement: PHOTO_WEED_CONTROL,
      }),
      stage('weed-56',    'Weed Control 56 DAT',      'assessment',       ['weed-42'],      14,  'Weed control rating 56 DAT', {
        offsetAnchor: 'treatment',
        assessmentVariables: [WEED_CONTROL_VAR],
      }),
      stage('harvest',    'Harvest',                  'harvest',           ['weed-56'],      14,  'Harvest trial plots & collect yield data'),
    ],
  },
  {
    id: 'tmpl-soybean-fungicide',
    name: 'Soybean Fungicide Trial',
    cropType: 'Soybean',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',        'soil_sampling',     [],             0,   'Pre-plant soil sampling'),
      stage('plant',     'Planting',             'planting',          ['soil'],        7,   'Plant trial plots'),
      stage('assess-1',  'V3 Stand Count',       'assessment',        ['plant'],       21,  'Early-season stand assessment', {
        assessmentVariables: [STAND_COUNT_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('spray-r3',  'R3 Application',       'spray_application', ['assess-1'],    25,  'R3 fungicide application'),
      stage('assess-2',  'R4 Disease Rating',    'assessment',        ['spray-r3'],    10,  'Disease severity assessment', {
        offsetAnchor: 'treatment',
        assessmentVariables: [DISEASE_SEVERITY_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('spray-r5',  'R5 Application',       'spray_application', ['assess-2'],    7,   'R5 fungicide application (if sequential)'),
      stage('assess-3',  'Pre-Harvest Rating',   'assessment',        ['spray-r5'],    21,  'Final disease & yield component assessment', {
        assessmentVariables: [DISEASE_SEVERITY_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('harvest',   'Harvest',              'harvest',           ['assess-3'],    14,  'Harvest trial plots'),
    ],
  },
  {
    id: 'tmpl-wheat-variety',
    name: 'Wheat Variety Trial',
    cropType: 'Wheat',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',        'soil_sampling',          [],             0,   'Pre-plant soil sampling'),
      stage('plant',     'Planting',             'planting',               ['soil'],        5,   'Plant trial plots'),
      stage('fert-1',    'Spring Fertilizer',    'fertilizer_application', ['plant'],       14,  'Spring topdress nitrogen'),
      stage('assess-1',  'Tillering Assessment', 'assessment',             ['fert-1'],      14,  'Tiller count & vigor rating', {
        assessmentVariables: [STAND_COUNT_VAR],
      }),
      stage('spray',     'Fungicide Application','spray_application',      ['assess-1'],    21,  'Flag leaf fungicide application'),
      stage('assess-2',  'Heading Assessment',   'assessment',             ['spray'],       10,  'Disease rating at heading', {
        offsetAnchor: 'treatment',
        assessmentVariables: [DISEASE_SEVERITY_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('assess-3',  'Pre-Harvest Rating',   'assessment',             ['assess-2'],    28,  'Lodging, test weight estimates'),
      stage('harvest',   'Harvest',              'harvest',                ['assess-3'],    14,  'Harvest trial plots'),
    ],
  },
  {
    id: 'tmpl-corn-insecticide',
    name: 'Corn Insecticide Trial',
    cropType: 'Corn',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',            'soil_sampling',     [],             0,   'Pre-plant soil sampling & pest history'),
      stage('plant',     'Planting',                 'planting',          ['soil'],        7,   'Plant trial plots'),
      stage('scout-1',   'Early Scouting',           'assessment',        ['plant'],       14,  'Seedling insect pressure assessment', {
        assessmentVariables: [INSECT_DAMAGE_VAR],
      }),
      stage('spray',     'Insecticide Application',  'spray_application', ['scout-1'],     3,   'Insecticide application at threshold'),
      stage('assess-1',  '3-DAT Assessment',         'assessment',        ['spray'],       3,   'Efficacy assessment 3 days after treatment', {
        offsetAnchor: 'treatment',
        assessmentVariables: [INSECT_DAMAGE_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('assess-2',  '7-DAT Assessment',         'assessment',        ['spray'],       7,   'Efficacy assessment 7 days after treatment', {
        offsetAnchor: 'treatment',
        assessmentVariables: [INSECT_DAMAGE_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('assess-3',  '14-DAT Assessment',        'assessment',        ['spray'],       14,  'Efficacy assessment 14 days after treatment', {
        offsetAnchor: 'treatment',
        assessmentVariables: [INSECT_DAMAGE_VAR],
      }),
      stage('assess-4',  'Pre-Harvest Rating',       'assessment',        ['assess-3'],    60,  'Season-long pest damage & yield impact', {
        assessmentVariables: [INSECT_DAMAGE_VAR],
      }),
      stage('harvest',   'Harvest',                  'harvest',           ['assess-4'],    14,  'Harvest trial plots'),
    ],
  },
  {
    id: 'tmpl-sugar-beet',
    name: 'Sugar Beet Fungicide/Nematicide Trial',
    cropType: 'Sugar Beet',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',          'soil_sampling',          [],             0,   'Nematode & soil disease sampling'),
      stage('plant',     'Planting',               'planting',               ['soil'],        10,  'Plant trial plots'),
      stage('fert',      'Fertilizer Application', 'fertilizer_application', ['plant'],       14,  'In-season fertilizer'),
      stage('spray-1',   'First Fungicide App',    'spray_application',      ['plant'],       45,  'First Cercospora fungicide application'),
      stage('assess-1',  'Disease Rating 1',       'assessment',             ['spray-1'],     10,  'Cercospora leaf spot rating', {
        offsetAnchor: 'treatment',
        assessmentVariables: [DISEASE_SEVERITY_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('spray-2',   'Second Fungicide App',   'spray_application',      ['assess-1'],    10,  'Second fungicide application'),
      stage('assess-2',  'Disease Rating 2',       'assessment',             ['spray-2'],     10,  'Second disease severity rating', {
        offsetAnchor: 'treatment',
        assessmentVariables: [DISEASE_SEVERITY_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('spray-3',   'Third Fungicide App',    'spray_application',      ['assess-2'],    10,  'Third fungicide if needed'),
      stage('assess-3',  'Pre-Harvest Rating',     'assessment',             ['spray-3'],     21,  'Final disease & root quality assessment', {
        assessmentVariables: [DISEASE_SEVERITY_VAR],
      }),
      stage('harvest',   'Harvest',                'harvest',                ['assess-3'],    14,  'Harvest & weigh sugar beet roots'),
    ],
  },
  {
    id: 'tmpl-generic',
    name: 'Generic Trial Workflow',
    cropType: '*',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',       'soil_sampling',     [],           0,  'Pre-trial soil sampling'),
      stage('plant',     'Planting',            'planting',          ['soil'],      7,  'Plant trial plots'),
      stage('spray',     'Application',         'spray_application', ['plant'],     14, 'Product application'),
      stage('assess-1',  'First Assessment',    'assessment',        ['spray'],     7,  'Initial efficacy assessment', {
        offsetAnchor: 'treatment',
        assessmentVariables: [WEED_CONTROL_VAR],
      }),
      stage('assess-2',  'Second Assessment',   'assessment',        ['assess-1'],  14, 'Follow-up assessment', {
        assessmentVariables: [WEED_CONTROL_VAR],
      }),
      stage('assess-3',  'Final Assessment',    'assessment',        ['assess-2'],  28, 'Pre-harvest assessment', {
        assessmentVariables: [WEED_CONTROL_VAR],
        photoRequirement: PHOTO_FULL_PLOT,
      }),
      stage('harvest',   'Harvest',             'harvest',           ['assess-3'],  14, 'Harvest trial plots'),
    ],
  },
]

// ─── Workflow Engine ──────────────────────────────────────────────────────────

/**
 * Resolve the anchor date for a stage based on its offsetAnchor type.
 * Falls back to dependency-based if anchor date not available on the trial.
 */
function resolveAnchorDate(
  stg: WorkflowStage,
  trial: DashboardTrial,
  fallbackDate: string,
): string {
  const anchor = stg.offsetAnchor ?? 'dependency'

  switch (anchor) {
    case 'emergence':
      return trial.emergenceDate ?? trial.plantingDate ?? fallbackDate
    case 'planting':
      return trial.plantingDate ?? fallbackDate
    case 'treatment': {
      // Use the first application date if available
      const appDates = trial.applicationDates
      if (appDates) {
        const firstDate = Object.values(appDates).sort()[0]
        if (firstDate) return firstDate
      }
      return fallbackDate
    }
    case 'calendar':
    case 'dependency':
    default:
      return fallbackDate
  }
}

/**
 * Given a workflow template and a start date, generate the initial set of
 * scheduled activities for a trial. Stages with DAE/DAT anchors use the
 * trial's emergence/application dates if available, otherwise fall back
 * to dependency-based scheduling.
 */
export function generateActivitiesFromWorkflow(
  template: WorkflowTemplate,
  trialId: string,
  startDate: string,
  trial?: DashboardTrial,
): ScheduledActivity[] {
  const activities: ScheduledActivity[] = []

  for (const stg of template.stages) {
    const hasNoDeps = stg.dependsOn.length === 0
    const anchor = stg.offsetAnchor ?? 'dependency'

    let scheduledDate = ''
    let blocked = !hasNoDeps

    if (hasNoDeps) {
      // No dependencies — schedule based on anchor
      const anchorDate = trial ? resolveAnchorDate(stg, trial, startDate) : startDate
      scheduledDate = addDays(anchorDate, stg.offsetDays)
      blocked = false
    } else if (anchor === 'emergence' && trial?.emergenceDate) {
      // DAE: can calculate even if dependency not complete
      scheduledDate = addDays(trial.emergenceDate, stg.offsetDays)
      blocked = false
    } else if (anchor === 'planting' && trial?.plantingDate) {
      // DAP: can calculate from planting date
      scheduledDate = addDays(trial.plantingDate, stg.offsetDays)
      blocked = false
    } else if (anchor === 'treatment' && trial?.applicationDates) {
      const firstAppDate = Object.values(trial.applicationDates).sort()[0]
      if (firstAppDate) {
        scheduledDate = addDays(firstAppDate, stg.offsetDays)
        blocked = false
      }
    }

    activities.push({
      id: `wf-${trialId}-${stg.id}`,
      trialId,
      type: stg.activityType,
      description: stg.description ?? stg.name,
      scheduledDate,
      status: 'scheduled',
      daysAfterPlanting: stg.offsetDays,
      offsetAnchor: anchor,
      offsetDays: stg.offsetDays,
      assessmentVariables: stg.assessmentVariables,
      photoRequirement: stg.photoRequirement,
      notes: blocked ? `Blocked until: ${stg.dependsOn.join(', ')}` : undefined,
    })
  }

  return activities
}

/**
 * When an activity is completed, evaluate the workflow rules and auto-schedule
 * any newly unblocked downstream activities.
 * Returns the updated activities array.
 */
export function evaluateWorkflowRules(
  trial: DashboardTrial,
  completedActivityId: string,
  template: WorkflowTemplate | undefined,
): ScheduledActivity[] {
  if (!template) return trial.scheduledActivities

  const activities = [...trial.scheduledActivities]
  const completedAct = activities.find(a => a.id === completedActivityId)
  if (!completedAct) return activities

  const completedStageId = getStageIdFromActivity(completedAct, template)
  if (!completedStageId) return activities

  const completionDate = completedAct.completedDate ?? new Date().toISOString().split('T')[0]!

  // If this was a spray application, record it as an application date on the trial
  // (for DAT calculations of downstream stages)
  const completedStage = template.stages.find(s => s.id === completedStageId)
  let effectiveTrial = trial
  if (completedStage?.activityType === 'spray_application' && completedAct.completedDate) {
    effectiveTrial = {
      ...trial,
      applicationDates: {
        ...trial.applicationDates,
        [completedStageId]: completedAct.completedDate,
      },
    }
  }

  // If this was planting, update emergence estimate (emergence ~= planting + 7-10 days)
  if (completedStage?.activityType === 'planting' && completedAct.completedDate && !trial.emergenceDate) {
    effectiveTrial = {
      ...effectiveTrial,
      plantingDate: completedAct.completedDate,
      // Estimate emergence at 7 days after planting if not set
      emergenceDate: addDays(completedAct.completedDate, 7),
    }
  }

  for (const stg of template.stages) {
    if (!stg.dependsOn.includes(completedStageId)) continue

    const allDepsComplete = stg.dependsOn.every(depId => {
      const depActivity = activities.find(a => getStageIdFromActivity(a, template) === depId)
      return depActivity && (depActivity.status === 'completed' || depActivity.status === 'skipped')
    })

    if (!allDepsComplete) continue

    // Find the latest completion date among dependencies
    let latestDepDate = completionDate
    for (const depId of stg.dependsOn) {
      const depActivity = activities.find(a => getStageIdFromActivity(a, template) === depId)
      if (depActivity?.completedDate && depActivity.completedDate > latestDepDate) {
        latestDepDate = depActivity.completedDate
      }
    }

    // Resolve the scheduled date based on anchor type
    let newDate: string
    const anchor = stg.offsetAnchor ?? 'dependency'

    if (anchor === 'emergence' && effectiveTrial.emergenceDate) {
      newDate = addDays(effectiveTrial.emergenceDate, stg.offsetDays)
    } else if (anchor === 'planting' && effectiveTrial.plantingDate) {
      newDate = addDays(effectiveTrial.plantingDate, stg.offsetDays)
    } else if (anchor === 'treatment') {
      // Use the completion date of the spray dependency, or the first app date
      const sprayDep = stg.dependsOn
        .map(d => template.stages.find(s => s.id === d))
        .find(s => s?.activityType === 'spray_application')
      const sprayAct = sprayDep
        ? activities.find(a => getStageIdFromActivity(a, template) === sprayDep.id)
        : undefined
      const treatmentDate = sprayAct?.completedDate ?? latestDepDate
      newDate = addDays(treatmentDate, stg.offsetDays)
    } else {
      newDate = addDays(latestDepDate, stg.offsetDays)
    }

    const actIndex = activities.findIndex(a => getStageIdFromActivity(a, template) === stg.id)
    if (actIndex >= 0) {
      activities[actIndex] = {
        ...activities[actIndex]!,
        scheduledDate: newDate,
        status: 'scheduled',
        notes: undefined,
      }
    }
  }

  return activities
}

/**
 * Get the workflow stage ID from an activity.
 */
function getStageIdFromActivity(
  activity: ScheduledActivity,
  template: WorkflowTemplate,
): string | undefined {
  const prefix = `wf-${activity.trialId}-`
  if (activity.id.startsWith(prefix)) {
    return activity.id.slice(prefix.length)
  }
  const match = template.stages.find(
    s => s.activityType === activity.type && s.description === activity.description,
  )
  return match?.id
}

/**
 * Check if a trial's activity is blocked by incomplete dependencies.
 */
export function isActivityBlocked(
  activity: ScheduledActivity,
  trial: DashboardTrial,
  template: WorkflowTemplate | undefined,
): boolean {
  if (!template) return false
  const stageId = getStageIdFromActivity(activity, template)
  if (!stageId) return false
  const stg = template.stages.find(s => s.id === stageId)
  if (!stg || stg.dependsOn.length === 0) return false

  return !stg.dependsOn.every(depId => {
    const depActivity = trial.scheduledActivities.find(a => getStageIdFromActivity(a, template) === depId)
    return depActivity && (depActivity.status === 'completed' || depActivity.status === 'skipped')
  })
}

/**
 * Get downstream stages that would be unblocked if this stage completes.
 */
export function getDownstreamStages(
  stageId: string,
  template: WorkflowTemplate,
): WorkflowStage[] {
  return template.stages.filter(s => s.dependsOn.includes(stageId))
}

/**
 * Find the best matching template for a trial based on crop type.
 */
export function findTemplateForCrop(
  cropType: string,
  templates: WorkflowTemplate[],
): WorkflowTemplate | undefined {
  const exact = templates.find(t => t.cropType.toLowerCase() === cropType.toLowerCase())
  if (exact) return exact
  return templates.find(t => t.cropType === '*')
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}
