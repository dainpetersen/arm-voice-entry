import { useState } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { ACTIVITY_TYPES, TRIAL_STATUS_COLORS, TRIAL_STATUS_LABELS } from '../types'
import type { DashboardTrial, ScheduledActivity, ActivityStatus, ActivityType } from '../types'
import { evaluateWorkflowRules, BUILT_IN_TEMPLATES, isActivityBlocked } from '../workflowEngine'

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: 'var(--green-700)', bg: 'var(--green-100)' },
  completed: { label: 'Completed', color: '#166534', bg: '#dcfce7' },
  skipped: { label: 'Skipped', color: '#92400e', bg: '#fef3c7' },
  overdue: { label: 'Overdue', color: '#991b1b', bg: '#fee2e2' },
}

const STATUS_DOT_COLORS: Record<ActivityStatus, string> = {
  completed: '#16a34a',
  scheduled: '#d1d5db',
  skipped: '#f59e0b',
  overdue: '#ef4444',
}

// Canonical stage order for the pipeline
const PIPELINE_STAGES: { type: ActivityType; short: string }[] = [
  { type: 'soil_sampling', short: 'Soil' },
  { type: 'planting', short: 'Plant' },
  { type: 'fertilizer_application', short: 'Fert' },
  { type: 'spray_application', short: 'Spray' },
  { type: 'assessment', short: 'Assess' },
  { type: 'harvest', short: 'Harvest' },
]

function getStageStatus(
  trial: DashboardTrial,
  stageType: ActivityType,
  today: string,
): { status: ActivityStatus; count: number; total: number } | null {
  const activities = trial.scheduledActivities.filter(a => a.type === stageType)
  if (activities.length === 0) return null

  const completedCount = activities.filter(a => a.status === 'completed').length
  const skippedCount = activities.filter(a => a.status === 'skipped').length

  if (completedCount === activities.length) return { status: 'completed', count: completedCount, total: activities.length }
  if (skippedCount === activities.length) return { status: 'skipped', count: skippedCount, total: activities.length }
  if (completedCount + skippedCount === activities.length) return { status: 'completed', count: completedCount, total: activities.length }

  // Check if any are overdue
  const hasOverdue = activities.some(a => a.status === 'scheduled' && a.scheduledDate < today)
  if (hasOverdue) return { status: 'overdue', count: completedCount, total: activities.length }

  return { status: 'scheduled', count: completedCount, total: activities.length }
}

function getTrialDotColor(trial: DashboardTrial, activityStatus: ActivityStatus): string {
  // Completed/skipped/overdue use their own activity status colors
  if (activityStatus === 'completed') return STATUS_DOT_COLORS.completed
  if (activityStatus === 'skipped') return STATUS_DOT_COLORS.skipped
  if (activityStatus === 'overdue') return STATUS_DOT_COLORS.overdue
  // Scheduled stages use the trial's status color (e.g. blue for planned, green for active)
  return TRIAL_STATUS_COLORS[trial.status]
}

function TrialTimeline({ trials, today }: { trials: DashboardTrial[]; today: string }) {
  if (trials.length === 0) return null

  return (
    <div className="dash-card" style={{ marginBottom: 24 }}>
      <div className="dash-card-header">
        <div className="dash-card-title">Trial Progress</div>
      </div>

      {/* Stage column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          padding: '8px 16px 4px',
          borderBottom: '1px solid var(--gray-100)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>
          Trial
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)` }}>
          {PIPELINE_STAGES.map(s => (
            <div
              key={s.type}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--gray-400)',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {s.short}
            </div>
          ))}
        </div>
      </div>

      {/* Trial rows */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {trials.map(trial => {
          const stages = PIPELINE_STAGES.map(s => ({
            ...s,
            result: getStageStatus(trial, s.type, today),
          }))

          return (
            <div
              key={trial.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                padding: '10px 16px',
                borderBottom: '1px solid var(--gray-50)',
                alignItems: 'center',
              }}
            >
              {/* Trial name */}
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: TRIAL_STATUS_COLORS[trial.status],
                    flexShrink: 0,
                  }}
                  title={TRIAL_STATUS_LABELS[trial.status]}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--gray-700)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={trial.name}
                  >
                    {trial.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>
                    {trial.cropType} &middot;{' '}
                    <span style={{ color: TRIAL_STATUS_COLORS[trial.status] }}>
                      {TRIAL_STATUS_LABELS[trial.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pipeline dots */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)`,
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {/* Connecting line behind dots */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '8%',
                    right: '8%',
                    height: 2,
                    background: 'var(--gray-100)',
                    transform: 'translateY(-50%)',
                    zIndex: 0,
                  }}
                />

                {stages.map((stage) => {
                  const result = stage.result
                  const dotColor = result ? getTrialDotColor(trial, result.status) : '#e5e7eb'
                  const isActive = result !== null
                  const isCompleted = result?.status === 'completed'
                  const isOverdue = result?.status === 'overdue'
                  const isSkipped = result?.status === 'skipped'
                  const hasPartial = result && result.count > 0 && result.count < result.total

                  return (
                    <div
                      key={stage.type}
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      <div
                        title={
                          result
                            ? `${stage.short}: ${result.count}/${result.total} ${result.status}`
                            : `${stage.short}: no activities`
                        }
                        style={{
                          width: isActive ? 18 : 10,
                          height: isActive ? 18 : 10,
                          borderRadius: '50%',
                          background: isActive ? dotColor : '#e5e7eb',
                          border: hasPartial
                            ? `3px solid ${dotColor}`
                            : isActive
                            ? `2px solid ${dotColor}`
                            : '2px solid #e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s',
                          boxShadow: isOverdue ? '0 0 0 3px rgba(239,68,68,0.2)' : 'none',
                        }}
                      >
                        {isCompleted && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {isSkipped && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M2 4H6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                        {hasPartial && !isCompleted && (
                          <span style={{ fontSize: 8, color: 'white', fontWeight: 700, lineHeight: 1 }}>
                            {result.count}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SchedulePage() {
  const { data, currentSeasonId, saveTrial } = useDashboard()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const seasonTrials = data.trials.filter(t => t.seasonId === currentSeasonId)

  // Collect all activities with trial context
  const allActivities: (ScheduledActivity & { trialName: string; trialId: string })[] = []
  for (const trial of seasonTrials) {
    for (const act of trial.scheduledActivities) {
      allActivities.push({ ...act, trialName: trial.name, trialId: trial.id })
    }
  }
  allActivities.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))

  const today = new Date().toISOString().split('T')[0]!
  const upcoming = allActivities.filter(a => a.status === 'scheduled' && a.scheduledDate >= today)
  const overdue = allActivities.filter(a => (a.status === 'scheduled' || a.status === 'overdue') && a.scheduledDate < today)
  const completed = allActivities.filter(a => a.status === 'completed')
  const skipped = allActivities.filter(a => a.status === 'skipped')

  // Merge built-in + custom templates for workflow lookup
  const allTemplates = [...BUILT_IN_TEMPLATES, ...(data.workflowTemplates ?? [])]

  function setActivityStatus(activity: ScheduledActivity & { trialId: string }, newStatus: ActivityStatus) {
    const trial = data.trials.find(t => t.id === activity.trialId)
    if (!trial) return

    // Update the activity status
    let updatedActivities = trial.scheduledActivities.map(a =>
      a.id === activity.id
        ? {
            ...a,
            status: newStatus,
            completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
          }
        : a
    )

    // If completing/skipping, evaluate workflow rules to auto-schedule downstream
    if (newStatus === 'completed' || newStatus === 'skipped') {
      const template = allTemplates.find(t => t.id === trial.workflowTemplateId)
      if (template) {
        const trialWithUpdated = { ...trial, scheduledActivities: updatedActivities }
        updatedActivities = evaluateWorkflowRules(trialWithUpdated, activity.id, template)
      }
    }

    saveTrial({ ...trial, scheduledActivities: updatedActivities, updatedAt: Date.now() })
    setExpandedId(null)
  }

  const getTypeLabel = (type: string) =>
    ACTIVITY_TYPES.find(t => t.value === type)?.label ?? type

  function getEffectiveStatus(act: typeof allActivities[number]): ActivityStatus {
    if (act.status === 'completed' || act.status === 'skipped') return act.status
    if (act.scheduledDate < today) return 'overdue'
    return 'scheduled'
  }

  const renderActivityRow = (act: typeof allActivities[number], dotClass: string) => {
    const isExpanded = expandedId === act.id
    const effective = getEffectiveStatus(act)
    const cfg = STATUS_CONFIG[effective]

    // Check if this activity is blocked by workflow dependencies
    const trial = data.trials.find(t => t.id === act.trialId)
    const template = trial ? allTemplates.find(t => t.id === trial.workflowTemplateId) : undefined
    const blocked = trial && template ? isActivityBlocked(act, trial, template) : false

    return (
      <div key={act.id} style={{ borderBottom: '1px solid var(--gray-100)', opacity: blocked ? 0.5 : 1 }}>
        <div
          className="activity-item"
          style={{ cursor: 'pointer' }}
          onClick={() => setExpandedId(isExpanded ? null : act.id)}
        >
          <div className={`activity-dot ${dotClass}`} />
          <div className="activity-info">
            <div className="activity-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {getTypeLabel(act.type)}: {act.description}
              {blocked && (
                <span style={{ fontSize: 10, padding: '1px 6px', background: '#f1f5f9', color: '#64748b', borderRadius: 4, fontWeight: 600 }}>
                  BLOCKED
                </span>
              )}
            </div>
            <div className="activity-meta">
              {act.trialName}
              {act.scheduledDate
                ? <> &middot; {new Date(act.scheduledDate + 'T00:00:00').toLocaleDateString()}</>
                : <> &middot; <em style={{ color: 'var(--gray-400)' }}>date pending</em></>
              }
              {act.assignedTo && <> &middot; {act.assignedTo}</>}
            </div>
          </div>
          <span
            className="status-badge"
            style={{
              background: blocked ? '#f1f5f9' : cfg.bg,
              color: blocked ? '#64748b' : cfg.color,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {blocked ? 'Blocked' : cfg.label}
          </span>
        </div>

        {isExpanded && (
          <div
            style={{
              padding: '8px 16px 12px 40px',
              background: 'var(--gray-50)',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--gray-500)', marginRight: 4 }}>Set status:</span>
            {effective !== 'scheduled' && (
              <button
                className="btn btn-sm"
                style={{
                  background: STATUS_CONFIG.scheduled.bg,
                  color: STATUS_CONFIG.scheduled.color,
                  border: '1px solid var(--green-200, #bbf7d0)',
                }}
                onClick={() => setActivityStatus(act, 'scheduled')}
              >
                Scheduled
              </button>
            )}
            {effective !== 'completed' && (
              <button
                className="btn btn-sm"
                style={{
                  background: STATUS_CONFIG.completed.bg,
                  color: STATUS_CONFIG.completed.color,
                  border: '1px solid #bbf7d0',
                }}
                onClick={() => setActivityStatus(act, 'completed')}
              >
                Completed
              </button>
            )}
            {effective !== 'skipped' && (
              <button
                className="btn btn-sm"
                style={{
                  background: STATUS_CONFIG.skipped.bg,
                  color: STATUS_CONFIG.skipped.color,
                  border: '1px solid #fde68a',
                }}
                onClick={() => setActivityStatus(act, 'skipped')}
              >
                Skipped
              </button>
            )}
            {/* Assessment variables */}
            {act.assessmentVariables && act.assessmentVariables.length > 0 && (
              <div style={{ width: '100%', marginTop: 6, padding: '6px 8px', background: 'white', borderRadius: 6, border: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Variables to Record
                </div>
                {act.assessmentVariables.map((v, vi) => (
                  <div key={vi} style={{ fontSize: 12, color: 'var(--gray-600)', display: 'flex', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{v.name}</span>
                    <span style={{ color: 'var(--gray-400)' }}>
                      {v.scaleMin !== undefined && v.scaleMax !== undefined ? `${v.scaleMin}–${v.scaleMax}${v.scaleUnit ?? ''}` : v.scaleUnit ?? ''}
                    </span>
                    {v.compareToCheck && <span style={{ fontSize: 10, color: '#3b82f6' }}>vs. check</span>}
                  </div>
                ))}
              </div>
            )}
            {/* Photo requirement */}
            {act.photoRequirement?.required && (
              <div style={{ width: '100%', marginTop: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📷</span>
                <span style={{ color: 'var(--gray-500)' }}>{act.photoRequirement.description ?? 'Photo required'}</span>
                {act.photoRequirement.conditional && (
                  <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--gray-400)' }}>
                    — {act.photoRequirement.conditional}
                  </span>
                )}
              </div>
            )}
            {/* Offset anchor badge */}
            {act.offsetAnchor && act.offsetDays !== undefined && (
              <div style={{ width: '100%', marginTop: 4, fontSize: 11, color: 'var(--gray-400)' }}>
                Timing: {act.offsetDays} days after {act.offsetAnchor === 'emergence' ? 'emergence (DAE)' : act.offsetAnchor === 'treatment' ? 'treatment (DAT)' : act.offsetAnchor === 'planting' ? 'planting (DAP)' : act.offsetAnchor}
              </div>
            )}
            {act.notes && (
              <div style={{ width: '100%', fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                Notes: {act.notes}
              </div>
            )}
            {act.completedDate && (
              <div style={{ width: '100%', fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                Completed: {new Date(act.completedDate + 'T00:00:00').toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderSection = (title: string, items: typeof allActivities, dotClass: string) => {
    if (items.length === 0) return null
    return (
      <div className="dash-card" key={title} style={{ marginBottom: 16 }}>
        <div className="dash-card-header">
          <div className="dash-card-title">{title} ({items.length})</div>
        </div>
        {items.map(act => renderActivityRow(act, dotClass))}
      </div>
    )
  }

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--gray-800)' }}>
        Schedule
      </h1>

      {allActivities.length === 0 ? (
        <div className="dash-empty">
          <div className="dash-empty-icon">&#128197;</div>
          <div className="dash-empty-text">No scheduled activities</div>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>
            Add activities to your trials to see them here.
          </p>
        </div>
      ) : (
        <>
          {/* Trial progress timeline */}
          <TrialTimeline trials={seasonTrials} today={today} />

          {renderSection('Overdue', overdue, 'overdue')}
          {renderSection('Upcoming', upcoming, 'scheduled')}
          {renderSection('Completed', completed, 'completed')}
          {renderSection('Skipped', skipped, 'skipped')}
        </>
      )}
    </>
  )
}
