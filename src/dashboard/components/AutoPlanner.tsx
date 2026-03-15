import { useState } from 'react'
import type { Field, Plot, DashboardTrial, LngLat } from '../types'

interface AutoPlannerProps {
  fields: Field[]
  trials: DashboardTrial[]
  existingPlots: Plot[]
  seasonId: string
  onApply: (plots: Plot[], trialUpdates: { id: string; fieldId: string; plotIds: string[] }[]) => void
  onClose: () => void
}

interface PlannedAssignment {
  trial: DashboardTrial
  field: Field
  cols: number
  rows: number
  plots: Plot[]
}

interface FieldBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
  widthM: number
  heightM: number
  areaM2: number
}

function getFieldBounds(field: Field): FieldBounds {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of field.boundary) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  const metersPerDegreeLat = 111320
  const metersPerDegreeLng = 111320 * Math.cos((minLat * Math.PI) / 180)
  return {
    minLng, maxLng, minLat, maxLat,
    widthM: (maxLng - minLng) * metersPerDegreeLng,
    heightM: (maxLat - minLat) * metersPerDegreeLat,
    areaM2: field.areaSqMeters ?? ((maxLng - minLng) * metersPerDegreeLng * (maxLat - minLat) * metersPerDegreeLat),
  }
}

// Standard plot size for research: ~3m x 9m (10ft x 30ft)
const PLOT_WIDTH_M = 3
const PLOT_HEIGHT_M = 9
const ALLEY_M = 1.5 // alley between trials in same field

function generatePlan(
  fields: Field[],
  trials: DashboardTrial[],
  existingPlots: Plot[],
  seasonId: string,
): PlannedAssignment[] {
  // Only plan trials that don't already have plots
  const unplannedTrials = trials.filter(t =>
    t.seasonId === seasonId &&
    t.status !== 'cancelled' &&
    !existingPlots.some(p => p.trialId === t.id && p.seasonId === seasonId)
  )

  if (unplannedTrials.length === 0 || fields.length === 0) return []

  // Sort trials by total plots needed (descending) — big trials get priority
  const sortedTrials = [...unplannedTrials].sort((a, b) =>
    (b.treatments * b.replications) - (a.treatments * a.replications)
  )

  // Track remaining area per field and current "cursor" position for packing
  const fieldState = new Map<string, {
    bounds: FieldBounds
    usedHeightM: number // how much vertical space is consumed
    crops: Set<string> // crops already in this field
  }>()

  for (const f of fields) {
    fieldState.set(f.id, {
      bounds: getFieldBounds(f),
      usedHeightM: 0,
      crops: new Set(),
    })
  }

  // Add existing trial crops to field state
  for (const p of existingPlots) {
    if (p.seasonId !== seasonId || !p.trialId) continue
    const trial = trials.find(t => t.id === p.trialId)
    if (trial && p.fieldId) {
      const state = fieldState.get(p.fieldId)
      if (state) state.crops.add(trial.cropType)
    }
  }

  const assignments: PlannedAssignment[] = []

  for (const trial of sortedTrials) {
    const trialWidthM = trial.treatments * PLOT_WIDTH_M
    const trialHeightM = trial.replications * PLOT_HEIGHT_M

    // Score each field
    let bestField: Field | null = null
    let bestScore = -Infinity

    for (const field of fields) {
      const state = fieldState.get(field.id)!
      const remainingHeightM = state.bounds.heightM - state.usedHeightM

      // Does the trial fit?
      if (trialWidthM > state.bounds.widthM) continue
      if (trialHeightM + ALLEY_M > remainingHeightM) continue

      // Score: prefer fields without the same crop, then by remaining space (tighter fit = better)
      let score = 0
      if (!state.crops.has(trial.cropType)) score += 100 // crop diversity bonus
      score -= (remainingHeightM - trialHeightM) // prefer tighter fit
      score += state.bounds.areaM2 / 10000 // slight preference for bigger fields

      if (score > bestScore) {
        bestScore = score
        bestField = field
      }
    }

    if (!bestField) {
      // Try any field that has physical space, ignoring crop preference
      for (const field of fields) {
        const state = fieldState.get(field.id)!
        const remainingHeightM = state.bounds.heightM - state.usedHeightM
        if (trialWidthM <= state.bounds.widthM && trialHeightM + ALLEY_M <= remainingHeightM) {
          bestField = field
          break
        }
      }
    }

    if (!bestField) continue // no field can fit this trial

    const state = fieldState.get(bestField.id)!
    const bounds = state.bounds

    // Calculate plot positions within the field
    const metersPerDegreeLat = 111320

    // Start from bottom of remaining space
    const startLatM = state.usedHeightM + ALLEY_M
    const cellW = (bounds.maxLng - bounds.minLng) / trial.treatments // fill field width
    const cellH = (PLOT_HEIGHT_M * trial.replications) / (bounds.heightM) * (bounds.maxLat - bounds.minLat) / trial.replications

    const startLat = bounds.minLat + (startLatM / metersPerDegreeLat)

    const plots: Plot[] = []
    // RCBD: randomize treatment order within each rep
    for (let r = 0; r < trial.replications; r++) {
      // Shuffle treatment numbers for this rep
      const treatmentOrder = Array.from({ length: trial.treatments }, (_, i) => i + 1)
      for (let i = treatmentOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [treatmentOrder[i]!, treatmentOrder[j]!] = [treatmentOrder[j]!, treatmentOrder[i]!]
      }

      for (let c = 0; c < trial.treatments; c++) {
        const pLng = bounds.minLng + c * cellW
        const pLat = startLat + r * cellH
        const treatmentNum = treatmentOrder[c]!
        const repNum = r + 1

        plots.push({
          id: crypto.randomUUID(),
          fieldId: bestField.id,
          seasonId,
          trialId: trial.id,
          label: `${trial.protocolCode}-R${repNum}T${treatmentNum}`,
          boundary: [
            [pLng, pLat] as LngLat,
            [pLng + cellW, pLat] as LngLat,
            [pLng + cellW, pLat + cellH] as LngLat,
            [pLng, pLat + cellH] as LngLat,
            [pLng, pLat] as LngLat,
          ],
          treatmentNumber: treatmentNum,
          replicationNumber: repNum,
          createdAt: Date.now(),
        })
      }
    }

    // Update field state
    state.usedHeightM = startLatM + PLOT_HEIGHT_M * trial.replications
    state.crops.add(trial.cropType)

    assignments.push({
      trial,
      field: bestField,
      cols: trial.treatments,
      rows: trial.replications,
      plots,
    })
  }

  return assignments
}

export function AutoPlanner({ fields, trials, existingPlots, seasonId, onApply, onClose }: AutoPlannerProps) {
  const [plan, setPlan] = useState<PlannedAssignment[]>(() =>
    generatePlan(fields, trials, existingPlots, seasonId)
  )

  const totalPlots = plan.reduce((sum, a) => sum + a.plots.length, 0)
  const fieldsUsed = new Set(plan.map(a => a.field.id)).size

  function handleRegenerate() {
    setPlan(generatePlan(fields, trials, existingPlots, seasonId))
  }

  function handleApply() {
    const allPlots = plan.flatMap(a => a.plots)
    const trialUpdates = plan.map(a => ({
      id: a.trial.id,
      fieldId: a.field.id,
      plotIds: a.plots.map(p => p.id),
    }))
    onApply(allPlots, trialUpdates)
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h2 className="dash-modal-title">Auto-Plan Trial Layout</h2>

        {plan.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No unplanned trials to assign.</div>
            <div style={{ fontSize: 12 }}>All trials either already have plots or no fields have enough space.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Assigning <strong>{plan.length}</strong> trials across <strong>{fieldsUsed}</strong> field{fieldsUsed !== 1 ? 's' : ''}, creating <strong>{totalPlots}</strong> plots total.
              Treatments are randomized within each replication (RCBD).
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
              {plan.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--gray-100)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                      {a.trial.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {a.trial.cropType} &middot; {a.cols}T &times; {a.rows}R = {a.plots.length} plots
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-700)' }}>
                      {a.field.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {a.field.areaSqMeters ? (a.field.areaSqMeters / 4046.86).toFixed(1) + ' ac' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="dash-form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {plan.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleRegenerate}>
                Re-randomize
              </button>
              <button className="btn btn-primary" onClick={handleApply}>
                Apply Plan ({totalPlots} plots)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
