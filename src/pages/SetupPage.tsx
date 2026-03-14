import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TrialConfig, AssessmentVariable } from '../types'
import { CROP_TYPES } from '../types'

interface SetupPageProps {
  configs?: TrialConfig[]
  onSave: (config: TrialConfig) => void
}

export function SetupPage({ configs, onSave }: SetupPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const existingConfig = configs?.find(c => c.id === id)

  const [name, setName] = useState(existingConfig?.name ?? '')
  const [cropType, setCropType] = useState(existingConfig?.cropType ?? '')
  const [customCropType, setCustomCropType] = useState('')
  const [treatments, setTreatments] = useState(existingConfig?.treatments?.toString() ?? '')
  const [replications, setReplications] = useState(existingConfig?.replications?.toString() ?? '')
  const [serpentine, setSerpentine] = useState(existingConfig?.serpentine ?? true)
  const [variables, setVariables] = useState<AssessmentVariable[]>(existingConfig?.variables ?? [])

  // New variable form
  const [varName, setVarName] = useState('')
  const [varUnit, setVarUnit] = useState('')
  const [varSubSamples, setVarSubSamples] = useState('1')
  const [varMin, setVarMin] = useState('')
  const [varMax, setVarMax] = useState('')

  useEffect(() => {
    if (existingConfig) {
      setName(existingConfig.name)
      setCropType(existingConfig.cropType ?? '')
      setTreatments(existingConfig.treatments.toString())
      setReplications(existingConfig.replications.toString())
      setSerpentine(existingConfig.serpentine)
      setVariables(existingConfig.variables)
    }
  }, [existingConfig])

  const addVariable = () => {
    if (!varName.trim()) return
    const parsedMin = varMin.trim() ? parseFloat(varMin) : null
    const parsedMax = varMax.trim() ? parseFloat(varMax) : null
    const newVar: AssessmentVariable = {
      id: crypto.randomUUID(),
      name: varName.trim(),
      unit: varUnit.trim(),
      subSamples: Math.max(1, parseInt(varSubSamples) || 1),
      min: parsedMin != null && !isNaN(parsedMin) ? parsedMin : null,
      max: parsedMax != null && !isNaN(parsedMax) ? parsedMax : null,
    }
    setVariables([...variables, newVar])
    setVarName('')
    setVarUnit('')
    setVarSubSamples('1')
    setVarMin('')
    setVarMax('')
  }

  const removeVariable = (varId: string) => {
    setVariables(variables.filter(v => v.id !== varId))
  }

  const numTreatments = parseInt(treatments) || 0
  const numReplications = parseInt(replications) || 0
  const totalPlots = numTreatments * numReplications

  const handleSave = () => {
    if (!name.trim() || numTreatments <= 0 || numReplications <= 0 || variables.length === 0) return

    const resolvedCropType = cropType === 'Other' ? customCropType.trim() : cropType
    const config: TrialConfig = {
      id: existingConfig?.id ?? crypto.randomUUID(),
      name: name.trim(),
      cropType: resolvedCropType || undefined,
      treatments: numTreatments,
      replications: numReplications,
      serpentine,
      variables,
      createdAt: existingConfig?.createdAt ?? Date.now(),
    }

    onSave(config)
    navigate('/')
  }

  const isValid = name.trim() && numTreatments > 0 && numReplications > 0 && variables.length > 0

  return (
    <>
      <div className="header">
        <button className="header-back" onClick={() => navigate('/')}>
          &lsaquo;
        </button>
        <h1>{existingConfig ? 'Edit Trial' : 'New Trial'}</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Trial Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Corn Fungicide 2025"
          />
        </div>

        <div className="field">
          <label>Crop Type</label>
          <select
            value={cropType}
            onChange={e => { setCropType(e.target.value); if (e.target.value !== 'Other') setCustomCropType('') }}
            style={{ fontSize: 16 }}
          >
            <option value="">Select crop (optional)</option>
            {CROP_TYPES.map(ct => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </select>
          {cropType === 'Other' && (
            <input
              type="text"
              value={customCropType}
              onChange={e => setCustomCropType(e.target.value)}
              placeholder="Enter crop type"
              style={{ marginTop: 8 }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Treatments</label>
            <input
              type="number"
              inputMode="numeric"
              value={treatments}
              onChange={e => setTreatments(e.target.value)}
              placeholder="8"
            />
            <div className="field-hint">Columns</div>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Replications</label>
            <input
              type="number"
              inputMode="numeric"
              value={replications}
              onChange={e => setReplications(e.target.value)}
              placeholder="4"
            />
            <div className="field-hint">Rows</div>
          </div>
        </div>

        {totalPlots > 0 && (
          <div style={{ fontSize: 14, color: 'var(--gray-600)', fontWeight: 600, marginBottom: 16 }}>
            {totalPlots} total plots ({numTreatments} &times; {numReplications})
          </div>
        )}

        <div className="field">
          <label>Walk Order</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${serpentine ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSerpentine(true)}
            >
              Serpentine
            </button>
            <button
              className={`btn btn-sm ${!serpentine ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSerpentine(false)}
            >
              Sequential
            </button>
          </div>
          <div className="field-hint">
            {serpentine
              ? 'Rep 1 forward, Rep 2 backward, Rep 3 forward...'
              : 'Plot 1, 2, 3... in order'}
          </div>
        </div>
      </div>

      {/* Assessment Variables */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Assessment Variables</h2>

        {variables.map(v => (
          <div key={v.id} className="variable-item">
            <div className="variable-item-info">
              <div className="variable-item-name">{v.name}</div>
              <div className="variable-item-detail">
                {v.subSamples} reading{v.subSamples !== 1 ? 's' : ''} per plot
                {v.unit && ` · ${v.unit}`}
                {(v.min != null || v.max != null) && (
                  <span> · range: {v.min ?? '—'} to {v.max ?? '—'}</span>
                )}
              </div>
            </div>
            <button className="variable-item-remove" onClick={() => removeVariable(v.id)}>
              &times;
            </button>
          </div>
        ))}

        {variables.length === 0 && (
          <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 16 }}>
            Create at least one assessment variable
          </p>
        )}

        {/* Add variable form */}
        <div style={{ background: 'var(--green-50)', borderRadius: 'var(--radius-sm)', padding: 16, marginTop: 12 }}>
          <div className="field">
            <label>Variable Name</label>
            <input
              type="text"
              value={varName}
              onChange={e => setVarName(e.target.value)}
              placeholder="e.g., Plant Height"
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Unit (optional)</label>
              <input
                type="text"
                value={varUnit}
                onChange={e => setVarUnit(e.target.value)}
                placeholder="e.g., cm"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Readings/Plot</label>
              <input
                type="number"
                inputMode="numeric"
                value={varSubSamples}
                onChange={e => setVarSubSamples(e.target.value)}
                placeholder="1"
                min="1"
              />
              <div className="field-hint">Sub-samples per plot</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Min (optional)</label>
              <input
                type="number"
                inputMode="decimal"
                value={varMin}
                onChange={e => setVarMin(e.target.value)}
                placeholder="e.g., 0"
              />
              <div className="field-hint">Expected minimum</div>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Max (optional)</label>
              <input
                type="number"
                inputMode="decimal"
                value={varMax}
                onChange={e => setVarMax(e.target.value)}
                placeholder="e.g., 300"
              />
              <div className="field-hint">Expected maximum</div>
            </div>
          </div>
          <button
            className={`btn ${variables.length === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={addVariable}
            disabled={!varName.trim()}
          >
            {variables.length === 0 ? 'Create Variable' : '+ Add Another Variable'}
          </button>
        </div>
      </div>

      {/* Preview walk order */}
      {totalPlots > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, color: 'var(--gray-600)', marginBottom: 8 }}>Walk Order Preview</h3>
          <WalkOrderPreview
            treatments={numTreatments}
            replications={numReplications}
            serpentine={serpentine}
          />
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={!isValid}
        style={{ opacity: isValid ? 1 : 0.5 }}
      >
        {existingConfig ? 'Save Changes' : 'Create Trial'}
      </button>
    </>
  )
}

function WalkOrderPreview({ treatments, replications, serpentine }: { treatments: number; replications: number; serpentine: boolean }) {
  const totalPlots = treatments * replications
  if (totalPlots > 200 || treatments <= 0 || replications <= 0) return null

  const rows: number[][] = []

  for (let row = 0; row < Math.min(replications, 6); row++) {
    const start = row * treatments + 1
    const end = start + treatments - 1
    const rowPlots: number[] = []
    for (let p = start; p <= end; p++) {
      rowPlots.push(p)
    }
    rows.push(rowPlots)
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 4,
            flexDirection: serpentine && rowIdx % 2 === 1 ? 'row-reverse' : 'row',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', minWidth: 36 }}>
            Rep {rowIdx + 1}
          </div>
          {row.map(plot => (
            <div
              key={plot}
              style={{
                minWidth: 32,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                background: 'var(--green-100)',
                borderRadius: 4,
                color: 'var(--green-800)',
                fontWeight: 600,
              }}
            >
              {plot}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            {serpentine && rowIdx % 2 === 1 ? '←' : '→'}
          </div>
        </div>
      ))}
      {replications > 6 && (
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
          ...and {replications - 6} more rep{replications - 6 !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
