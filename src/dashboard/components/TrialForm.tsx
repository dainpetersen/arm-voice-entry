import { useState } from 'react'
import type { DashboardTrial, TreatmentDescription, TrialStatus, Client } from '../types'
import { TRIAL_STATUSES, TRIAL_STATUS_LABELS } from '../types'
import { CROP_TYPES } from '../../types'

interface TrialFormProps {
  onSave: (trial: DashboardTrial) => void
  onClose: () => void
  existing?: DashboardTrial
  clients: Client[]
  currentSeasonId: string
}

function generateProtocolCode(): string {
  const year = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')
  return `CRO-${year}-${num}`
}

function emptyTreatmentDesc(num: number): TreatmentDescription {
  return { number: num, name: '', description: '', product: '', rate: '', rateUnit: '' }
}

export function TrialForm({ onSave, onClose, existing, clients, currentSeasonId }: TrialFormProps) {
  const [protocolCode, setProtocolCode] = useState(existing?.protocolCode ?? generateProtocolCode())
  const [name, setName] = useState(existing?.name ?? '')
  const [clientId, setClientId] = useState(existing?.clientId ?? '')
  const [cropType, setCropType] = useState(existing?.cropType ?? CROP_TYPES[0])
  const [status, setStatus] = useState<TrialStatus>(existing?.status ?? 'draft')

  const [treatments, setTreatments] = useState(existing?.treatments ?? 2)
  const [replications, setReplications] = useState(existing?.replications ?? 3)
  const [treatmentDescriptions, setTreatmentDescriptions] = useState<TreatmentDescription[]>(
    existing?.treatmentDescriptions ?? [emptyTreatmentDesc(1), emptyTreatmentDesc(2)]
  )

  const [contractValue, setContractValue] = useState(existing?.contractValue ?? 0)
  const [estimatedCost, setEstimatedCost] = useState(existing?.estimatedCost ?? 0)
  const [currency, setCurrency] = useState(existing?.currency ?? 'USD')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(existing?.purchaseOrderNumber ?? '')

  const [plantingDate, setPlantingDate] = useState(existing?.plantingDate ?? '')
  const [harvestDate, setHarvestDate] = useState(existing?.harvestDate ?? '')
  const [contractStartDate, setContractStartDate] = useState(existing?.contractStartDate ?? '')
  const [contractEndDate, setContractEndDate] = useState(existing?.contractEndDate ?? '')

  const [notes, setNotes] = useState(existing?.notes ?? '')

  const margin = contractValue - estimatedCost
  const marginPct = contractValue > 0 ? ((margin / contractValue) * 100).toFixed(1) : '0.0'

  function updateTreatmentDesc(index: number, field: keyof TreatmentDescription, value: string | number) {
    setTreatmentDescriptions(prev =>
      prev.map((td, i) => (i === index ? { ...td, [field]: value } : td))
    )
  }

  function addTreatmentDesc() {
    setTreatmentDescriptions(prev => [...prev, emptyTreatmentDesc(prev.length + 1)])
  }

  function removeTreatmentDesc(index: number) {
    setTreatmentDescriptions(prev =>
      prev.filter((_, i) => i !== index).map((td, i) => ({ ...td, number: i + 1 }))
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const now = Date.now()
    const trial: DashboardTrial = {
      id: existing?.id ?? crypto.randomUUID(),
      protocolCode,
      name: name.trim(),
      clientId,
      seasonId: currentSeasonId,
      cropType,
      status,
      treatments,
      replications,
      treatmentDescriptions,
      fieldId: existing?.fieldId,
      plotIds: existing?.plotIds ?? [],
      contractValue: contractValue || undefined,
      estimatedCost: estimatedCost || undefined,
      currency,
      purchaseOrderNumber: purchaseOrderNumber || undefined,
      plantingDate: plantingDate || undefined,
      harvestDate: harvestDate || undefined,
      contractStartDate: contractStartDate || undefined,
      contractEndDate: contractEndDate || undefined,
      scheduledActivities: existing?.scheduledActivities ?? [],
      voiceEntryConfigId: existing?.voiceEntryConfigId,
      notes: notes || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    onSave(trial)
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <h2 className="dash-modal-title">{existing ? 'Edit Trial' : 'New Trial'}</h2>

        <form onSubmit={handleSubmit}>
          {/* Section 1: Basic Info */}
          <div className="dash-form-section">
            <div className="dash-form-section-title">Basic Information</div>
            <div className="dash-form-row">
              <label className="field">
                Protocol Code
                <input type="text" value={protocolCode} onChange={e => setProtocolCode(e.target.value)} placeholder="CRO-YYYY-NNN" />
              </label>
              <label className="field">
                Name <span style={{ color: 'red' }}>*</span>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required />
              </label>
            </div>
            <div className="dash-form-row">
              <label className="field">
                Client
                <select value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">-- Select Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Crop Type
                <select value={cropType} onChange={e => setCropType(e.target.value)}>
                  {CROP_TYPES.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Status
                <select value={status} onChange={e => setStatus(e.target.value as TrialStatus)}>
                  {TRIAL_STATUSES.map(s => (
                    <option key={s} value={s}>{TRIAL_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Section 2: Design */}
          <div className="dash-form-section">
            <div className="dash-form-section-title">Trial Design</div>
            <div className="dash-form-row">
              <label className="field">
                Treatments
                <input type="number" min={1} value={treatments} onChange={e => setTreatments(Number(e.target.value))} />
              </label>
              <label className="field">
                Replications
                <input type="number" min={1} value={replications} onChange={e => setReplications(Number(e.target.value))} />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>Treatment Descriptions</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addTreatmentDesc}>+ Add</button>
              </div>
              {treatmentDescriptions.map((td, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 80px 80px auto', gap: 8, marginBottom: 6, alignItems: 'end' }}>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>#</span>}
                    <input type="number" value={td.number} onChange={e => updateTreatmentDesc(i, 'number', Number(e.target.value))} />
                  </label>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>Name</span>}
                    <input type="text" value={td.name} onChange={e => updateTreatmentDesc(i, 'name', e.target.value)} placeholder="Treatment name" />
                  </label>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>Description</span>}
                    <input type="text" value={td.description} onChange={e => updateTreatmentDesc(i, 'description', e.target.value)} placeholder="Description" />
                  </label>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>Product</span>}
                    <input type="text" value={td.product ?? ''} onChange={e => updateTreatmentDesc(i, 'product', e.target.value)} placeholder="Product" />
                  </label>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>Rate</span>}
                    <input type="text" value={td.rate ?? ''} onChange={e => updateTreatmentDesc(i, 'rate', e.target.value)} placeholder="Rate" />
                  </label>
                  <label className="field">
                    {i === 0 && <span style={{ fontSize: 11 }}>Unit</span>}
                    <input type="text" value={td.rateUnit ?? ''} onChange={e => updateTreatmentDesc(i, 'rateUnit', e.target.value)} placeholder="oz/ac" />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeTreatmentDesc(i)}
                    style={{ padding: '4px 8px', marginBottom: 1 }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Financial */}
          <div className="dash-form-section">
            <div className="dash-form-section-title">Financial</div>
            <div className="dash-form-row">
              <label className="field">
                Contract Value
                <input type="number" min={0} step={0.01} value={contractValue} onChange={e => setContractValue(Number(e.target.value))} />
              </label>
              <label className="field">
                Estimated Cost
                <input type="number" min={0} step={0.01} value={estimatedCost} onChange={e => setEstimatedCost(Number(e.target.value))} />
              </label>
              <label className="field">
                Currency
                <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} />
              </label>
            </div>
            <div className="dash-form-row">
              <label className="field">
                Purchase Order #
                <input type="text" value={purchaseOrderNumber} onChange={e => setPurchaseOrderNumber(e.target.value)} />
              </label>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Calculated Margin</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: margin >= 0 ? 'var(--green-600)' : '#ef4444' }}>
                  ${margin.toLocaleString()} ({marginPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Dates */}
          <div className="dash-form-section">
            <div className="dash-form-section-title">Dates</div>
            <div className="dash-form-row">
              <label className="field">
                Planting Date
                <input type="date" value={plantingDate} onChange={e => setPlantingDate(e.target.value)} />
              </label>
              <label className="field">
                Harvest Date
                <input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} />
              </label>
            </div>
            <div className="dash-form-row">
              <label className="field">
                Contract Start
                <input type="date" value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
              </label>
              <label className="field">
                Contract End
                <input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
              </label>
            </div>
          </div>

          {/* Section 5: Notes */}
          <div className="dash-form-section">
            <div className="dash-form-section-title">Notes</div>
            <label className="field">
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
            </label>
          </div>

          {/* Actions */}
          <div className="dash-form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {existing ? 'Save Changes' : 'Create Trial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
