import { useNavigate } from 'react-router-dom'
import type { TrialConfig, TrialSession } from '../types'

interface HomePageProps {
  configs: TrialConfig[]
  sessions: TrialSession[]
  deleteConfig: (id: string) => void
}

export function HomePage({ configs, sessions, deleteConfig }: HomePageProps) {
  const navigate = useNavigate()

  return (
    <>
      <div className="brand-header">
        <h1 className="brand-title">
          <span className="brand-green">CROP</span><span className="brand-black">WISE</span>
        </h1>
        <p className="brand-subtitle">Voice Entry</p>
      </div>

      <button className="btn btn-primary" onClick={() => navigate('/setup')} style={{ marginBottom: 24 }}>
        + New Trial
      </button>

      {configs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No trials yet</p>
          <p style={{ fontSize: 14 }}>Create a trial to start recording data by voice</p>
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 16, color: 'var(--gray-500)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Your Trials
          </h2>
          {configs.map(config => {
            const configSessions = sessions.filter(s => s.config.id === config.id)
            return (
              <div key={config.id} className="card trial-card" onClick={() => navigate(`/record/${config.id}`)}>
                <div>
                  <h3>{config.name}</h3>
                  <p>
                    {config.totalPlots} plots &middot; {config.variables.length} variable{config.variables.length !== 1 ? 's' : ''}
                    {configSessions.length > 0 && ` · ${configSessions.length} session${configSessions.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <span className="trial-card-arrow">&rsaquo;</span>
              </div>
            )
          })}

          {/* Sessions list */}
          {sessions.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, color: 'var(--gray-500)', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
                Recent Sessions
              </h2>
              {sessions.slice().reverse().map(session => {
                const date = new Date(session.startedAt)
                const filledPlots = session.data.filter(p =>
                  Object.values(p.readings).some(readings => readings.some(r => r !== null))
                ).length
                return (
                  <div
                    key={`${session.config.id}-${session.startedAt}`}
                    className="card trial-card"
                    onClick={() => navigate(`/review/${session.config.id}/${session.startedAt}`)}
                  >
                    <div>
                      <h3>{session.config.name}</h3>
                      <p>
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' '}&middot; {filledPlots}/{session.config.totalPlots} plots
                        {session.completedAt ? ' · Complete' : ' · In Progress'}
                      </p>
                    </div>
                    <span className="trial-card-arrow">&rsaquo;</span>
                  </div>
                )
              })}
            </>
          )}

          {/* Delete configs section */}
          <details style={{ marginTop: 24 }}>
            <summary style={{ fontSize: 14, color: 'var(--gray-400)', cursor: 'pointer' }}>
              Manage trials
            </summary>
            <div style={{ marginTop: 8 }}>
              {configs.map(config => (
                <div key={config.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span>{config.name}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: 'auto' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/setup/${config.id}`) }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ width: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${config.name}"?`)) deleteConfig(config.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </>
  )
}
