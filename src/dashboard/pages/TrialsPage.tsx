import { useState } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { TrialList } from '../components/TrialList'
import { TrialForm } from '../components/TrialForm'
import type { DashboardTrial } from '../types'

export function TrialsPage() {
  const { data, currentSeasonId, saveTrial, deleteTrial } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [editingTrial, setEditingTrial] = useState<DashboardTrial | undefined>(undefined)

  const seasonTrials = data.trials.filter(t => t.seasonId === currentSeasonId)

  function handleSelect(id: string) {
    const trial = data.trials.find(t => t.id === id)
    if (trial) {
      setEditingTrial(trial)
      setShowForm(true)
    }
  }

  function handleSave(trial: DashboardTrial) {
    saveTrial(trial)
    setShowForm(false)
    setEditingTrial(undefined)
  }

  function handleClose() {
    setShowForm(false)
    setEditingTrial(undefined)
  }

  function handleNew() {
    setEditingTrial(undefined)
    setShowForm(true)
  }

  if (!currentSeasonId) {
    return (
      <div className="dash-empty" style={{ padding: 40 }}>
        <div className="dash-empty-text">Select a season to view trials</div>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-800)' }}>Trials</h1>
        <button className="btn btn-primary" onClick={handleNew}>+ New Trial</button>
      </div>

      <div className="dash-card">
        <TrialList
          trials={seasonTrials}
          clients={data.clients}
          onSelect={handleSelect}
          onDelete={deleteTrial}
        />
      </div>

      {showForm && (
        <TrialForm
          onSave={handleSave}
          onClose={handleClose}
          existing={editingTrial}
          clients={data.clients}
          currentSeasonId={currentSeasonId}
        />
      )}
    </>
  )
}
