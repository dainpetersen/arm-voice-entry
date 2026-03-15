import { useState } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { BUILT_IN_TEMPLATES, generateActivitiesFromWorkflow, findTemplateForCrop } from '../workflowEngine'
import { ACTIVITY_TYPES } from '../types'
import type { WorkflowTemplate, WorkflowStage, ActivityType, DashboardTrial } from '../types'

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onClone,
  onDelete,
  onEdit,
  assignedCount,
}: {
  template: WorkflowTemplate
  onClone: () => void
  onDelete?: () => void
  onEdit?: () => void
  assignedCount: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="dash-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>{template.name}</span>
            {template.isBuiltIn && (
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--green-100)', color: 'var(--green-700)', borderRadius: 4, fontWeight: 600 }}>
                BUILT-IN
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            {template.cropType === '*' ? 'All Crops' : template.cropType} &middot; {template.stages.length} stages
            {assignedCount > 0 && <> &middot; <span style={{ color: 'var(--green-600)' }}>{assignedCount} trials using</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" style={{ background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-200)' }} onClick={onClone}>
            Clone
          </button>
          {onEdit && (
            <button className="btn btn-sm" style={{ background: 'var(--gray-50)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }} onClick={onEdit}>
              Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }} onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <WorkflowDiagram stages={template.stages} />
        </div>
      )}
    </div>
  )
}

// ─── Visual Workflow Diagram ──────────────────────────────────────────────────

function WorkflowDiagram({ stages }: { stages: WorkflowStage[] }) {
  // Build dependency layers for layout
  const layers = buildLayers(stages)

  return (
    <div style={{ overflowX: 'auto', padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', minWidth: 'fit-content' }}>
        {layers.map((layer, li) => (
          <div key={li} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {layer.map(stg => (
              <div key={stg.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                {li > 0 && (
                  <div style={{ width: 16, height: 2, background: 'var(--gray-300)', flexShrink: 0 }} />
                )}
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'white',
                    border: '2px solid ' + getActivityColor(stg.activityType),
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--gray-700)',
                    whiteSpace: 'nowrap',
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  <div>{stg.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--gray-400)', marginTop: 2 }}>
                    +{stg.offsetDays}d
                  </div>
                </div>
                {li < layers.length - 1 && (
                  <div style={{ width: 16, height: 2, background: 'var(--gray-300)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function getActivityColor(type: ActivityType): string {
  const colors: Record<string, string> = {
    soil_sampling: '#8b5cf6',
    planting: '#16a34a',
    spray_application: '#3b82f6',
    fertilizer_application: '#f59e0b',
    assessment: '#06b6d4',
    irrigation: '#0ea5e9',
    harvest: '#ea580c',
    other: '#6b7280',
  }
  return colors[type] ?? '#6b7280'
}

function buildLayers(stages: WorkflowStage[]): WorkflowStage[][] {
  const layers: WorkflowStage[][] = []
  const placed = new Set<string>()

  // First layer: no dependencies
  const first = stages.filter(s => s.dependsOn.length === 0)
  if (first.length > 0) {
    layers.push(first)
    first.forEach(s => placed.add(s.id))
  }

  // Subsequent layers
  let safety = 0
  while (placed.size < stages.length && safety < 20) {
    safety++
    const layer = stages.filter(
      s => !placed.has(s.id) && s.dependsOn.every(d => placed.has(d)),
    )
    if (layer.length === 0) break
    layers.push(layer)
    layer.forEach(s => placed.add(s.id))
  }

  // Any remaining (circular deps)
  const remaining = stages.filter(s => !placed.has(s.id))
  if (remaining.length > 0) layers.push(remaining)

  return layers
}

// ─── Stage Editor ─────────────────────────────────────────────────────────────

function StageEditor({
  stages,
  onChange,
}: {
  stages: WorkflowStage[]
  onChange: (stages: WorkflowStage[]) => void
}) {
  const addStage = () => {
    const id = `stage-${Date.now()}`
    onChange([
      ...stages,
      {
        id,
        name: 'New Stage',
        activityType: 'assessment',
        dependsOn: stages.length > 0 ? [stages[stages.length - 1]!.id] : [],
        offsetDays: 7,
        description: '',
      },
    ])
  }

  const updateStage = (idx: number, partial: Partial<WorkflowStage>) => {
    const next = [...stages]
    next[idx] = { ...next[idx]!, ...partial }
    onChange(next)
  }

  const removeStage = (idx: number) => {
    const removedId = stages[idx]!.id
    const next = stages
      .filter((_, i) => i !== idx)
      .map(s => ({
        ...s,
        dependsOn: s.dependsOn.filter(d => d !== removedId),
      }))
    onChange(next)
  }

  const moveStage = (idx: number, dir: -1 | 1) => {
    const next = [...stages]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target]!, next[idx]!]
    onChange(next)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 140px 80px 1fr 60px', gap: 8, padding: '4px 0', marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>#</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Name</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Type</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Offset</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Depends On</div>
        <div />
      </div>

      {stages.map((stg, i) => (
        <div key={stg.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 140px 80px 1fr 60px', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button onClick={() => moveStage(i, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gray-400)', padding: 0 }}>▲</button>
            <button onClick={() => moveStage(i, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--gray-400)', padding: 0 }}>▼</button>
          </div>
          <input
            value={stg.name}
            onChange={e => updateStage(i, { name: e.target.value })}
            style={{ padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4, fontSize: 13 }}
          />
          <select
            value={stg.activityType}
            onChange={e => updateStage(i, { activityType: e.target.value as ActivityType })}
            style={{ padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4, fontSize: 13 }}
          >
            {ACTIVITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>+</span>
            <input
              type="number"
              value={stg.offsetDays}
              onChange={e => updateStage(i, { offsetDays: parseInt(e.target.value) || 0 })}
              style={{ width: 50, padding: '4px 6px', border: '1px solid var(--gray-200)', borderRadius: 4, fontSize: 13, textAlign: 'center' }}
            />
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>d</span>
          </div>
          <select
            multiple
            value={stg.dependsOn}
            onChange={e => {
              const selected = Array.from(e.target.selectedOptions, o => o.value)
              updateStage(i, { dependsOn: selected })
            }}
            style={{ padding: '2px 4px', border: '1px solid var(--gray-200)', borderRadius: 4, fontSize: 11, minHeight: 28 }}
          >
            {stages.filter(s => s.id !== stg.id).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => removeStage(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}
            title="Remove stage"
          >
            ×
          </button>
        </div>
      ))}

      <button
        className="btn btn-sm"
        style={{ marginTop: 12, background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-200)' }}
        onClick={addStage}
      >
        + Add Stage
      </button>
    </div>
  )
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

function TemplateEditorModal({
  template,
  onSave,
  onClose,
}: {
  template: WorkflowTemplate | null // null = new
  onSave: (template: WorkflowTemplate) => void
  onClose: () => void
}) {
  const [name, setName] = useState(template?.name ?? 'New Workflow')
  const [cropType, setCropType] = useState(template?.cropType ?? '*')
  const [stages, setStages] = useState<WorkflowStage[]>(template?.stages ?? [])

  const handleSave = () => {
    onSave({
      id: template?.id ?? `tmpl-${Date.now()}`,
      name,
      cropType,
      stages,
      isBuiltIn: false,
      createdAt: template?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
        <div className="dash-modal-title">{template ? 'Edit Workflow' : 'New Workflow'}</div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Workflow Name</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Crop Type</label>
            <input value={cropType} onChange={e => setCropType(e.target.value)} placeholder='* for all crops' />
          </div>
        </div>

        {stages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>Preview</div>
            <WorkflowDiagram stages={stages} />
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>Stages</div>
        <StageEditor stages={stages} onChange={setStages} />

        <div className="dash-form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name || stages.length === 0}>
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Workflow Modal ────────────────────────────────────────────────────

function AssignWorkflowModal({
  trials,
  templates,
  onAssign,
  onClose,
}: {
  trials: DashboardTrial[]
  templates: WorkflowTemplate[]
  onAssign: (trialId: string, templateId: string, startDate: string) => void
  onClose: () => void
}) {
  const unassigned = trials.filter(t => !t.workflowTemplateId && t.status !== 'cancelled')
  const [selectedTrialId, setSelectedTrialId] = useState(unassigned[0]?.id ?? '')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]!)

  const selectedTrial = trials.find(t => t.id === selectedTrialId)

  // Auto-suggest template based on crop
  const suggestedTemplate = selectedTrial
    ? findTemplateForCrop(selectedTrial.cropType, templates)
    : undefined

  const effectiveTemplateId = selectedTemplateId || suggestedTemplate?.id || ''

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="dash-modal-title">Assign Workflow to Trial</div>

        {unassigned.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
            All trials already have workflows assigned.
          </div>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Trial</label>
              <select value={selectedTrialId} onChange={e => { setSelectedTrialId(e.target.value); setSelectedTemplateId('') }}>
                {unassigned.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.cropType})</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>
                Workflow Template
                {suggestedTemplate && !selectedTemplateId && (
                  <span style={{ fontSize: 11, color: 'var(--green-600)', marginLeft: 8 }}>
                    Auto-suggested for {selectedTrial?.cropType}
                  </span>
                )}
              </label>
              <select value={effectiveTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                <option value="">Select...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.cropType === '*' ? 'All Crops' : t.cropType})
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label>Start Date (first activity)</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            {effectiveTemplateId && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>Workflow Preview</div>
                <WorkflowDiagram stages={templates.find(t => t.id === effectiveTemplateId)?.stages ?? []} />
              </div>
            )}
          </>
        )}

        <div className="dash-form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (selectedTrialId && effectiveTemplateId && startDate) {
                onAssign(selectedTrialId, effectiveTemplateId, startDate)
              }
            }}
            disabled={!selectedTrialId || !effectiveTemplateId || !startDate}
          >
            Assign & Generate Activities
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Batch Assign ─────────────────────────────────────────────────────────────

function BatchAssignSection({
  trials,
  templates,
  onAssign,
}: {
  trials: DashboardTrial[]
  templates: WorkflowTemplate[]
  onAssign: (trialId: string, templateId: string, startDate: string) => void
}) {
  const unassigned = trials.filter(t => !t.workflowTemplateId && t.status !== 'cancelled')

  if (unassigned.length === 0) return null

  const handleBatchAssign = () => {
    const startDate = new Date().toISOString().split('T')[0]!
    let assigned = 0
    for (const trial of unassigned) {
      const tmpl = findTemplateForCrop(trial.cropType, templates)
      if (tmpl) {
        onAssign(trial.id, tmpl.id, trial.plantingDate ?? startDate)
        assigned++
      }
    }
    if (assigned > 0) {
      alert(`Auto-assigned workflows to ${assigned} trials based on crop type.`)
    } else {
      alert('No matching templates found for unassigned trials.')
    }
  }

  return (
    <div className="dash-card" style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green-800)' }}>
            {unassigned.length} trial{unassigned.length !== 1 ? 's' : ''} without workflows
          </div>
          <div style={{ fontSize: 12, color: 'var(--green-600)', marginTop: 2 }}>
            Auto-assign matching templates based on crop type
          </div>
        </div>
        <button
          className="btn btn-sm"
          style={{ background: 'var(--green-600)', color: 'white', border: 'none' }}
          onClick={handleBatchAssign}
        >
          Auto-Assign All
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkflowsPage() {
  const { data, currentSeasonId, saveTrial } = useDashboard()
  const [editorModal, setEditorModal] = useState<{ template: WorkflowTemplate | null } | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  // Merge built-in + custom templates
  const customTemplates = data.workflowTemplates ?? []
  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates]
  const seasonTrials = data.trials.filter(t => t.seasonId === currentSeasonId)

  const getAssignedCount = (templateId: string) =>
    seasonTrials.filter(t => t.workflowTemplateId === templateId).length

  const handleSaveTemplate = (template: WorkflowTemplate) => {
    // Custom templates are stored in dashboardData.workflowTemplates
    const existing = customTemplates.findIndex(t => t.id === template.id)
    const next = [...customTemplates]
    if (existing >= 0) {
      next[existing] = template
    } else {
      next.push(template)
    }
    // We need to update via loadBulkData or add a saveWorkflowTemplate method
    // For now, directly update localStorage
    const stored = { ...data, workflowTemplates: next }
    localStorage.setItem('arm-dashboard-data', JSON.stringify(stored))
    window.location.reload() // simple refresh to pick up changes
  }

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('Delete this custom workflow template?')) return
    const next = customTemplates.filter(t => t.id !== id)
    const stored = { ...data, workflowTemplates: next }
    localStorage.setItem('arm-dashboard-data', JSON.stringify(stored))
    window.location.reload()
  }

  const handleCloneTemplate = (template: WorkflowTemplate) => {
    setEditorModal({
      template: {
        ...template,
        id: `tmpl-${Date.now()}`,
        name: `${template.name} (Copy)`,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
  }

  const handleAssignWorkflow = (trialId: string, templateId: string, startDate: string) => {
    const trial = data.trials.find(t => t.id === trialId)
    const template = allTemplates.find(t => t.id === templateId)
    if (!trial || !template) return

    const activities = generateActivitiesFromWorkflow(template, trialId, startDate)
    saveTrial({
      ...trial,
      workflowTemplateId: templateId,
      scheduledActivities: [...trial.scheduledActivities, ...activities],
      updatedAt: Date.now(),
    })
    setShowAssignModal(false)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Workflows</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-200)' }}
            onClick={() => setShowAssignModal(true)}
          >
            Assign to Trial
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--green-600)', color: 'white', border: 'none' }}
            onClick={() => setEditorModal({ template: null })}
          >
            + New Workflow
          </button>
        </div>
      </div>

      <BatchAssignSection
        trials={seasonTrials}
        templates={allTemplates}
        onAssign={handleAssignWorkflow}
      />

      {/* Assigned trials summary */}
      {seasonTrials.some(t => t.workflowTemplateId) && (
        <div className="dash-card" style={{ marginBottom: 24 }}>
          <div className="dash-card-header">
            <div className="dash-card-title">Assigned Workflows</div>
          </div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Trial</th>
                <th>Crop</th>
                <th>Workflow</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {seasonTrials.filter(t => t.workflowTemplateId).map(trial => {
                const tmpl = allTemplates.find(t => t.id === trial.workflowTemplateId)
                const totalStages = tmpl?.stages.length ?? 0
                const completedStages = trial.scheduledActivities.filter(
                  a => a.id.startsWith('wf-') && (a.status === 'completed' || a.status === 'skipped')
                ).length
                const pct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

                return (
                  <tr key={trial.id} onClick={() => {}}>
                    <td style={{ fontWeight: 600 }}>{trial.name}</td>
                    <td>{trial.cropType}</td>
                    <td>{tmpl?.name ?? 'Unknown'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16a34a' : 'var(--green-600)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--gray-500)', minWidth: 45 }}>
                          {completedStages}/{totalStages}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Built-in Templates */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Built-in Templates
      </div>
      {BUILT_IN_TEMPLATES.map(t => (
        <TemplateCard
          key={t.id}
          template={t}
          assignedCount={getAssignedCount(t.id)}
          onClone={() => handleCloneTemplate(t)}
        />
      ))}

      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 24 }}>
            Custom Templates
          </div>
          {customTemplates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              assignedCount={getAssignedCount(t.id)}
              onClone={() => handleCloneTemplate(t)}
              onEdit={() => setEditorModal({ template: t })}
              onDelete={() => handleDeleteTemplate(t.id)}
            />
          ))}
        </>
      )}

      {editorModal && (
        <TemplateEditorModal
          template={editorModal.template}
          onSave={handleSaveTemplate}
          onClose={() => setEditorModal(null)}
        />
      )}

      {showAssignModal && (
        <AssignWorkflowModal
          trials={seasonTrials}
          templates={allTemplates}
          onAssign={handleAssignWorkflow}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </>
  )
}
