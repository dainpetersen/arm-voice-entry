import type { WorkflowTemplate, WorkflowStage, DashboardTrial, ScheduledActivity, ActivityType } from './types'

// ─── Built-in Workflow Templates ──────────────────────────────────────────────

function stage(
  id: string,
  name: string,
  activityType: ActivityType,
  dependsOn: string[],
  offsetDays: number,
  description?: string,
): WorkflowStage {
  return { id, name, activityType, dependsOn, offsetDays, description }
}

export const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tmpl-corn-herbicide',
    name: 'Corn Herbicide Trial',
    cropType: 'Corn',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
    stages: [
      stage('soil',      'Soil Sampling',           'soil_sampling',          [],              0,   'Pre-plant soil sampling'),
      stage('plant',     'Planting',                'planting',               ['soil'],        7,   'Plant trial plots'),
      stage('pre-spray', 'Pre-Emerge Application',  'spray_application',      ['plant'],       1,   'Pre-emerge herbicide application'),
      stage('assess-1',  'Emergence Assessment',    'assessment',             ['plant'],       14,  'Stand count & emergence assessment'),
      stage('fert',      'Side-dress Fertilizer',   'fertilizer_application', ['plant'],       35,  'Side-dress nitrogen application'),
      stage('post-spray','Post-Emerge Application', 'spray_application',      ['pre-spray'],   18,  'Post-emerge herbicide application'),
      stage('assess-2',  'Mid-Season Assessment',   'assessment',             ['post-spray'],  14,  'Weed control rating'),
      stage('assess-3',  'Pre-Harvest Assessment',  'assessment',             ['assess-2'],    45,  'Final weed control & crop tolerance'),
      stage('harvest',   'Harvest',                 'harvest',                ['assess-3'],    14,  'Harvest trial plots & collect yield data'),
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
      stage('assess-1',  'V3 Assessment',        'assessment',        ['plant'],       21,  'Early-season stand assessment'),
      stage('spray-r3',  'R3 Application',       'spray_application', ['assess-1'],    25,  'R3 fungicide application'),
      stage('assess-2',  'R4 Disease Rating',    'assessment',        ['spray-r3'],    10,  'Disease severity assessment'),
      stage('spray-r5',  'R5 Application',       'spray_application', ['assess-2'],    7,   'R5 fungicide application (if sequential)'),
      stage('assess-3',  'Pre-Harvest Rating',   'assessment',        ['spray-r5'],    21,  'Final disease & yield component assessment'),
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
      stage('assess-1',  'Tillering Assessment', 'assessment',             ['fert-1'],      14,  'Tiller count & vigor rating'),
      stage('spray',     'Fungicide Application','spray_application',      ['assess-1'],    21,  'Flag leaf fungicide application'),
      stage('assess-2',  'Heading Assessment',   'assessment',             ['spray'],       10,  'Disease rating at heading'),
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
      stage('soil',      'Soil Sampling',        'soil_sampling',     [],             0,   'Pre-plant soil sampling & pest history'),
      stage('plant',     'Planting',             'planting',          ['soil'],        7,   'Plant trial plots'),
      stage('scout-1',   'Early Scouting',       'assessment',        ['plant'],       14,  'Seedling insect pressure assessment'),
      stage('spray',     'Insecticide Application','spray_application',['scout-1'],    3,   'Insecticide application at threshold'),
      stage('assess-1',  '3-DAT Assessment',     'assessment',        ['spray'],       3,   'Efficacy assessment 3 days after treatment'),
      stage('assess-2',  '7-DAT Assessment',     'assessment',        ['spray'],       7,   'Efficacy assessment 7 days after treatment'),
      stage('assess-3',  '14-DAT Assessment',    'assessment',        ['spray'],       14,  'Efficacy assessment 14 days after treatment'),
      stage('assess-4',  'Pre-Harvest Rating',   'assessment',        ['assess-3'],    60,  'Season-long pest damage & yield impact'),
      stage('harvest',   'Harvest',              'harvest',           ['assess-4'],    14,  'Harvest trial plots'),
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
      stage('assess-1',  'Disease Rating 1',       'assessment',             ['spray-1'],     10,  'Cercospora leaf spot rating'),
      stage('spray-2',   'Second Fungicide App',   'spray_application',      ['assess-1'],    10,  'Second fungicide application'),
      stage('assess-2',  'Disease Rating 2',       'assessment',             ['spray-2'],     10,  'Second disease severity rating'),
      stage('spray-3',   'Third Fungicide App',    'spray_application',      ['assess-2'],    10,  'Third fungicide if needed'),
      stage('assess-3',  'Pre-Harvest Rating',     'assessment',             ['spray-3'],     21,  'Final disease & root quality assessment'),
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
      stage('assess-1',  'First Assessment',    'assessment',        ['spray'],     7,  'Initial efficacy assessment'),
      stage('assess-2',  'Second Assessment',   'assessment',        ['assess-1'],  14, 'Follow-up assessment'),
      stage('assess-3',  'Final Assessment',    'assessment',        ['assess-2'],  28, 'Pre-harvest assessment'),
      stage('harvest',   'Harvest',             'harvest',           ['assess-3'],  14, 'Harvest trial plots'),
    ],
  },
]

// ─── Workflow Engine ──────────────────────────────────────────────────────────

/**
 * Given a workflow template and a start date, generate the initial set of
 * scheduled activities for a trial. The first stage(s) with no dependencies
 * get scheduled on `startDate`, and everything else stays unscheduled until
 * dependencies are completed.
 */
export function generateActivitiesFromWorkflow(
  template: WorkflowTemplate,
  trialId: string,
  startDate: string, // ISO date YYYY-MM-DD
): ScheduledActivity[] {
  const activities: ScheduledActivity[] = []

  for (const stg of template.stages) {
    const hasNoDeps = stg.dependsOn.length === 0
    const scheduledDate = hasNoDeps
      ? addDays(startDate, stg.offsetDays)
      : '' // will be scheduled when dependencies complete

    activities.push({
      id: `wf-${trialId}-${stg.id}`,
      trialId,
      type: stg.activityType,
      description: stg.description ?? stg.name,
      scheduledDate,
      status: hasNoDeps ? 'scheduled' : 'scheduled',
      daysAfterPlanting: stg.offsetDays,
      notes: hasNoDeps ? undefined : `Blocked until: ${stg.dependsOn.join(', ')}`,
      _workflowStageId: stg.id,
      _blocked: !hasNoDeps,
    } as ScheduledActivity & { _workflowStageId: string; _blocked: boolean })
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

  // Find which workflow stage was just completed
  const completedStageId = getStageIdFromActivity(completedAct, template)
  if (!completedStageId) return activities

  const completionDate = completedAct.completedDate ?? new Date().toISOString().split('T')[0]!

  // Find all stages that depend on the completed stage
  for (const stg of template.stages) {
    if (!stg.dependsOn.includes(completedStageId)) continue

    // Check if ALL dependencies for this stage are now complete
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

    // Schedule this stage: latestDepDate + offsetDays
    const newDate = addDays(latestDepDate, stg.offsetDays)
    const actIndex = activities.findIndex(a => getStageIdFromActivity(a, template) === stg.id)

    if (actIndex >= 0) {
      const act = activities[actIndex]!
      activities[actIndex] = {
        ...act,
        scheduledDate: newDate,
        status: 'scheduled',
        notes: undefined, // clear the "blocked" note
      }
      // Remove internal _blocked flag
      delete (activities[actIndex] as unknown as Record<string, unknown>)._blocked
    }
  }

  return activities
}

/**
 * Get the workflow stage ID from an activity (stored in the id or a custom field).
 */
function getStageIdFromActivity(
  activity: ScheduledActivity,
  template: WorkflowTemplate,
): string | undefined {
  // Activities generated by workflow have ids like "wf-{trialId}-{stageId}"
  const prefix = `wf-${activity.trialId}-`
  if (activity.id.startsWith(prefix)) {
    return activity.id.slice(prefix.length)
  }
  // Fallback: try to match by activity type + description
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
  // Exact crop match first
  const exact = templates.find(t => t.cropType.toLowerCase() === cropType.toLowerCase())
  if (exact) return exact
  // Wildcard fallback
  return templates.find(t => t.cropType === '*')
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}
