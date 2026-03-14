import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TrialSession } from '../types'
import { generateCSV, generateFilename, downloadCSV } from '../utils/csvExport'

interface ReviewPageProps {
  sessions: TrialSession[]
  onDeleteSession: (configId: string, startedAt: number) => void
}

export function ReviewPage({ sessions, onDeleteSession }: ReviewPageProps) {
  const navigate = useNavigate()
  const { id, startedAt } = useParams()
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const session = sessions.find(
    s => s.config.id === id && s.startedAt === Number(startedAt)
  )

  if (!session) {
    return (
      <div>
        <p>Session not found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    )
  }

  const { config, data } = session
  const sortedData = [...data].sort((a, b) => a.plotNumber - b.plotNumber)

  const handleExport = () => {
    const csv = generateCSV(session)
    const filename = generateFilename(config)
    downloadCSV(csv, filename)
  }

  const filledPlots = data.filter(p =>
    Object.values(p.readings).some(readings => readings.some(r => r !== null))
  ).length

  const totalNotes = data.reduce((sum, p) => sum + p.notes.length, 0)
  const totalPhotos = data.reduce((sum, p) => sum + p.photos.length, 0)

  return (
    <>
      <div className="header">
        <button className="header-back" onClick={() => navigate('/')}>
          &lsaquo;
        </button>
        <h1>Review Data</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{config.name}</h2>
        <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
          {filledPlots} of {config.treatments * config.replications} plots recorded
          {' '}&middot;{' '}
          {new Date(session.startedAt).toLocaleDateString()}
          {session.completedAt ? ' · Complete' : ' · In Progress'}
        </p>
        {(totalNotes > 0 || totalPhotos > 0) && (
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
            {totalNotes > 0 && `${totalNotes} note${totalNotes !== 1 ? 's' : ''}`}
            {totalNotes > 0 && totalPhotos > 0 && ' · '}
            {totalPhotos > 0 && `${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      <button className="btn btn-primary" onClick={handleExport} style={{ marginBottom: 12 }}>
        Download CSV
      </button>

      {!session.completedAt && (
        <button
          className="btn btn-secondary"
          onClick={() => navigate(`/record/${config.id}`)}
          style={{ marginBottom: 12 }}
        >
          Continue Recording
        </button>
      )}

      {/* Data table */}
      <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
        <table className="data-grid">
          <thead>
            <tr>
              <th>Plot</th>
              {config.variables.map(v =>
                v.subSamples === 1 ? (
                  <th key={v.id}>{v.name}</th>
                ) : (
                  Array.from({ length: v.subSamples }, (_, i) => (
                    <th key={`${v.id}-${i}`}>
                      {v.name}_{i + 1}
                    </th>
                  ))
                )
              )}
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(plot => (
              <tr key={plot.plotNumber}>
                <td style={{ fontWeight: 600 }}>{plot.plotNumber}</td>
                {config.variables.map(v => {
                  const readings = plot.readings[v.id] ?? []
                  return Array.from({ length: v.subSamples }, (_, i) => {
                    const val = readings[i]
                    return (
                      <td key={`${v.id}-${i}`}>
                        {val !== null && val !== undefined ? val : <span className="empty-value">—</span>}
                      </td>
                    )
                  })
                })}
                <td style={{ fontSize: 13, maxWidth: 200 }}>
                  {plot.notes.length > 0 ? (
                    plot.notes.map(n => n.text).join('; ')
                  ) : (
                    <span className="empty-value">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Photos section */}
      {totalPhotos > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Photos</h3>
          {sortedData.filter(p => p.photos.length > 0).map(plot => (
            <div key={plot.plotNumber} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Plot {plot.plotNumber}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plot.photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo.dataUrl}
                    alt={`Plot ${plot.plotNumber} photo ${i + 1}`}
                    onClick={() => setSelectedPhoto(photo.dataUrl)}
                    style={{
                      width: 80, height: 80, objectFit: 'cover', borderRadius: 4,
                      cursor: 'pointer', border: '1px solid var(--gray-200)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-danger"
        onClick={() => {
          if (confirm('Delete this session? This cannot be undone.')) {
            onDeleteSession(config.id, session.startedAt)
            navigate('/')
          }
        }}
      >
        Delete Session
      </button>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div style={{ padding: 16, maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={selectedPhoto} alt="Full size" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </>
  )
}
