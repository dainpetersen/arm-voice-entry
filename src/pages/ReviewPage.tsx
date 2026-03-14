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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </>
  )
}
