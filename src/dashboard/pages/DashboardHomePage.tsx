import { Link } from 'react-router-dom'
import { useDashboard } from '../components/DashboardLayout'
import { TRIAL_STATUS_COLORS, TRIAL_STATUS_LABELS } from '../types'
import type { ScheduledActivity } from '../types'
import { generateSeedData } from '../seedData'

export function DashboardHomePage() {
  const { data, currentSeasonId, saveSeason, loadBulkData, setCurrentSeasonId } = useDashboard()

  const seasonTrials = data.trials.filter(t => t.seasonId === currentSeasonId)
  const activeTrials = seasonTrials.filter(t => t.status === 'active')
  const totalRevenue = seasonTrials.reduce((sum, t) => sum + (t.contractValue ?? 0), 0)
  const totalCost = seasonTrials.reduce((sum, t) => sum + (t.estimatedCost ?? 0), 0)

  // Upcoming activities across all season trials
  const today = new Date().toISOString().split('T')[0]!
  const upcomingActivities: (ScheduledActivity & { trialName: string })[] = []
  for (const trial of seasonTrials) {
    for (const act of trial.scheduledActivities) {
      if (act.status === 'scheduled' && act.scheduledDate >= today) {
        upcomingActivities.push({ ...act, trialName: trial.name })
      }
    }
  }
  upcomingActivities.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))

  // Quick-create season if none exist
  if (data.seasons.length === 0) {
    return (
      <div className="dash-empty">
        <div className="dash-empty-icon">&#127793;</div>
        <div className="dash-empty-text">Welcome to Cropwise Farm Management</div>
        <p style={{ color: 'var(--gray-500)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
          Create your first season to start managing trials, clients, and your farm map.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            const year = new Date().getFullYear()
            saveSeason({
              id: crypto.randomUUID(),
              year,
              name: `Season ${year}`,
              createdAt: Date.now(),
            })
          }}
        >
          Create {new Date().getFullYear()} Season
        </button>
        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const seed = generateSeedData()
              loadBulkData(seed)
              setCurrentSeasonId(seed.seasons[0]!.id)
            }}
          >
            Load Demo Data (30 trials, 10 clients)
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--gray-800)' }}>
        Dashboard
      </h1>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Active Trials</div>
          <div className="stat-card-value">{activeTrials.length}</div>
          <div className="stat-card-sub">{seasonTrials.length} total this season</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Clients</div>
          <div className="stat-card-value">{data.clients.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue</div>
          <div className="stat-card-value">${totalRevenue.toLocaleString()}</div>
          <div className="stat-card-sub">
            Cost: ${totalCost.toLocaleString()} &middot; Margin: ${(totalRevenue - totalCost).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Fields</div>
          <div className="stat-card-value">{data.fields.length}</div>
          <div className="stat-card-sub">
            {data.plots.filter(p => p.seasonId === currentSeasonId).length} plots this season
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Trials */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">Trials</div>
            <Link to="/dashboard/trials" style={{ fontSize: 13, color: 'var(--green-600)' }}>View all</Link>
          </div>
          {seasonTrials.length === 0 ? (
            <div className="dash-empty" style={{ padding: 24 }}>
              <div style={{ fontSize: 14 }}>No trials yet</div>
              <Link to="/dashboard/trials" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
                Create Trial
              </Link>
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr><th>Name</th><th>Crop</th><th>Status</th></tr>
              </thead>
              <tbody>
                {seasonTrials.slice(0, 5).map(t => (
                  <tr key={t.id} onClick={() => {}}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.cropType}</td>
                    <td>
                      <span className="status-badge" style={{ background: TRIAL_STATUS_COLORS[t.status] }}>
                        {TRIAL_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Upcoming Activities */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">Upcoming Activities</div>
            <Link to="/dashboard/schedule" style={{ fontSize: 13, color: 'var(--green-600)' }}>View all</Link>
          </div>
          {upcomingActivities.length === 0 ? (
            <div className="dash-empty" style={{ padding: 24 }}>
              <div style={{ fontSize: 14 }}>No upcoming activities</div>
            </div>
          ) : (
            upcomingActivities.slice(0, 6).map(act => (
              <div key={act.id} className="activity-item">
                <div className={`activity-dot ${act.status}`} />
                <div className="activity-info">
                  <div className="activity-title">{act.description}</div>
                  <div className="activity-meta">
                    {act.trialName} &middot; {new Date(act.scheduledDate + 'T00:00:00').toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
