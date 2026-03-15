import { useState, useCallback } from 'react'
import { useDashboard } from '../components/DashboardLayout'
import { parseProtocolText, protocolToTrial } from '../protocolParser'
import type { ParsedProtocol } from '../protocolParser'

export function ProtocolImportPage() {
  const { data, currentSeasonId, saveTrial, saveClient } = useDashboard()
  const [parsed, setParsed] = useState<ParsedProtocol | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [imported, setImported] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setParsed(null)
    setImported(false)

    try {
      // Read as ArrayBuffer for binary .prt0 support, fall back to text for .prt/.txt
      const isBinary = file.name.endsWith('.prt0') || file.name.endsWith('.prt')
      const input = isBinary ? await file.arrayBuffer() : await file.text()
      const result = parseProtocolText(input)
      setParsed(result)

      // Try to match sponsor to existing client
      const sponsorLower = result.sponsor.toLowerCase()
      const match = data.clients.find(c =>
        c.name.toLowerCase().includes(sponsorLower) ||
        sponsorLower.includes(c.name.toLowerCase())
      )
      if (match) setSelectedClientId(match.id)
    } catch (e) {
      setError(`Failed to parse protocol: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [data.clients])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleImport = () => {
    if (!parsed || !currentSeasonId) return

    let clientId = selectedClientId

    // Create client from sponsor if needed
    if (!clientId) {
      const newClient = {
        id: `client-${Date.now()}`,
        name: parsed.sponsor,
        contactName: parsed.sponsorContact,
        createdAt: Date.now(),
      }
      saveClient(newClient)
      clientId = newClient.id
    }

    const trial = protocolToTrial(parsed, clientId, currentSeasonId)
    saveTrial(trial)
    setImported(true)
  }

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--gray-800)' }}>
        Import Protocol
      </h1>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--green-500)' : 'var(--gray-300)'}`,
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
          background: dragOver ? 'var(--green-50)' : 'white',
          marginBottom: 24,
          transition: 'all 0.15s',
          cursor: 'pointer',
        }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.prt,.prt0,.txt,.pdf'
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) handleFile(file)
          }
          input.click()
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>
          Drop ARM Protocol File Here
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>
          Supports .prt0 (native ARM), .prt, and .txt protocol files
        </div>
      </div>

      {error && (
        <div className="dash-card" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {imported && (
        <div className="dash-card" style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>✓ Protocol imported successfully!</div>
          <div style={{ fontSize: 13 }}>
            Trial "{parsed?.title}" created with {parsed?.treatments.length} treatments
            {(parsed?.assessmentSchedules?.length ?? 0) > 0 && (
              <>, {parsed?.assessmentSchedules.reduce((sum, s) => sum + s.timings.length, 0)} assessment activities</>
            )}
            {(parsed?.maintenanceProducts?.length ?? 0) > 0 && (
              <>, {parsed?.maintenanceProducts.length} maintenance products</>
            )}
            .{' '}
            Go to <a href="#/dashboard/trials" style={{ color: '#166534', fontWeight: 600 }}>Trials</a> to view.
          </div>
        </div>
      )}

      {parsed && !imported && (
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">Protocol Preview</div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <InfoRow label="Protocol ID" value={parsed.protocolId || '—'} />
              <InfoRow label="Year" value={String(parsed.trialYear)} />
              <InfoRow label="Sponsor" value={parsed.sponsor} />
              {parsed.studyDirector && <InfoRow label="Study Director" value={parsed.studyDirector} />}
              {parsed.investigator && <InfoRow label="Investigator" value={parsed.investigator} />}
              {parsed.investigatorEmail && <InfoRow label="Email" value={parsed.investigatorEmail} />}
              {parsed.investigatorPhone && <InfoRow label="Phone" value={parsed.investigatorPhone} />}
            </div>
            <div>
              <InfoRow label="Crop" value={`${parsed.cropType}${parsed.cropCode ? ` (${parsed.cropCode})` : ''}`} />
              {parsed.cropStageScale && <InfoRow label="Stage Scale" value={parsed.cropStageScale} />}
              <InfoRow label="Plot Size" value={`${parsed.plotWidthFt} × ${parsed.plotLengthFt} ft (${(parsed.plotWidthFt * parsed.plotLengthFt).toFixed(0)} ft²)`} />
              <InfoRow label="Design" value={`${parsed.studyDesign}, ${parsed.replications} reps`} />
              <InfoRow label="GLP/GEP" value={`GLP: ${parsed.conductedUnderGLP ? 'Yes' : 'No'}, GEP: ${parsed.conductedUnderGEP ? 'Yes' : 'No'}`} />
              {parsed.dataDeadline && <InfoRow label="Data Due" value={parsed.dataDeadline} />}
            </div>
          </div>

          {/* Title */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16 }}>
            {parsed.title}
          </div>

          {/* Objectives */}
          {parsed.objectives.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Objectives</SectionLabel>
              <ol style={{ margin: '4px 0 0 20px', fontSize: 13, color: 'var(--gray-600)' }}>
                {parsed.objectives.map((obj, i) => <li key={i} style={{ marginBottom: 4 }}>{obj}</li>)}
              </ol>
            </div>
          )}

          {/* Treatments */}
          {parsed.treatments.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Treatments ({parsed.treatments.length})</SectionLabel>
              <table className="dash-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>Trt</th>
                    <th style={{ width: 60 }}>Type</th>
                    <th>Product</th>
                    <th style={{ width: 80 }}>Rate</th>
                    <th style={{ width: 80 }}>Unit</th>
                    <th style={{ width: 80 }}>App</th>
                    <th style={{ width: 80 }}>Timing</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.treatments.map(trt =>
                    trt.components.map((comp, ci) => (
                      <tr key={`${trt.number}-${ci}`} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: ci === 0 ? 600 : 400, color: ci === 0 ? 'var(--gray-800)' : 'var(--gray-400)' }}>
                          {ci === 0 ? trt.number : ''}
                        </td>
                        <td>
                          <TypeBadge type={comp.type} />
                        </td>
                        <td style={{ fontWeight: 500 }}>{comp.name}</td>
                        <td>{comp.rate || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{comp.rateUnit || '—'}</td>
                        <td style={{ fontSize: 12 }}>{comp.applCode || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{comp.applDescription || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Maintenance Products */}
          {parsed.maintenanceProducts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Maintenance Products (Applied to All Plots)</SectionLabel>
              <table className="dash-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Type</th>
                    <th>Product</th>
                    <th style={{ width: 80 }}>Rate</th>
                    <th style={{ width: 80 }}>Unit</th>
                    <th>Timing / Description</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.maintenanceProducts.map((mp, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>
                      <td><TypeBadge type={mp.type} /></td>
                      <td style={{ fontWeight: 500 }}>{mp.name}</td>
                      <td>{mp.rate || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{mp.rateUnit || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{mp.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Study Requirements */}
          {parsed.studyRequirements && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Study Requirements</SectionLabel>
              <div style={{
                padding: 12,
                background: 'var(--gray-50)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--gray-600)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {parsed.studyRequirements}
              </div>
            </div>
          )}

          {/* Assessment Schedule */}
          {parsed.assessmentSchedules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Assessment Schedule</SectionLabel>
              {parsed.assessmentSchedules.map((sched, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-700)' }}>{sched.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: sched.type === 'phytotoxicity' ? '#fee2e2' :
                        sched.type === 'weed_control' ? '#dbeafe' : '#d1fae5',
                      color: sched.type === 'phytotoxicity' ? '#991b1b' :
                        sched.type === 'weed_control' ? '#1e40af' : '#065f46',
                    }}>
                      {sched.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 4 }}>
                    {sched.description}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {sched.timings.map((t, ti) => {
                      const hasPhoto = sched.photoTimings?.some(pt => pt.days === t.days && pt.anchor === t.anchor)
                      return (
                        <span key={ti} style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: 'white',
                          border: '1px solid var(--gray-200)',
                          color: 'var(--gray-700)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          {t.days} {t.anchor}
                          {hasPhoto && <span title="Photo required">📷</span>}
                        </span>
                      )
                    })}
                  </div>
                  {sched.photoConditional && (
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic', marginTop: 6 }}>
                      {sched.photoConditional}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Client assignment & import */}
          <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 16, marginTop: 16 }}>
            <SectionLabel>Assign to Client</SectionLabel>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                >
                  <option value="">Create new client from "{parsed.sponsor}"</option>
                  {data.clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!currentSeasonId}
                style={{ flexShrink: 0 }}
              >
                Import Trial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      {!parsed && !error && (
        <div className="dash-card" style={{ marginTop: 8 }}>
          <div className="dash-card-title" style={{ marginBottom: 8 }}>Supported File Formats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', marginBottom: 4 }}>
                .prt0 — Native ARM Protocol
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                ARM's native binary protocol format. Just drag and drop the .prt0 file directly from your ARM project folder.
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', marginBottom: 4 }}>
                .prt / .txt — Text Export
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Plain text protocol export. In ARM: File → Export → Protocol Text.
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            The parser extracts: protocol ID, treatments (including tank mixes), plot dimensions,
            study design, crop info, objectives, investigator contacts, maintenance products,
            and assessment schedules (DAE/DAT).
          </div>
        </div>
      )}
    </>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    'CHK':  { bg: '#f1f5f9', fg: '#64748b' },
    'HERB': { bg: '#dbeafe', fg: '#1e40af' },
    'ADJ':  { bg: '#fef3c7', fg: '#92400e' },
    'ADDI': { bg: '#fef3c7', fg: '#92400e' },
    'FUNG': { bg: '#d1fae5', fg: '#065f46' },
    'FERT': { bg: '#e0e7ff', fg: '#3730a3' },
    'INSECT': { bg: '#fce7f3', fg: '#9d174d' },
    'PGR':  { bg: '#f3e8ff', fg: '#6b21a8' },
  }
  const colors = colorMap[type] || { bg: '#f3e8ff', fg: '#6b21a8' }

  return (
    <span style={{
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 4,
      fontWeight: 600,
      background: colors.bg,
      color: colors.fg,
    }}>
      {type}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: 'var(--gray-400)', minWidth: 100, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: 'var(--gray-700)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: 'var(--gray-400)',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    }}>
      {children}
    </div>
  )
}
