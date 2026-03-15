import { useState } from 'react'
import type { Field, Plot, DashboardTrial } from '../types'

interface MapFieldPanelProps {
  fields: Field[]
  plots: Plot[]
  trials: DashboardTrial[]
  seasonId: string | null
  onZoomToField: (field: Field) => void
  onDeleteField: (id: string) => void
  onRenameField: (id: string, name: string) => void
  onGeneratePlots: (fieldId: string, trialId: string, cols: number, rows: number) => void
  onDeletePlot: (id: string) => void
  onDeletePlotsForTrial: (fieldId: string, trialId: string) => void
  onAutoplan?: () => void
}

export function MapFieldPanel({
  fields,
  plots,
  trials,
  seasonId,
  onZoomToField,
  onDeleteField,
  onRenameField,
  onGeneratePlots,
  onDeletePlot,
  onDeletePlotsForTrial,
  onAutoplan,
}: MapFieldPanelProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [gridConfig, setGridConfig] = useState<{ fieldId: string; trialId: string; cols: number; rows: number } | null>(null)
  const [editingName, setEditingName] = useState<{ fieldId: string; name: string } | null>(null)

  const seasonTrials = trials.filter(t => t.seasonId === seasonId)
  const seasonPlots = plots.filter(p => p.seasonId === seasonId)

  function getFieldAcres(field: Field): string {
    if (!field.areaSqMeters) return '\u2014'
    return (field.areaSqMeters / 4046.86).toFixed(1)
  }

  function getFieldPlots(fieldId: string): Plot[] {
    return seasonPlots.filter(p => p.fieldId === fieldId)
  }

  // Group plots by trial for display
  function getPlotsByTrial(fieldId: string): { trial: DashboardTrial | null; plots: Plot[] }[] {
    const fieldPlots = getFieldPlots(fieldId)
    const groups = new Map<string, Plot[]>()
    for (const p of fieldPlots) {
      const key = p.trialId ?? '__unassigned__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    const result: { trial: DashboardTrial | null; plots: Plot[] }[] = []
    for (const [key, plots] of groups) {
      const trial = key === '__unassigned__' ? null : trials.find(t => t.id === key) ?? null
      result.push({ trial, plots })
    }
    return result
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 300,
        zIndex: 1000,
        background: 'white',
        borderRight: '1px solid var(--gray-200)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--gray-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>Fields</div>
          {onAutoplan && fields.length > 0 && (
            <button
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: 'white',
                background: 'var(--green-600)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
              onClick={onAutoplan}
            >
              Auto-Plan
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
          {fields.length} field{fields.length !== 1 ? 's' : ''} &middot; {seasonPlots.length} plots this season
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {fields.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
            No fields yet. Use "Draw Field" to create one.
          </div>
        ) : (
          fields.map(field => {
            const isExpanded = expandedField === field.id
            const fieldPlots = getFieldPlots(field.id)
            const isEditingName = editingName?.fieldId === field.id

            return (
              <div key={field.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                {/* Field header */}
                <div
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isExpanded ? 'var(--green-50)' : 'transparent',
                  }}
                  onClick={() => setExpandedField(isExpanded ? null : field.id)}
                >
                  <span style={{ fontSize: 10, color: 'var(--gray-400)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    {'\u25B6'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-700)' }}>{field.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {getFieldAcres(field)} ac &middot; {fieldPlots.length} plots
                    </div>
                  </div>
                  <button
                    style={{
                      flexShrink: 0,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--green-700)',
                      background: 'var(--green-100)',
                      border: '1px solid var(--green-200, #bbf7d0)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      lineHeight: 1.2,
                    }}
                    onClick={e => {
                      e.stopPropagation()
                      onZoomToField(field)
                    }}
                  >
                    Zoom
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 12px', background: 'var(--green-50)' }}>

                    {/* Rename field */}
                    {isEditingName ? (
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={editingName.name}
                          onChange={e => setEditingName({ ...editingName, name: e.target.value })}
                          autoFocus
                          style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingName.name.trim()) {
                              onRenameField(field.id, editingName.name.trim())
                              setEditingName(null)
                            }
                            if (e.key === 'Escape') setEditingName(null)
                          }}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          disabled={!editingName.name.trim()}
                          onClick={() => {
                            onRenameField(field.id, editingName.name.trim())
                            setEditingName(null)
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setEditingName(null)}
                        >
                          {'\u2715'}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, width: '100%', marginBottom: 8 }}
                        onClick={() => setEditingName({ fieldId: field.id, name: field.name })}
                      >
                        Rename Field
                      </button>
                    )}

                    {/* Plots grouped by trial */}
                    {fieldPlots.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Plots ({fieldPlots.length})
                        </div>
                        {getPlotsByTrial(field.id).map(({ trial, plots: trialPlots }) => (
                          <div key={trial?.id ?? 'unassigned'} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)' }}>
                                {trial ? trial.name : 'Unassigned'}
                              </span>
                              {trial && (
                                <button
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    padding: '0 4px',
                                  }}
                                  title={`Delete all ${trialPlots.length} plots for this trial`}
                                  onClick={() => {
                                    if (confirm(`Delete all ${trialPlots.length} plots for "${trial.name}" in this field?`)) {
                                      onDeletePlotsForTrial(field.id, trial.id)
                                    }
                                  }}
                                >
                                  Clear all
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {trialPlots.slice(0, 20).map(p => (
                                <span
                                  key={p.id}
                                  style={{
                                    fontSize: 10,
                                    background: 'white',
                                    border: '1px solid var(--gray-200)',
                                    borderRadius: 3,
                                    padding: '1px 5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    cursor: 'default',
                                  }}
                                  title={`R${p.replicationNumber ?? '?'}T${p.treatmentNumber ?? '?'}`}
                                >
                                  R{p.replicationNumber}T{p.treatmentNumber}
                                  <button
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ccc',
                                      cursor: 'pointer',
                                      fontSize: 10,
                                      padding: 0,
                                      lineHeight: 1,
                                    }}
                                    onClick={() => onDeletePlot(p.id)}
                                    title="Delete this plot"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                                  >
                                    {'\u2715'}
                                  </button>
                                </span>
                              ))}
                              {trialPlots.length > 20 && (
                                <span style={{ fontSize: 10, color: 'var(--gray-400)', padding: '1px 4px' }}>
                                  +{trialPlots.length - 20} more
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plot grid generator */}
                    {gridConfig?.fieldId === field.id ? (
                      <div style={{ background: 'white', borderRadius: 6, padding: 10, border: '1px solid var(--gray-200)', marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Generate Plot Grid</div>
                        <label style={{ fontSize: 11, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                          Trial
                          <select
                            value={gridConfig.trialId}
                            onChange={e => setGridConfig({ ...gridConfig, trialId: e.target.value })}
                            style={{ width: '100%', fontSize: 12, padding: 4 }}
                          >
                            <option value="">-- Select Trial --</option>
                            {seasonTrials.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.treatments}T {'\u00D7'} {t.replications}R)
                              </option>
                            ))}
                          </select>
                        </label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <label style={{ fontSize: 11, color: 'var(--gray-600)', flex: 1 }}>
                            Columns
                            <input type="number" min={1} max={20} value={gridConfig.cols} onChange={e => setGridConfig({ ...gridConfig, cols: Number(e.target.value) })} style={{ width: '100%', fontSize: 12, padding: 4 }} />
                          </label>
                          <label style={{ fontSize: 11, color: 'var(--gray-600)', flex: 1 }}>
                            Rows
                            <input type="number" min={1} max={20} value={gridConfig.rows} onChange={e => setGridConfig({ ...gridConfig, rows: Number(e.target.value) })} style={{ width: '100%', fontSize: 12, padding: 4 }} />
                          </label>
                        </div>
                        {gridConfig.trialId && (
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                            Will create {gridConfig.cols * gridConfig.rows} plots
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setGridConfig(null)}>Cancel</button>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            disabled={!gridConfig.trialId}
                            onClick={() => {
                              onGeneratePlots(field.id, gridConfig.trialId, gridConfig.cols, gridConfig.rows)
                              setGridConfig(null)
                            }}
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, width: '100%', marginTop: 4 }}
                        onClick={() => setGridConfig({ fieldId: field.id, trialId: '', cols: 4, rows: 3 })}
                      >
                        + Generate Plot Grid
                      </button>
                    )}

                    {/* Delete field */}
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, width: '100%', marginTop: 6, color: '#ef4444' }}
                      onClick={() => {
                        if (confirm(`Delete field "${field.name}"? This will also remove its ${fieldPlots.length} plots.`)) {
                          onDeleteField(field.id)
                          setExpandedField(null)
                        }
                      }}
                    >
                      Delete Field
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Zoom all */}
      {fields.length > 1 && (
        <div style={{ padding: 12, borderTop: '1px solid var(--gray-200)' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', fontSize: 12 }}
            onClick={() => {
              onZoomToField({ id: '__all__', farmId: '', name: 'All Fields', boundary: fields.flatMap(f => f.boundary), createdAt: 0 })
            }}
          >
            Zoom to All Fields
          </button>
        </div>
      )}
    </div>
  )
}
