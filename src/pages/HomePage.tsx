import { useNavigate } from 'react-router-dom'
import type { TrialConfig, TrialSession } from '../types'
import type { SyncStatus } from '../hooks/useSync'
import { useAuthContext } from '../components/AuthGate'

interface HomePageProps {
  configs: TrialConfig[]
  sessions: TrialSession[]
  deleteConfig: (id: string) => void
  syncStatus?: SyncStatus & { syncNow: () => void }
}

export function HomePage({ configs, sessions, deleteConfig, syncStatus }: HomePageProps) {
  const navigate = useNavigate()
  const auth = useAuthContext()

  return (
    <>
      <div className="brand-header">
        <h1 className="brand-title">
          <span className="brand-green">CROP</span><span className="brand-black">WISE</span>
        </h1>
        <p className="brand-subtitle">Voice Entry</p>
      </div>

      {/* Sync status bar */}
      {syncStatus?.enabled && (
        <div
          className="sync-bar"
          onClick={syncStatus.syncNow}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', marginBottom: 16, borderRadius: 'var(--radius-sm)',
            fontSize: 13, cursor: 'pointer',
            background: syncStatus.error ? 'var(--red-50, #fef2f2)' : 'var(--green-50)',
            color: syncStatus.error ? 'var(--red-600, #dc2626)' : 'var(--green-700)',
            border: `1px solid ${syncStatus.error ? 'var(--red-200, #fecaca)' : 'var(--green-200)'}`,
          }}
        >
          <span>
            {syncStatus.isSyncing ? 'Syncing...' :
             syncStatus.error ? syncStatus.error :
             syncStatus.pendingCount > 0 ? `${syncStatus.pendingCount} change${syncStatus.pendingCount !== 1 ? 's' : ''} pending` :
             syncStatus.lastSync ? `Synced ${new Date(syncStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
             'Cloud sync enabled'}
          </span>
          <span style={{ fontSize: 16 }}>
            {syncStatus.isSyncing ? '...' : syncStatus.pendingCount > 0 ? '↑' : '✓'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={() => navigate('/setup')} style={{ flex: 1 }}>
          + New Trial
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ flex: 1 }}>
          Dashboard
        </button>
      </div>

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
                    {config.treatments}&times;{config.replications} ({config.treatments * config.replications} plots) &middot; {config.variables.length} variable{config.variables.length !== 1 ? 's' : ''}
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
                        {' '}&middot; {filledPlots}/{session.config.treatments * session.config.replications} plots
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

      {/* Account section */}
      {auth && (
        <div style={{
          marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--gray-200)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
            {auth.user.email}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: 'auto', fontSize: 13 }}
            onClick={auth.signOut}
          >
            Sign Out
          </button>
        </div>
      )}
    </>
  )
}
