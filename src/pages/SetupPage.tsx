import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TrialConfig, AssessmentVariable } from '../types'

interface SetupPageProps {
  configs?: TrialConfig[]
  onSave: (config: TrialConfig) => void
}

export function SetupPage({ configs, onSave }: SetupPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const existingConfig = configs?.find(c => c.id === id)

  const [name, setName] = useState(existingConfig?.name ?? '')
  const [totalPlots, setTotalPlots] = useState(existingConfig?.totalPlots?.toString() ?? '')
  const [plotsPerRow, setPlotsPerRow] = useState(existingConfig?.plotsPerRow?.toString() ?? '')
  const [serpentine, setSerpentine] = useState(existingConfig?.serpentine ?? true)
  const [variables, setVariables] = useState<AssessmentVariable[]>(existingConfig?.variables ?? [])

  // New variable form
  const [varName, setVarName] = useState('')
  const [varUnit, setVarUnit] = useState('')
  const [varSubSamples, setVarSubSamples] = useState('1')

  useEffect(() => {
    if (existingConfig) {
      setName(existingConfig.name)
      setTotalPlots(existingConfig.totalPlots.toString())
      setPlotsPerRow(existingConfig.plotsPerRow.toString())
      setSerpentine(existingConfig.serpentine)
      setVariables(existingConfig.variables)
    }
  }, [existingConfig])

  const addVariable = () => {
    if (!varName.trim()) return
    const newVar: AssessmentVariable = {
      id: crypto.randomUUID(),
      name: varName.trim(),
      unit: varUnit.trim(),
      subSamples: Math.max(1, parseInt(varSubSamples) || 1),
    }
    setVariables([...variables, newVar])
    setVarName('')
    setVarUnit('')
    setVarSubSamples('1')
  }

  const removeVariable = (varId: string) => {
    setVariables(variables.filter(v => v.id !== varId))
  }

  const handleSave = () => {
    if (!name.trim() || !totalPlots || !plotsPerRow || variables.length === 0) return

    const config: TrialConfig = {
      id: existingConfig?.id ?? crypto.randomUUID(),
      name: name.trim(),
      totalPlots: parseInt(totalPlots),
      plotsPerRow: parseInt(plotsPerRow),
      serpentine,
      variables,
      createdAt: existingConfig?.createdAt ?? Date.now(),
    }

    onSave(config)
    navigate('/')
  }

  const isValid = name.trim() && parseInt(totalPlots) > 0 && parseInt(plotsPerRow) > 0 && variables.length > 0

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

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Total Plots</label>
            <input
              type="number"
              inputMode="numeric"
              value={totalPlots}
              onChange={e => setTotalPlots(e.target.value)}
              placeholder="48"
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Plots Per Row</label>
            <input
              type="number"
              inputMode="numeric"
              value={plotsPerRow}
              onChange={e => setPlotsPerRow(e.target.value)}
              placeholder="12"
            />
            <div className="field-hint">For serpentine walk order</div>
          </div>
        </div>

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
              ? 'Row 1 forward, Row 2 backward, Row 3 forward...'
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
              </div>
            </div>
            <button className="variable-item-remove" onClick={() => removeVariable(v.id)}>
              &times;
            </button>
          </div>
        ))}

        {variables.length === 0 && (
          <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 16 }}>
            Add at least one assessment variable
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
          <button
            className="btn btn-secondary btn-sm"
            onClick={addVariable}
            disabled={!varName.trim()}
          >
            + Add Variable
          </button>
        </div>
      </div>

      {/* Preview walk order */}
      {parseInt(totalPlots) > 0 && parseInt(plotsPerRow) > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, color: 'var(--gray-600)', marginBottom: 8 }}>Walk Order Preview</h3>
          <WalkOrderPreview
            totalPlots={parseInt(totalPlots)}
            plotsPerRow={parseInt(plotsPerRow)}
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

function WalkOrderPreview({ totalPlots, plotsPerRow, serpentine }: { totalPlots: number; plotsPerRow: number; serpentine: boolean }) {
  if (totalPlots > 200 || plotsPerRow <= 0) return null

  const rows: number[][] = []
  const totalRows = Math.ceil(totalPlots / plotsPerRow)

  for (let row = 0; row < Math.min(totalRows, 6); row++) {
    const start = row * plotsPerRow + 1
    const end = Math.min(start + plotsPerRow - 1, totalPlots)
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
      {totalRows > 6 && (
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
          ...and {totalRows - 6} more row{totalRows - 6 !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
